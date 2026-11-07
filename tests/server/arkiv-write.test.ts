import { beforeEach, describe, expect, it, vi } from "vitest";
import { EntityMutationError } from "@arkiv-network/sdk";
import { hexToString, type Transport } from "viem";
import { writeArkivIntent, arkivBroadcastTransactionHash, arkivFailureDiagnostic, type ArkivWriteDiagnostic } from "../../src/lib/arkiv/briefmint/write";
import { BriefmintOpportunitySchema } from "../../src/lib/arkiv/briefmint/schema";
import { hashPublicOpportunity, projectPublicOpportunity, type PublicationIntent } from "../../src/lib/shared/briefs";

// Offline SDK boundary only. No wallet signing, transaction or RPC is performed.
const mock = vi.hoisted(() => ({ create: vi.fn(), patch: vi.fn(),
  config: null as { account: string; chain: { id: number }; transport: Transport } | null }));
vi.mock("@arkiv-network/sdk", async original => ({ ...await original<typeof import("@arkiv-network/sdk")>(),
  createWalletClient: (config: NonNullable<typeof mock.config>) => { mock.config = config; return { createEntity: mock.create, patchEntity: mock.patch }; },
}));
const owner = `0x${"1".repeat(40)}`, key = `0x${"a".repeat(64)}`, tx = `0x${"b".repeat(64)}` as `0x${string}`;
async function intent(operation: PublicationIntent["operation"] = "create"): Promise<PublicationIntent> {
  const payload = projectPublicOpportunity({ parameters: { title: "Synthetic public task", summary: "One graphic", category: "design", language: "en",
    budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
    sections: { deliverables: ["One graphic"], acceptanceCriteria: ["Editable source"], exclusions: [], openQuestions: [] },
    status: operation === "close" ? "closed" : "open" }, operation === "create" ? 2 : 3);
  return { intentId: `0x${"c".repeat(64)}`, operation, chainId: 7794095, ownerAddress: owner,
    entityKey: operation === "create" ? null : key, basePayloadHash: operation === "create" ? null : `0x${"d".repeat(64)}`,
    payload, publicPayloadHash: await hashPublicOpportunity(payload), expiresAtBlock: "1000", createdAt: "2026-11-06T00:00:00.000Z" };
}
function wallet(chain = 7794095, account = owner) {
  return { request: vi.fn(async ({ method }: { method: string }): Promise<unknown> => {
    if (method === "eth_chainId") return `0x${chain.toString(16)}`;
    if (method === "eth_accounts") return [account];
    if (method === "eth_getTransactionCount") return "0x0";
    if (method === "eth_sendTransaction") return tx;
    if (method === "wallet_sendTransaction") return tx;
    throw new Error("Unexpected offline RPC");
  }) };
}
beforeEach(() => { mock.config = null; mock.create.mockReset().mockResolvedValue({ txHash: tx, entityKey: key }); mock.patch.mockReset().mockResolvedValue({ txHash: tx, entityKey: key }); });

describe("owner-signed Arkiv SDK write boundary (offline)", () => {
  it.each(["create", "update", "close"] as const)("writes the exact approved public %s values", async operation => {
    const value = await intent(operation);
    expect(await writeArkivIntent(value, "", wallet())).toEqual({ transactionHash: tx, entityKey: key });
    expect(mock.config).toMatchObject({ account: owner, chain: { id: 7794095 } });
    expect(mock.config!.transport({ retryCount: 9 }).config.retryCount).toBe(0);
    const args = operation === "create" ? mock.create.mock.calls[0] : mock.patch.mock.calls[0];
    expect(args[0]).toBe(BriefmintOpportunitySchema);
    const values = operation === "create" ? args[1] : args[2].set;
    expect(JSON.parse(hexToString(values.content.value))).toEqual(value.payload);
    if (operation === "create") expect(args[2]).toMatchObject({ flags: { readonly: false, permissionlessExtension: false } });
    else { expect(args[1]).toBe(key); expect(args[2]).not.toHaveProperty("expiration"); }
  });
  it("rejects wrong owner, wrong chain, changed hash and private payload fields before SDK write", async () => {
    const value = await intent();
    await expect(writeArkivIntent(value, "", wallet(1))).rejects.toThrow(/Rabdi/);
    await expect(writeArkivIntent(value, "", wallet(7794095, `0x${"2".repeat(40)}`))).rejects.toThrow(/owner/);
    await expect(writeArkivIntent({ ...value, publicPayloadHash: tx }, "", wallet())).rejects.toThrow();
    await expect(writeArkivIntent({ ...value, payload: { ...value.payload, notes: "SYNTHETIC PRIVATE CANARY" } } as unknown as PublicationIntent, "", wallet())).rejects.toThrow();
    expect(mock.config).toBeNull(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.patch).not.toHaveBeenCalled();
  });
  it("reports the broadcast hash before receipt waiting fails, even if recovery persistence throws", async () => {
    const onBroadcast = vi.fn(() => { throw new Error("Synthetic storage failure"); });
    const diagnostics: ArkivWriteDiagnostic[] = [];
    mock.create.mockImplementationOnce(async () => {
      const transport = mock.config!.transport({ retryCount: 0 });
      expect(await transport.request({ method: "eth_sendTransaction", params: [] })).toBe(tx);
      expect(onBroadcast).toHaveBeenCalledWith(tx);
      throw new EntityMutationError("Synthetic receipt timeout", { txHash: tx });
    });
    try { await writeArkivIntent(await intent(), "", wallet(), onBroadcast, value => diagnostics.push(value)); throw new Error("Expected receipt failure"); }
    catch (error) { expect(arkivBroadcastTransactionHash(error)).toBe(tx); }
    expect(mock.create).toHaveBeenCalledOnce();
    expect(diagnostics.map(value => value.phase)).toEqual(["wallet_confirmation", "broadcast"]);
    expect(diagnostics[1]).toMatchObject({ transactionHash: tx, nonceBeforeSend: "0x0" });
  });
  it.each([4001, -32601, -32602, -32000])("preserves sanitized wallet RPC %i evidence without retrying a failed submission", async code => {
    const provider = wallet(); const request = provider.request.getMockImplementation()!;
    provider.request.mockImplementation(async args => {
      if (args.method === "eth_sendTransaction") throw { code, message: "SYNTHETIC SENSITIVE ERROR DETAIL" };
      return request(args);
    });
    const diagnostics: ArkivWriteDiagnostic[] = []; const broadcast = vi.fn();
    mock.create.mockImplementationOnce(async () => mock.config!.transport({ retryCount: 9 }).request({ method: "eth_sendTransaction",
      params: [{ to: "0x4400000000000000000000000000000000000044", data: "0x1234" }] }));
    let failure: unknown;
    try { await writeArkivIntent(await intent(), "", provider, broadcast, value => diagnostics.push(value)); } catch (error) { failure = error; }
    expect(failure).toBeDefined(); expect(arkivFailureDiagnostic(failure)).toContain(`RPC ${code}`);
    expect(broadcast).not.toHaveBeenCalled();
    expect(provider.request.mock.calls.filter(([args]) => args.method === "eth_sendTransaction")).toHaveLength(1);
    expect(diagnostics.at(-1)).toMatchObject({ phase: "rpc_failed", method: "eth_sendTransaction", rpcCode: code, nonceBeforeSend: "0x0", transactionHash: null });
    expect(JSON.stringify(diagnostics)).not.toContain("SENSITIVE");
    expect(diagnostics[0].calldataHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it("keeps an ambiguous wallet response distinct from a broadcast hash", async () => {
    const provider = wallet(); const request = provider.request.getMockImplementation()!;
    provider.request.mockImplementation(async args => args.method === "eth_sendTransaction" ? null : request(args));
    const diagnostics: ArkivWriteDiagnostic[] = []; const broadcast = vi.fn();
    mock.create.mockImplementationOnce(async () => mock.config!.transport({ retryCount: 0 }).request({ method: "eth_sendTransaction", params: [] }));
    await expect(writeArkivIntent(await intent(), "", provider, broadcast, value => diagnostics.push(value))).rejects.toThrow(/no valid broadcast/);
    expect(broadcast).not.toHaveBeenCalled(); expect(diagnostics.at(-1)?.phase).toBe("invalid_wallet_response");
  });
  it("captures a first wallet_sendTransaction hash before SDK receipt handling", async () => {
    const broadcast = vi.fn();
    mock.create.mockImplementationOnce(async () => {
      await mock.config!.transport({ retryCount: 0 }).request({ method: "wallet_sendTransaction", params: [] });
      expect(broadcast).toHaveBeenCalledWith(tx);
      return { txHash: tx, entityKey: key };
    });
    expect(await writeArkivIntent(await intent(), "", wallet(), broadcast)).toMatchObject({ transactionHash: tx });
  });
});
