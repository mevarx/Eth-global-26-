import { createWalletClient, EntityMutationError, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { custom, keccak256 } from "viem";
import { BRIEFMINT_CHAIN_ID, validatePublicationIntent, type BriefmintArkivWriter, type PublicationIntent } from "../../shared/briefs";
import { BriefmintOpportunitySchema, briefmintOpportunityValues } from "./schema";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
export type ArkivWriteDiagnostic = {
  phase: "wallet_confirmation" | "broadcast" | "rpc_failed" | "invalid_wallet_response" | "receipt_confirmed";
  method: string; rpcCode: number | null; chainId: number; nonceBeforeSend: string | null;
  target: string | null; calldataHash: `0x${string}` | null; transactionHash: `0x${string}` | null; observedAt: string;
};
function rpcCode(error: unknown): number | null {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === "number" && Number.isSafeInteger(value.code)) return value.code;
    current = value.cause;
  }
  return null;
}
/** Fixed diagnostic labels only; never render raw wallet/SDK errors or calldata. */
export function arkivFailureDiagnostic(error: unknown): string {
  const code = rpcCode(error);
  const reason = code === 4001 ? "WALLET_REJECTED" : code === -32601 ? "RPC_METHOD_UNSUPPORTED"
    : code === -32602 ? "RPC_INVALID_PARAMETERS" : code === 4900 || code === 4901 ? "WALLET_DISCONNECTED" : "ARKIV_SUBMISSION_UNRESOLVED";
  return code === null ? reason : `${reason} (RPC ${code})`;
}
/** A receipt wait can fail after a wallet broadcast. Persist this hash before any retry. */
export function arkivBroadcastTransactionHash(error: unknown): string | null {
  return error instanceof EntityMutationError && typeof error.txHash === "string" && /^0x[0-9a-f]{64}$/i.test(error.txHash) ? error.txHash.toLowerCase() : null;
}
export async function writeArkivIntent(intentInput: PublicationIntent, accessKey: string, provider?: Eip1193,
  onBroadcast?: (transactionHash: `0x${string}`) => void,
  onDiagnostic?: (value: ArkivWriteDiagnostic) => void): Promise<Awaited<ReturnType<BriefmintArkivWriter["write"]>>> {
  if (!provider) throw new Error("A browser wallet is required for Arkiv publication.");
  const intent = await validatePublicationIntent(intentInput); const chain = await provider.request({ method: "eth_chainId" });
  if (BigInt(String(chain)) !== BigInt(BRIEFMINT_CHAIN_ID)) throw new Error("Switch the wallet to Arkiv Rabdi before publishing.");
  const accounts = await provider.request({ method: "eth_accounts" }); const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0].toLowerCase() : null;
  if (!address || address !== intent.ownerAddress.toLowerCase()) throw new Error("The connected wallet must be the approved brief owner.");
  let transactionHash: `0x${string}` | null = null;
  let nonceBeforeSend: string | null = null;
  let target: string | null = null;
  let calldataHash: `0x${string}` | null = null;
  let submissionStarted = false;
  let submissionFailure: unknown;
  const report = (phase: ArkivWriteDiagnostic["phase"], method: string, code: number | null = null) => {
    try { onDiagnostic?.({ phase, method, rpcCode: code, chainId: BRIEFMINT_CHAIN_ID, nonceBeforeSend,
      target, calldataHash, transactionHash, observedAt: new Date().toISOString() }); } catch { /* Do not retry a broadcast because diagnostics failed. */ }
  };
  const observedProvider: Eip1193 = { async request(args) {
    const sending = ["eth_sendTransaction", "wallet_sendTransaction", "eth_sendRawTransaction"].includes(args.method);
    // viem may fall back to wallet_sendTransaction after an eth_sendTransaction
    // error even with retryCount=0. Never forward a second ambiguous submission.
    if (sending && submissionStarted) throw submissionFailure ?? new Error("A transaction submission was already attempted; reconcile its outcome.");
    if (sending) submissionStarted = true;
    if (args.method === "eth_sendTransaction" || args.method === "wallet_sendTransaction") {
      const tx = args.params?.[0] as { to?: unknown; data?: unknown; nonce?: unknown } | undefined;
      target = typeof tx?.to === "string" && /^0x[0-9a-f]{40}$/i.test(tx.to) ? tx.to.toLowerCase() : null;
      calldataHash = typeof tx?.data === "string" && /^0x(?:[0-9a-f]{2})*$/i.test(tx.data) ? keccak256(tx.data as `0x${string}`) : null;
      let nonce = tx?.nonce;
      if (nonce === undefined) { try { nonce = await provider.request({ method: "eth_getTransactionCount", params: [address, "pending"] }); } catch { /* Nonce snapshot is advisory, not nonbroadcast proof. */ } }
      nonceBeforeSend = typeof nonce === "string" && /^0x[0-9a-f]+$/i.test(nonce) ? nonce.toLowerCase() : null;
    }
    if (sending) report("wallet_confirmation", args.method);
    let result: unknown;
    try { result = await provider.request(args); }
    catch (error) { if (sending) submissionFailure = error; report("rpc_failed", args.method, rpcCode(error)); throw error; }
    if (sending) {
      if (typeof result !== "string" || !/^0x[0-9a-f]{64}$/i.test(result)) {
        report("invalid_wallet_response", args.method);
        throw new Error("Wallet returned no valid broadcast identifier.");
      }
      transactionHash = result.toLowerCase() as `0x${string}`;
      // Save the hash before the SDK starts waiting for a receipt. A failed
      // recovery write must never turn a successful broadcast into a resend.
      try { onBroadcast?.(transactionHash); } catch { /* Receipt/error reconciliation remains available. */ }
      report("broadcast", args.method);
    }
    return result;
  } };
  const client = createWalletClient({ account: address as `0x${string}`, chain: rabdi({ accessKey }), transport: custom(observedProvider, { retryCount: 0 }) }); const values = briefmintOpportunityValues(intent.payload);
  const result = intent.operation === "create"
    ? await client.createEntity(BriefmintOpportunitySchema, values, { expiration: ExpirationTime.atBlock(BigInt(intent.expiresAtBlock)), flags: { readonly: false, permissionlessExtension: false } })
    : await client.patchEntity(BriefmintOpportunitySchema, intent.entityKey as `0x${string}`, { set: values });
  transactionHash = result.txHash;
  report("receipt_confirmed", "eth_getTransactionReceipt");
  return { transactionHash: result.txHash, entityKey: result.entityKey };
}
