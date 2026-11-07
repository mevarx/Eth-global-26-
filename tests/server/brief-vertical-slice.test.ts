import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { openDatabase, type Database } from "../../src/lib/server/db";
import { createBriefRuntime, type BriefRuntime } from "../../src/lib/server/brief-runtime";
import { createBriefInferenceProvider } from "../../src/lib/server/brief-inference";
import { handleBrief } from "../../src/lib/server/brief-http";
import type { ServerEnv } from "../../src/lib/server/env";
import type { PublicationReader } from "../../src/lib/server/brief-publication";
import { recordFromArkivRow } from "../../src/lib/arkiv/briefmint/read";
import { briefmintOpportunityValues } from "../../src/lib/arkiv/briefmint/schema";
import { briefApi, hashPublicOpportunity, projectPublicOpportunity, type BriefApiName, type BriefView, type PublicationIntent } from "../../src/lib/shared/briefs";

// MOCK only: local synthetic identities, inference, receipts and chain records. No network or environment access.
const owner = privateKeyToAccount(`0x${"11".repeat(32)}`), other = privateKeyToAccount(`0x${"22".repeat(32)}`);
const origin = "http://127.0.0.1:5173", now = Date.parse("2026-11-06T00:00:00.000Z");
const time = new Date(now).toISOString(), entityKey = `0x${"a".repeat(64)}`;
const hex = (digit: string) => `0x${digit.repeat(64)}`;
const env: ServerEnv = { appOrigin: origin, allowedOrigins: [origin], sessionSecret: "mock-session-secret".repeat(3), databasePath: ":memory:", rpcUrl: undefined,
  inferenceKey: "synthetic-provider-key", inferenceBaseUrl: "https://mock.invalid/v1", modelId: "mock-model", inferenceTimeoutMs: 1000, paymentConfirmations: 3, secureCookies: false };
const parameters = { title: "Mock design", summary: "Create one graphic", category: "design" as const, language: "en" as const,
  budgetUsdCents: 2500, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null };
const model = { deliverables: [{ text: "One graphic", sourceIds: ["seg_001"], basis: "provided" }],
  acceptanceCriteria: [{ text: "Editable file", sourceIds: [], basis: "suggested" }], exclusions: [], openQuestions: [] };

function fixture() {
  let record: ReturnType<typeof recordFromArkivRow> | null = null;
  let fail = false;
  const reader: PublicationReader = {
    currentBlock: async () => ({ number: "101", timestamp: String(now / 1000), blockTimeSeconds: 12 }),
    get: async key => { if (fail) throw new Error("MOCK RPC failure"); return key === entityKey ? record : null; },
    transaction: async () => ({ status: "confirmed", chainId: 7794095, signer: owner.address, entityKeys: [entityKey], blockNumber: "101" }),
    // MOCK query applies the same declared discovery fields; record conversion uses the actual adapter boundary.
    list: async filter => {
      if (fail) throw new Error("MOCK RPC failure");
      const p = record?.payload;
      const matches = !!p && p.status === filter.status && p.language === filter.language && (!filter.category || p.category === filter.category)
        && Date.parse(p.deadline) >= Date.parse(filter.deadlineAfter)
        && (filter.minBudgetUsdCents === undefined || (p.budgetUsdCents !== null && p.budgetUsdCents >= filter.minBudgetUsdCents));
      return { records: matches && record ? [record] : [], nextCursor: null };
    },
  };
  return { reader, set(intent: PublicationIntent) { record = recordFromArkivRow({ ...briefmintOpportunityValues(intent.payload), $key: entityKey,
    $owner: owner.address, $expiresAt: { value: BigInt(intent.expiresAtBlock) } }, "101", time); }, fail(value: boolean) { fail = value; } };
}
function runtime(db: Database, reader: PublicationReader, mode: "ok" | "502" | "invalid" = "ok") {
  const fetcher: typeof fetch = async () => mode === "502" ? new Response("MOCK private upstream error", { status: 502 })
    : Response.json(mode === "invalid" ? { choices: [] } : { model: "mock-model", choices: [{ message: { content: JSON.stringify(model) }, finish_reason: "stop" }] });
  return createBriefRuntime(db, env, { reader, now: () => now, provider: createBriefInferenceProvider(env, fetcher),
    policy: { allowedWallets: [owner.address], compilationsPerWallet: 5, globalDispatchLimit: 10, windowId: "mock", windowEndsAt: now + 86400000 } });
}
async function login(rt: BriefRuntime, wallet = owner) { const challenge = rt.auth.challenge(wallet.address, "briefmint");
  return (await rt.auth.verify(challenge.challengeId, await wallet.signMessage({ message: challenge.message }))).cookie.split(";")[0]; }
async function call(rt: BriefRuntime, action: BriefApiName, cookie: string, body?: unknown, id?: string, query = "") {
  const endpoint = briefApi[action];
  return handleBrief(action, new Request(origin + endpoint.path.replace(":id", id ?? "") + query, { method: endpoint.method,
    headers: { Cookie: cookie, "x-briefmint-owner": rt.auth.session(new Request(origin, { headers: { Cookie: cookie } })).address, Origin: origin, "Content-Type": "application/json" },
    ...(endpoint.method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }) }), id, rt);
}
async function data(response: Response, status = 200) { expect(response.status).toBe(status); return (await response.json()).data; }

