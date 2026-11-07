import { describe, expect, it, vi } from "vitest";
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk/entity";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { writeArkivIntent, arkivFailureDiagnostic, arkivBroadcastTransactionHash } from "../../src/lib/arkiv/briefmint/write";
import { hashPublicOpportunity, projectPublicOpportunity, type PublicationIntent } from "../../src/lib/shared/briefs";

// Real installed Arkiv/viem SDKs, isolated EIP-1193 provider. No network/signing.
const owner = `0x${"1".repeat(40)}`;
async function intent(): Promise<PublicationIntent> {
  const payload = projectPublicOpportunity({ parameters: { title: "Offline transaction", summary: "Synthetic public brief", category: "design", language: "en",
    budgetUsdCents: null, deadline: "2026-11-08T00:00:00.000Z", contactUrl: null },
    sections: { deliverables: ["One graphic"], acceptanceCriteria: ["Editable source"], exclusions: [], openQuestions: [] }, status: "open" }, 3);
  return { intentId: `0x${"a".repeat(64)}`, operation: "create", ownerAddress: owner, chainId: 7794095, entityKey: null, basePayloadHash: null,
    payload, publicPayloadHash: await hashPublicOpportunity(payload), expiresAtBlock: "1000", createdAt: "2026-11-07T00:00:00.000Z" };
}

describe("actual Arkiv SDK wallet submission with an offline provider", () => {
  it("constructs the engine call and exposes a synthetic broadcast hash before the SDK reads its receipt", async () => {
    const tx = `0x${"b".repeat(64)}` as `0x${string}`, entityKey = `0x${"c".repeat(64)}` as `0x${string}`;
    const engine = "0x4400000000000000000000000000000000000044", blockHash = `0x${"d".repeat(64)}`;
    let persistedHash: string | null = null;
    const provider = { request: vi.fn(async ({ method }: { method: string; params?: unknown[] }): Promise<unknown> => {
      if (method === "eth_chainId") return "0x76edaf";
      if (method === "eth_accounts") return [owner];
      if (method === "eth_blockNumber") return "0x64";
      if (method === "eth_estimateGas") return "0x493e0";
      if (method === "eth_getTransactionCount") return "0x0";
      if (method === "eth_sendTransaction") return tx;
      if (method === "eth_getTransactionReceipt") {
        expect(persistedHash).toBe(tx);
        return { transactionHash: tx, blockHash, blockNumber: "0x64", transactionIndex: "0x0", from: owner, to: engine,
          cumulativeGasUsed: "0x493e0", gasUsed: "0x493e0", effectiveGasPrice: "0x3b9aca00", contractAddress: null,
          status: "0x1", type: "0x0", logsBloom: `0x${"00".repeat(256)}`, logs: [{ address: engine,
            topics: encodeEventTopics({ abi: ENTITY_EVENTS_ABI, eventName: "EntityCreated", args: { entityKey, owner: owner as `0x${string}` } }),
            data: encodeAbiParameters([{ type: "uint64" }, { type: "uint8" }], [1000n, 0]),
            blockHash, blockNumber: "0x64", transactionHash: tx, transactionIndex: "0x0", logIndex: "0x0", removed: false }] };
      }
      throw new Error("Unexpected offline RPC");
    }) };
    expect(await writeArkivIntent(await intent(), "", provider, hash => { persistedHash = hash; })).toEqual({ transactionHash: tx, entityKey });
    const calls = provider.request.mock.calls;
    const estimate = calls.find(([args]) => args.method === "eth_estimateGas")![0].params![0] as { data: string };
    const sent = calls.find(([args]) => args.method === "eth_sendTransaction")![0].params![0] as { data: string; gas: string; from: string; to: string };
    expect(sent).toMatchObject({ from: owner, to: engine, gas: "0x5b8d8", data: estimate.data });
    expect(sent.data.slice(0, 10)).toBe("0x49650044");
    expect(calls.filter(([args]) => args.method === "eth_sendTransaction")).toHaveLength(1);
    expect(calls.some(([args]) => args.method === "wallet_sendTransaction")).toBe(false);
  });
  it.each([4001, -32000, -32601, -32602])("forwards only one submission and preserves the first RPC %i error", async code => {
    const provider = { request: vi.fn(async ({ method }: { method: string }): Promise<unknown> => {
      if (method === "eth_chainId") return "0x76edaf";
      if (method === "eth_accounts") return [owner];
      if (method === "eth_blockNumber") return "0x64";
      if (method === "eth_estimateGas") return "0x493e0";
      if (method === "eth_getTransactionCount") return "0x0";
      if (method === "eth_sendTransaction") throw { code, message: "Synthetic provider failure" };
      throw new Error("A second submission or unexpected RPC must never reach this provider");
    }) };
    const broadcast = vi.fn(); let error: unknown;
    try { await writeArkivIntent(await intent(), "", provider, broadcast); } catch (failure) { error = failure; }
    expect(error).toBeDefined();
    expect(arkivFailureDiagnostic(error)).toContain(`RPC ${code}`);
    expect(arkivBroadcastTransactionHash(error)).toBeNull();
    const methods = provider.request.mock.calls.map(([args]) => args.method);
    expect(methods.filter(method => method === "eth_sendTransaction")).toHaveLength(1);
    expect(methods).not.toContain("wallet_sendTransaction");
    expect(broadcast).not.toHaveBeenCalled();
  });
});
