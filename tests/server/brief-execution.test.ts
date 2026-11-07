import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BriefService, getBrief, saveBrief } from "../../src/lib/server/briefs";
import { openDatabase, type Database } from "../../src/lib/server/db";
import { BriefRunner, reconcileExpiredBriefLeases } from "../../src/lib/server/brief-runner";
import { createBriefInferenceProvider, type BriefInferenceProvider, type BriefInferenceResult } from "../../src/lib/server/brief-inference";
import { getBriefQuotaPolicy, type QuotaPolicy } from "../../src/lib/server/quota";
import { ServiceError } from "../../src/lib/server/errors";
import { createBriefRuntime } from "../../src/lib/server/brief-runtime";
import type { ServerEnv } from "../../src/lib/server/env";
import type { ModelResult, BriefView } from "../../src/lib/shared/briefs";

// Explicit local doubles only. No test makes an external request or spends credits.
const owner = `0x${"11".repeat(20)}`;
const other = `0x${"22".repeat(20)}`;
const now = Date.parse("2026-11-06T00:00:00.000Z");
const parameters: BriefView["publicParameters"] = { title: "Synthetic design brief", summary: "Create a test illustration.", category: "design", language: "en",
  budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null };
const evidence: NonNullable<BriefView["evidence"]> = { requestId: "test-only-request", modelId: null, providerId: null, routingTier: null,
  privateRoutingRequested: true, fallbacksAllowed: false, verificationRequested: true, routerVerification: null,
  independentResponseVerification: "unavailable", responseReference: null, checkedAt: null, sanitizedFailureReason: null };
const model: ModelResult = {
  deliverables: [{ text: "One illustration", sourceIds: ["seg_001"], basis: "provided" }],
  acceptanceCriteria: [{ text: "Supply editable source", sourceIds: [], basis: "suggested" }],
  exclusions: [], openQuestions: [{ text: "What dimensions are needed?", sourceIds: [], basis: "suggested" }],
};
const good: BriefInferenceProvider = { assertReady() {}, async compile() { return structuredClone({ result: model, evidence }); } };
const policy: QuotaPolicy = { allowedWallets: [owner, other], compilationsPerWallet: 2, globalDispatchLimit: 10, windowId: "test-window", windowEndsAt: now + 86400000 };
const env: ServerEnv = { appOrigin: "http://127.0.0.1:5173", allowedOrigins: ["http://127.0.0.1:5173"], sessionSecret: "test-only-secret".repeat(4),
  databasePath: ":memory:", rpcUrl: undefined, inferenceKey: "synthetic-test-key", inferenceBaseUrl: "https://provider.invalid/v1", modelId: "test-model",
  inferenceTimeoutMs: 1000, paymentConfirmations: 3, secureCookies: false };
