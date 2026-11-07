import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPreparedIntentMatches, readPublicationRecovery, storePublicationRecovery } from "../../src/lib/client/publication-recovery";
import { sessionMatchesWallet } from "../../src/lib/client/session-identity";
import { advanceSessionGeneration, currentSessionGeneration, enqueueCookieMutation, endCookieSession, runCookieLogout, completeCookieLogout, cookieLogoutPending, sessionBlockReason, isCurrentSessionGeneration, setSessionBlock } from "../../src/lib/client/session-generation";
import { BRIEFMINT_CHAIN_ID, hashPublicOpportunity, type PublicationIntent, type PublicOpportunity } from "../../src/lib/shared/briefs";
import type { ArkivWriteDiagnostic } from "../../src/lib/arkiv/briefmint/write";

class MemoryStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const hex = (letter: string) => `0x${letter.repeat(64)}` as `0x${string}`;
const owner = `0x${"1".repeat(40)}`;
afterEach(() => { vi.unstubAllGlobals(); setSessionBlock(null); });

describe("browser publication and wallet safety", () => {
  it("retains sanitized submission diagnostics and a broadcast hash across recovery reads", () => {
    const storage = new MemoryStorage();
    const diagnostic: ArkivWriteDiagnostic = { phase: "wallet_confirmation", method: "eth_sendTransaction", rpcCode: null,
      chainId: 7794095, nonceBeforeSend: "0x0", target: `0x${"4".repeat(40)}`, calldataHash: hex("c"), transactionHash: null,
      observedAt: "2026-11-06T00:00:00.000Z" };
    const base = { intentId: hex("a"), operation: "create" as const, entityKey: null };
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: null, diagnostic });
    expect(readPublicationRecovery(storage, "brief", base.intentId)?.diagnostic).toEqual(diagnostic);
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: hex("b"), diagnostic: { ...diagnostic, phase: "broadcast", transactionHash: hex("b") } });
    // A refreshed client/new reader still prioritizes the immutable hash record.
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: null, diagnostic });
    expect(readPublicationRecovery(storage, "brief", base.intentId)).toMatchObject({ transactionHash: hex("b"), diagnostic: { phase: "broadcast", nonceBeforeSend: "0x0" } });
  });
  it("retains the winner's broadcast hash when a losing tab writes pre-arm state later", () => {
    const storage = new MemoryStorage();
    const base = { intentId: hex("a"), operation: "create" as const, entityKey: null };
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: null });
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: hex("b") });
    // Delayed pre-arm persistence from a second tab using the same prepared intent.
    storePublicationRecovery(storage, "brief", { ...base, transactionHash: null });
    expect(readPublicationRecovery(storage, "brief", base.intentId)?.transactionHash).toBe(hex("b"));
    expect(readPublicationRecovery(storage, "brief", hex("c"))).toBeNull();
  });

  it("hides a restored cookie owner from mismatched, disconnected and reconnecting wallets", () => {
    expect(sessionMatchesWallet(owner, owner.toUpperCase(), "connected")).toBe(true);
    expect(sessionMatchesWallet(owner, `0x${"2".repeat(40)}`, "connected")).toBe(false);
    expect(sessionMatchesWallet(owner, undefined, "disconnected")).toBe(false);
    expect(sessionMatchesWallet(owner, owner, "reconnecting")).toBe(false);
    expect(sessionMatchesWallet(null, owner, "connected")).toBe(false);
  });

  it("rejects a self-consistent prepared response differing from the approved request", async () => {
    const payload: PublicOpportunity = { schemaVersion: 1, namespace: "tool-city.opportunity.v1", revision: 1,
      title: "Synthetic design", summary: "Create graphics.", category: "design", language: "en", budgetUsdCents: null,
      deadline: "2026-11-07T00:00:00.000Z", contactUrl: null, status: "open", deliverables: ["One graphic"], acceptanceCriteria: ["Editable source"], exclusions: [], openQuestions: [] };
    const publicPayloadHash = await hashPublicOpportunity(payload);
    const intent: PublicationIntent = { intentId: hex("a"), operation: "create", chainId: BRIEFMINT_CHAIN_ID, ownerAddress: owner,
      entityKey: null, basePayloadHash: null, payload, publicPayloadHash, expiresAtBlock: "100", createdAt: "2026-11-06T00:00:00.000Z" };
    const expected = { intentId: intent.intentId, operation: intent.operation, ownerAddress: owner, payload, publicPayloadHash };
    expect(() => assertPreparedIntentMatches(intent, expected)).not.toThrow();
    for (const change of [{ intentId: hex("b") }, { operation: "update" as const }, { publicPayloadHash: hex("c") },
      { payload: { ...payload, revision: 2 } }, { payload: { ...payload, deliverables: ["Unapproved work"] } }]) {
      expect(() => assertPreparedIntentMatches({ ...intent, ...change }, expected)).toThrow("differs");
    }
  });

  it("invalidates stale session results when another tab advances the cookie epoch", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const captured = advanceSessionGeneration();
    storage.setItem("briefmint.sessionEpoch", "another-tab-login");
    expect(isCurrentSessionGeneration(captured)).toBe(false);
    expect(currentSessionGeneration()).toBeGreaterThan(captured);
  });

  it("uses one cross-tab lock for cookie mutations and fails closed without it", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", new MemoryStorage());
    const calls: string[] = [];
    vi.stubGlobal("navigator", { locks: { request: async (name: string, run: () => Promise<unknown>) => { calls.push(name); return run(); } } });
    await enqueueCookieMutation(async () => "ok");
    expect(calls).toEqual(["briefmint.session-cookie"]);
    vi.stubGlobal("navigator", {});
    await expect(enqueueCookieMutation(async () => "unsafe")).rejects.toThrow("Web Locks");
  });
  it("broadcasts logout completion only after a delayed cookie deletion", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    let release!: () => void;
    let cookieOwner: string | null = "A";
    const before = advanceSessionGeneration();
    const epochBefore = storage.getItem("briefmint.sessionEpoch");
    const pending = endCookieSession(async () => {
      await new Promise<void>(resolve => { release = resolve; });
      cookieOwner = null;
    }, before);
    await Promise.resolve();
    // Another tab must not be told logout completed while it can still read A.
    expect(cookieOwner).toBe("A");
    expect(storage.getItem("briefmint.sessionEpoch")).toBe(epochBefore);
    release();
    await pending;
    expect(cookieOwner).toBeNull();
    expect(storage.getItem("briefmint.sessionEpoch")).not.toBe(epochBefore);
  });

  it("does not broadcast successful logout when the deletion fails", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const before = advanceSessionGeneration();
    const epochBefore = storage.getItem("briefmint.sessionEpoch");
    await expect(endCookieSession(async () => { throw new Error("offline"); }, before)).rejects.toThrow("offline");
    expect(storage.getItem("briefmint.sessionEpoch")).toBe(epochBefore);
  });

  it("fails closed if the browser cannot persist a session transition", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("denied"); } });
    expect(() => advanceSessionGeneration()).toThrow("Browser storage");
  });

  it("deduplicates logout across controls and ignores its delayed callback after a newer login", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    let release!: () => void;
    let calls = 0;
    const run = async () => {
      calls += 1;
      await new Promise<void>(resolve => { release = resolve; });
    };
    const first = runCookieLogout(run);
    const duplicate = runCookieLogout(run);
    expect(first).toBe(duplicate);
    expect(cookieLogoutPending()).toBe(true);
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    const oldResult = await first;
    expect(cookieLogoutPending()).toBe(false);
    // A newer login/retry wins before React delivers the old mutation callback.
    advanceSessionGeneration();
    setSessionBlock("newer transition");
    const cleared = vi.fn();
    expect(completeCookieLogout(oldResult, cleared)).toBe(false);
    expect(cleared).not.toHaveBeenCalled();
    expect(sessionBlockReason()).toBe("newer transition");
  });

});