describe("MOCK end-to-end backend vertical slice", () => {
  it("persists a compiled, edited, approved, published, updated and closed brief across reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "brief-vertical-")); const path = join(dir, "state.sqlite"); let db = openDatabase(path);
    try {
      const chain = fixture(); let rt = runtime(db, chain.reader); const cookie = await login(rt); const wrong = await login(rt, other);
      const brief = await data(await call(rt, "create", cookie, { notes: "MOCK PRIVATE SOURCE one graphic", publicParameters: parameters }), 201);
      expect((await call(rt, "get", wrong, undefined, brief.id)).status).toBe(404);
      let view: BriefView = await data(await call(rt, "run", cookie, {}, brief.id));
      expect(view.immutableModelResult).toEqual(model); expect(view.attemptsUsed).toBe(1);
      const draft = structuredClone(view.editedDraft!); draft.parameters.title = "Owner edited";
      const oldHash = await hashPublicOpportunity(projectPublicOpportunity(draft, view.draftRevision));
      view = await data(await call(rt, "saveDraft", cookie, { expectedRevision: view.draftRevision, draft }, brief.id));
      expect(view.immutableModelResult).toEqual(model);
      expect((await call(rt, "approve", cookie, { expectedRevision: view.draftRevision - 1, publicPayloadHash: oldHash }, brief.id)).status).toBe(409);
      async function publish(operation: "create" | "update" | "close", digit: string) {
        const hash = await hashPublicOpportunity(projectPublicOpportunity(view.editedDraft!, view.draftRevision));
        view = await data(await call(rt, "approve", cookie, { expectedRevision: view.draftRevision, publicPayloadHash: hash }, brief.id));
        const request = { intentId: hex(digit), operation, expectedRevision: view.draftRevision, publicPayloadHash: hash };
        const intent: PublicationIntent = await data(await call(rt, "prepare", cookie, request, brief.id));
        const hints = { intentId: request.intentId, transactionHash: null, entityKey: null };
        const armed = await data(await call(rt, "reconcile", cookie, hints, brief.id), 202);
        expect(armed.publication.pending.state).toBe("unknown");
        expect((await call(rt, "reconcile", cookie, hints, brief.id)).status).toBe(409);
        chain.set(intent); // MOCK receipt/readback; no wallet or transaction is submitted.
        view = await data(await call(rt, "reconcile", cookie, { ...hints, transactionHash: hex(digit === "b" ? "c" : digit === "d" ? "e" : "f"), entityKey }, brief.id));
        expect(view.publication.pending).toBeNull();
      }
      const filter = { language: "en" as const, status: "open" as const, deadlineAfter: time, limit: 20, minBudgetUsdCents: 1 };
      expect((await chain.reader.list(filter)).records).toHaveLength(0);
      await publish("create", "b"); expect((await chain.reader.list(filter)).records[0].payload.title).toBe("Owner edited");
      let next = structuredClone(view.editedDraft!); next.parameters.title = "Updated public title";
      view = await data(await call(rt, "saveDraft", cookie, { expectedRevision: view.draftRevision, draft: next }, brief.id));
      await publish("update", "d"); expect((await chain.reader.list(filter)).records[0].payload.title).toBe("Updated public title");
      next = structuredClone(view.editedDraft!); next.status = "closed";
      view = await data(await call(rt, "saveDraft", cookie, { expectedRevision: view.draftRevision, draft: next }, brief.id));
      await publish("close", "9"); expect(view.publication.status).toBe("closed");
      expect((await chain.reader.list(filter)).records).toHaveLength(0);
      expect((await chain.reader.list({ ...filter, status: "closed" })).records).toHaveLength(1);
      chain.fail(true); await expect(chain.reader.list(filter)).rejects.toThrow(/MOCK RPC failure/); chain.fail(false);
      const archive = await data(await call(rt, "export", cookie, undefined, brief.id, "?format=json")); expect(archive.content).toContain("MOCK PRIVATE SOURCE");
      db.close(); db = openDatabase(path); rt = runtime(db, chain.reader);
      const reopened = await data(await call(rt, "get", cookie, undefined, brief.id));
      expect(reopened).toMatchObject({ attemptsUsed: 1, immutableModelResult: model, publication: { status: "closed" } });
      expect((db.prepare("SELECT COUNT(*) AS count FROM brief_quota").get() as { count: number }).count).toBe(1);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  it.each(["502", "invalid"] as const)("sanitizes a MOCK provider %s failure and counts its uncertain dispatch", async mode => {
    const db = openDatabase(":memory:");
    try {
      const rt = runtime(db, fixture().reader, mode); const cookie = await login(rt);
      const brief = await data(await call(rt, "create", cookie, { notes: "MOCK PRIVATE SOURCE", publicParameters: parameters }), 201);
      const failed = await call(rt, "run", cookie, {}, brief.id); expect(failed.status).toBe(mode === "502" ? 503 : 502);
      expect(await failed.text()).not.toContain("MOCK private upstream error");
      expect((await data(await call(rt, "get", cookie, undefined, brief.id))).attemptsUsed).toBe(1);
      expect((db.prepare("SELECT COUNT(*) AS count FROM brief_quota").get() as { count: number }).count).toBe(1);
    } finally { db.close(); }
  });
});