const databases = new Set<Database>();
const directories: string[] = [];
function database(path = ":memory:") { const db = openDatabase(path); databases.add(db); return db; }
function close(db: Database) { db.close(); databases.delete(db); }
function draft(db: Database, wallet = owner) { return new BriefService(db, () => now).create(wallet, { notes: "Create one illustration. PRIVATE TEST SOURCE.", publicParameters: parameters }); }
function runner(db: Database, provider = good, quota: QuotaPolicy | null = policy, timeout = 1000) { return new BriefRunner(db, provider, quota, timeout, () => now); }
function count(db: Database) { return (db.prepare("SELECT COUNT(*) AS count FROM brief_quota").get() as { count: number }).count; }
afterEach(() => { vi.unstubAllGlobals(); for (const db of databases) db.close(); databases.clear(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("BriefMint quota and durable execution", () => {
  it("requires explicit configured allowance; readiness failures consume no attempts", async () => {
    const db = database(); const brief = draft(db);
    for (const quota of [null, { ...policy, windowEndsAt: now }, { ...policy, allowedWallets: [other] }]) {
      await expect(runner(db, good, quota).run(owner, brief.id)).rejects.toBeInstanceOf(ServiceError);
    }
    const unavailable: BriefInferenceProvider = { assertReady() { throw new ServiceError("SERVICE_UNAVAILABLE", 503, "Not configured"); }, compile: good.compile };
    await expect(runner(db, unavailable).run(owner, brief.id)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(count(db)).toBe(0); expect(getBrief(db, owner, brief.id).attemptsUsed).toBe(0);
    expect(getBriefQuotaPolicy({ NODE_ENV: "test" })).toBeNull();
    expect(getBriefQuotaPolicy({ NODE_ENV: "test", BRIEFMINT_ALLOWED_WALLETS: owner, BRIEFMINT_COMPILATIONS_PER_WALLET: "2", BRIEFMINT_GLOBAL_DISPATCH_LIMIT: "10",
      BRIEFMINT_QUOTA_WINDOW_ID: "test", BRIEFMINT_QUOTA_WINDOW_END: "2026-11-07T00:00:00.000Z" })).toMatchObject({ compilationsPerWallet: 2, globalDispatchLimit: 10 });
  });
  it("enforces wallet and global allowances without claiming onchain payment", async () => {
    const db = database(); const first = draft(db); const second = draft(db);
    const limited = { ...policy, compilationsPerWallet: 1, globalDispatchLimit: 2 };
    const result = await runner(db, good, limited).run(owner, first.id);
    expect(result.brief.executionStatus).toBe("ready"); expect(result.brief).not.toHaveProperty("payment");
    await expect(runner(db, good, limited).run(owner, second.id)).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED", status: 429 });
    const third = draft(db, other); await runner(db, good, limited).run(other, third.id);
    const fourth = draft(db, other);
    await expect(runner(db, good, limited).run(other, fourth.id)).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
    expect(count(db)).toBe(2); expect(getBrief(db, owner, second.id).attemptsUsed).toBe(0);
  });
  it("deduplicates concurrent same-brief runs and blocks a second active brief", async () => {
    const db = database(); const first = draft(db); const second = draft(db); let calls = 0; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const provider: BriefInferenceProvider = { assertReady() {}, async compile(...args) { calls++; await gate; return good.compile(...args); } };
    const run = runner(db, provider); const pending = run.run(owner, first.id);
    expect((await run.run(owner, first.id)).running).toBe(true);
    await expect(run.run(owner, second.id)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(calls).toBe(1); expect(count(db)).toBe(1);
    release(); expect((await pending).brief.executionStatus).toBe("ready");
    expect((await run.run(owner, first.id)).brief.executionStatus).toBe("ready"); expect(calls).toBe(1);
  });
  it("counts uncertain timeouts, aborts the provider and ignores a late completion", async () => {
    const db = database(); const brief = draft(db); let release!: (result: BriefInferenceResult) => void; let signal: AbortSignal | undefined;
    const provider: BriefInferenceProvider = { assertReady() {}, compile(_source, _params, providedSignal) { signal = providedSignal; return new Promise(resolve => { release = resolve; }); } };
    await expect(runner(db, provider, policy, 10).run(owner, brief.id)).rejects.toMatchObject({ code: "EXECUTION_INTERRUPTED", retryable: true });
    expect(signal?.aborted).toBe(true);
    expect(getBrief(db, owner, brief.id)).toMatchObject({ executionStatus: "interrupted", attemptsUsed: 1, immutableModelResult: null, retryEligible: true });
    release({ result: model, evidence }); await Promise.resolve(); await Promise.resolve();
    expect(getBrief(db, owner, brief.id).executionStatus).toBe("interrupted"); expect(count(db)).toBe(1);
    expect((await runner(db).run(owner, brief.id)).brief).toMatchObject({ executionStatus: "ready", attemptsUsed: 2 }); expect(count(db)).toBe(2);
  });
  it("bounds manual retries and preserves consumed allowances on failures", async () => {
    const db = database(); const brief = draft(db);
    const fail: BriefInferenceProvider = { assertReady() {}, async compile() { throw new ServiceError("PROVIDER_UNAVAILABLE", 503, "Unavailable", true); } };
    const run = runner(db, fail);
    await expect(run.run(owner, brief.id)).rejects.toMatchObject({ retryable: true });
    await expect(run.run(owner, brief.id)).rejects.toMatchObject({ retryable: false });
    await expect(run.run(owner, brief.id)).rejects.toMatchObject({ code: "RETRY_NOT_ALLOWED" });
    expect(count(db)).toBe(2); expect(getBrief(db, owner, brief.id)).toMatchObject({ attemptsUsed: 2, retryEligible: false });
    const otherBrief = draft(db); const terminal: BriefInferenceProvider = { assertReady() {}, async compile() { throw new ServiceError("PROVIDER_FAILED", 502, "Rejected", false); } };
    await expect(runner(db, terminal).run(owner, otherBrief.id)).rejects.toMatchObject({ retryable: false });
    await expect(runner(db).run(owner, otherBrief.id)).rejects.toMatchObject({ code: "RETRY_NOT_ALLOWED" });
  });
  it("recovers expired leases after reopening SQLite without refunding dispatch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "briefmint-lease-")); directories.push(dir); const path = join(dir, "state.sqlite");
    let db = database(path); const brief = draft(db);
    brief.executionStatus = "running"; brief.attemptsUsed = 1; saveBrief(db, brief);
    db.prepare("UPDATE briefs SET lease_token='interrupted-test',lease_until=? WHERE id=?").run(now + 100, brief.id);
    db.prepare("INSERT INTO brief_attempts(brief_id,number,lease_token,status,lease_until) VALUES(?,1,'interrupted-test','running',?)").run(brief.id, now + 100);
    db.prepare("INSERT INTO brief_quota(owner,brief_id,attempt,window_id,dispatched_at) VALUES(?,?,1,?,?)").run(owner, brief.id, policy.windowId, now);
    close(db); db = database(path);
    expect(reconcileExpiredBriefLeases(db, now + 99)).toBe(0);
    expect(reconcileExpiredBriefLeases(db, now + 100)).toBe(1);
    expect(getBrief(db, owner, brief.id)).toMatchObject({ executionStatus: "interrupted", attemptsUsed: 1, retryEligible: true });
    expect(count(db)).toBe(1); expect(reconcileExpiredBriefLeases(db, now + 101)).toBe(0);
    expect((await runner(db).run(owner, brief.id)).brief.attemptsUsed).toBe(2);
  });
  it("rejects injected invalid source references and contradictory evidence before ready", async () => {
    for (const output of [
      { result: { ...model, deliverables: [{ text: "Unknown source", sourceIds: ["seg_999"], basis: "provided" }] }, evidence },
      { result: model, evidence: { ...evidence, routerVerification: false } },
      { result: model, evidence: { ...evidence, independentResponseVerification: "failed" } },
    ]) {
      const db = database(); const brief = draft(db);
      const provider = { assertReady() {}, async compile() { return output; } } as BriefInferenceProvider;
      await expect(runner(db, provider).run(owner, brief.id)).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
      expect(getBrief(db, owner, brief.id)).toMatchObject({ executionStatus: "failed", attemptsUsed: 1, retryEligible: true, immutableModelResult: null, evidence: null });
      expect(count(db)).toBe(1);
    }
  });
  it("preserves original model/source while edits and saved results survive restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "briefmint-ready-")); directories.push(dir); const path = join(dir, "state.sqlite");
    let db = database(path); const brief = draft(db); const complete = (await runner(db).run(owner, brief.id)).brief;
    expect(complete.draftRevision).toBe(2); expect(complete.immutableModelResult).toEqual(model);
    const edited = structuredClone(complete.editedDraft!); edited.sections.deliverables = ["Owner-edited deliverable"];
    const saved = new BriefService(db, () => now).saveDraft(owner, brief.id, { expectedRevision: 2, draft: edited });
    expect(saved.immutableModelResult).toEqual(model);
    const changed = structuredClone(saved); changed.immutableModelResult!.deliverables[0].text = "Mutated original";
    expect(() => saveBrief(db, changed)).toThrow(/immutable/);
    const changedSource = structuredClone(saved); changedSource.inputSegments[0].text = "Replaced private notes";
    expect(() => saveBrief(db, changedSource)).toThrow(/immutable/);
    close(db); db = database(path);
    const never: BriefInferenceProvider = { assertReady() { throw new Error("Must not dispatch"); }, compile: good.compile };
    expect((await runner(db, never).run(owner, brief.id)).brief).toEqual(saved); expect(count(db)).toBe(1);
  });
});

describe("BriefMint private 0G adapter with local fetch doubles", () => {
  function response(content: unknown = model, trace?: unknown, more: Record<string, unknown> = {}) {
    return Response.json({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }], ...(trace === undefined ? {} : { x_0g_trace: trace }), ...more });
  }
  function provider(fetcher: () => Promise<Response>) { return createBriefInferenceProvider(env, fetcher as typeof fetch); }
  const source = [{ id: "seg_001", text: "Synthetic one illustration request." }];
  it("pins private-only routing and preserves unknown verification as unknown", async () => {
    let sent!: RequestInit;
    const adapter = createBriefInferenceProvider(env, (async (_url, init) => { sent = init!; return response(); }) as typeof fetch);
    const result = await adapter.compile(source, parameters);
    expect(sent.headers).toMatchObject({ "X-0G-Provider-Trust-Mode": "private", "X-0G-Provider-Allow-Fallbacks": "false" });
    expect(JSON.parse(sent.body as string)).toMatchObject({ model: "test-model", stream: false, verify_tee: true, max_tokens: 3000 });
    expect(result.result).toEqual(model);
    expect(result.evidence).toMatchObject({ requestId: null, routerVerification: null, independentResponseVerification: "unavailable", checkedAt: null });
  });
  it("uses the previously successful JSON/no-thinking request mode in the real BriefMint runtime", async () => {
    let sentBody: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response(model, undefined, { model: env.modelId });
    });
    const db = database(); const brief = draft(db);
    const rt = createBriefRuntime(db, env, { policy, now: () => now });
    const result = await rt.runner.run(owner, brief.id);
    expect(sentBody).toMatchObject({ model: env.modelId, max_tokens: 1200, response_format: { type: "json_object" }, chat_template_kwargs: { enable_thinking: false } });
    expect(result.brief).toMatchObject({ executionStatus: "ready", attemptsUsed: 1, evidence: { routerVerification: null, independentResponseVerification: "unavailable" } });
  });
  it("captures actual reported identifiers without asserting independent verification", async () => {
    const output = await provider(async () => response(model, { request_id: "actual-test-request", trust_mode: "private", provider_address: owner, tee_verified: true }, { id: "completion-id", model: env.modelId })).compile(source, parameters);
    expect(output.evidence).toMatchObject({ requestId: "actual-test-request", modelId: env.modelId, providerId: owner, routerVerification: true, independentResponseVerification: "unavailable" });
  });
  it("rejects malformed, truncated, oversized and source-invalid responses", async () => {
    const cases = [
      () => new Response("invalid JSON"), () => response({ ...model, unexpected: "private" }),
      () => response({ ...model, deliverables: [{ text: "Bad source", sourceIds: ["seg_999"], basis: "provided" }] }),
      () => response({ ...model, deliverables: [{ text: "x".repeat(501), sourceIds: ["seg_001"], basis: "provided" }] }),
      () => response(model, undefined, { choices: [{ message: { content: JSON.stringify(model) }, finish_reason: "length" }] }),
      () => new Response("x".repeat(100001)),
      () => response(model, undefined, { model: "unrequested-model" }),
    ];
    for (const makeResponse of cases) await expect(provider(async () => makeResponse()).compile(source, parameters)).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
  });
  it("rejects weaker, contradictory and invalid verification metadata", async () => {
    for (const trace of [{ trust_mode: "standard" }, { trust_mode: "private", routing_tier: "verified" }, { tee_verified: false },
      { tee_verified: "true" }, { provider_address: owner, provider: other }, { request_id: { secret: "hidden" } }]) {
      await expect(provider(async () => response(model, trace)).compile(source, parameters)).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
    }
  });
  it("sanitizes provider failures and never invokes fetch when credentials are absent", async () => {
    let calls = 0;
    const missing = createBriefInferenceProvider({ ...env, inferenceKey: undefined }, (async () => { calls++; return response(); }) as typeof fetch);
    await expect(missing.compile(source, parameters)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" }); expect(calls).toBe(0);
    await expect(provider(async () => new Response("sensitive error detail", { status: 503 })).compile(source, parameters)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true, message: "Private brief provider could not complete the request." });
    await expect(provider(async () => new Response("sensitive error detail", { status: 401 })).compile(source, parameters)).rejects.toMatchObject({ code: "PROVIDER_FAILED", retryable: false });
  });
  it("rejects credential echoes before evidence or original bytes can be stored", async () => {
    for (const key of [env.inferenceKey!, 'synthetic-"quoted\\key']) {
      for (const make of [
        () => response(model, { request_id: key }),
        () => response(model, { provider: key }),
        () => response(model, { [key]: "synthetic credential as property name" }),
        () => response({ ...model, exclusions: [{ text: key, sourceIds: [], basis: "suggested" }] }),
        () => { const res = response(); res.headers.set("ZG-Res-Key", key); return res; },
      ]) {
        const adapter = createBriefInferenceProvider({ ...env, inferenceKey: key }, (async () => make()) as typeof fetch);
        await expect(adapter.compile(source, parameters)).rejects.toMatchObject({ code: "PROVIDER_FAILED", message: "Private brief provider returned an invalid or unverified result." });
      }
    }
  });
  it("rejects unsafe endpoint and timeout configuration before dispatch", async () => {
    let calls = 0;
    for (const patch of [{ inferenceBaseUrl: "http://provider.invalid" }, { inferenceBaseUrl: "https://user:pass@provider.invalid" }, { inferenceBaseUrl: "https://provider.invalid?token=x" }, { inferenceTimeoutMs: 180001 }]) {
      const adapter = createBriefInferenceProvider({ ...env, ...patch }, (async () => { calls++; return response(); }) as typeof fetch);
      await expect(adapter.compile(source, parameters)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    }
    expect(calls).toBe(0);
  });
});
