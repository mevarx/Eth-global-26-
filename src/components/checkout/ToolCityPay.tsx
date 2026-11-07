"use client";
// Buyer checkout, Agent B owned. Exact sequence per the frontend contract:
//  1. require the connected account to equal job.buyerAddress,
//  2. switch to Whitechain (terms chain),
//  3. read ERC-20 allowance owner->checkout; if below the amount, approve
//     exactly the required amount and wait for the approval receipt,
//  4. call purchase(jobId, serviceId, amount, termsHash) via the compiled ABI,
//  5. POST the hash to verify-payment, polling with backoff on 202,
//  6. report the server-returned job via onJobChange.
// Declined/failed transactions are recoverable UI state. This component never
// calls inference and never starts a purchase on mount or refresh.
import { useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { checkoutAbi } from "@/lib/shared/checkout-abi";
import type { JobView, ToolCityPayProps } from "@/lib/shared/domain";
import { sameAddress } from "@/lib/shared/validation";
import { ApiError } from "@/lib/client/api-client";
import { useVerifyPayment } from "@/lib/client/use-job";
import { WHITECHAIN_ID } from "@/lib/client/wallet-config";

type Phase =
  | "idle"
  | "switching"
  | "approving"
  | "purchasing"
  | "verifying"
  | "done"
  | "error";

const PAYABLE = ["awaiting_payment", "payment_pending"] as const;

/** Render an atomic token amount without floating point. */
export function formatAtomic(amountAtomic: string, decimals: number): string {
  const digits = amountAtomic.replace(/[^0-9]/g, "") || "0";
  if (decimals <= 0) return digits.replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(decimals + 1, "0");
  const head = (padded.slice(0, -decimals) || "0").replace(/^0+(?=\d)/, "");
  const tail = padded.slice(-decimals).replace(/0+$/, "");
  return tail ? `${head}.${tail}` : head;
}

function isUserRejection(e: unknown): boolean {
  const code = (e as { code?: unknown }).code;
  if (code === 4001) return true;
  const name = (e as { name?: unknown }).name;
  return typeof name === "string" && name.includes("UserRejected");
}

function shortHex(v: string): string {
  return v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

export default function ToolCityPay({ job, onJobChange }: ToolCityPayProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: WHITECHAIN_ID });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const verifyPayment = useVerifyPayment();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const terms = job.terms;
  const payable = (PAYABLE as readonly string[]).includes(job.status);
  const isBuyer = !!address && sameAddress(address, job.buyerAddress);
  const busy = phase === "switching" || phase === "approving" || phase === "purchasing" || phase === "verifying" || verifyPayment.isPending;

  const phaseLabel: Record<Phase, string> = {
    idle: `Pay ${formatAtomic(terms.amountAtomic, terms.tokenDecimals)} test USDT`,
    switching: "Switching to Whitechain…",
    approving: "Approving test USDT…",
    purchasing: "Purchasing on Whitechain…",
    verifying: "Confirming payment with server…",
    done: "Payment verified",
    error: "Retry payment",
  };

  async function handlePay() {
    if (busy) return;
    setError(null);
    try {
      if (!address) {
        setPhase("error");
        setError("Connect the buyer wallet first.");
        return;
      }
      if (!sameAddress(address, job.buyerAddress)) {
        setPhase("error");
        setError(
          `Connected wallet ${address} is not this job's buyer ${job.buyerAddress}. Switch accounts to pay.`,
        );
        return;
      }
      if (!payable) {
        setPhase("error");
        setError(`Job is ${job.status}; no payment is due. Reload the saved job instead.`);
        return;
      }
      let amount: bigint;
      try {
        amount = BigInt(terms.amountAtomic);
      } catch {
        setPhase("error");
        setError("Job terms carry an invalid amount; cannot purchase.");
        return;
      }
      if (amount <= 0n) {
        setPhase("error");
        setError("Job terms carry a non-positive amount; cannot purchase.");
        return;
      }

      // 2. Buyer pays on Whitechain.
      if (chainId !== terms.chainId) {
        setPhase("switching");
        try {
          await switchChainAsync({ chainId: terms.chainId });
        } catch (e) {
          throw new Error(
            isUserRejection(e)
              ? "Network switch declined. Stay on Whitechain to pay."
              : `Could not switch to chain ${terms.chainId}. Switch manually and retry.`,
          );
        }
      }
      if (!publicClient) {
        setPhase("error");
        setError("Whitechain client unavailable. Reconnect the wallet and retry.");
        return;
      }

      // 3. Allowance, then exact-amount approval with receipt wait.
      const allowance = (await publicClient.readContract({
        address: terms.tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [job.buyerAddress, terms.checkoutAddress],
      })) as bigint;
      if (allowance < amount) {
        setPhase("approving");
        let approveHash: `0x${string}`;
        try {
          approveHash = await writeContractAsync({
            address: terms.tokenAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [terms.checkoutAddress, amount],
          });
        } catch (e) {
          throw new Error(
            isUserRejection(e)
              ? "Approval declined. No funds moved; retry when ready."
              : "Approval transaction failed. No funds moved; retry when ready.",
          );
        }
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 4. Purchase via the compiled checkout ABI (never a plain transfer).
      setPhase("purchasing");
      let txHash: `0x${string}`;
      try {
        txHash = await writeContractAsync({
          address: terms.checkoutAddress,
          abi: checkoutAbi,
          functionName: "purchase",
          args: [job.id, terms.serviceId, amount, terms.termsHash],
        });
      } catch (e) {
        throw new Error(
          isUserRejection(e)
            ? "Purchase declined. No payment recorded; retry when ready."
            : "Purchase transaction failed (reverted or dropped). No payment recorded; retry when ready.",
        );
      }

      // 5. Server verification with backoff on 202; only the server marks paid.
      setPhase("verifying");
      const serverJob: JobView = await verifyPayment.mutateAsync({ jobId: job.id, txHash });
      setPhase("done");
      onJobChange(serverJob);
    } catch (e) {
      setPhase("error");
      if (e instanceof ApiError) {
        setError(
          e.code === "PAYMENT_MISMATCH"
            ? `Server rejected the payment proof: ${e.message} Check the transaction and retry verification.`
            : `Server error (${e.code}): ${e.message}${e.retryable ? " Retry shortly." : ""}`,
        );
      } else {
        setError(e instanceof Error ? e.message : "Payment failed for an unknown reason.");
      }
    }
  }

  return (
    <section aria-label="Tool City checkout">
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 0.75rem" }}>
        <dt>Price</dt>
        <dd style={{ margin: 0 }}>
          {formatAtomic(terms.amountAtomic, terms.tokenDecimals)} test USDT
        </dd>
        <dt>Token</dt>
        <dd style={{ margin: 0 }} title={terms.tokenAddress}>
          {shortHex(terms.tokenAddress)}
        </dd>
        <dt>Checkout</dt>
        <dd style={{ margin: 0 }} title={terms.checkoutAddress}>
          {shortHex(terms.checkoutAddress)} (chain {terms.chainId})
        </dd>
        <dt>Buyer</dt>
        <dd style={{ margin: 0 }} title={job.buyerAddress}>
          {shortHex(job.buyerAddress)}
          {address ? (isBuyer ? " (connected)" : " (mismatch)") : ""}
        </dd>
      </dl>

      {job.payment && (
        <p>
          On-chain reference: <span title={job.payment.txHash}>{shortHex(job.payment.txHash)}</span>{" "}
          ({job.payment.status}
          {job.payment.blockNumber ? `, block ${job.payment.blockNumber}` : ""}).
          {job.payment.status === "verified"
            ? " Server-verified; start or reopen the translation from the job screen."
            : " Submitted; verification pending."}
        </p>
      )}

      {!payable && !job.payment && <p>Job status is {job.status}; no payment action is available.</p>}

      {(payable || phase === "error") && (
        <button type="button" disabled={busy || !address || !isBuyer} onClick={handlePay}>
          {phaseLabel[phase]}
        </button>
      )}

      {address && !isBuyer && payable && (
        <p role="alert">
          Connected wallet is not this job&apos;s buyer. Switch to the buyer account to pay.
        </p>
      )}
      {chainId !== terms.chainId && payable && (
        <p role="status">Buyer checkout runs on Whitechain (chain {terms.chainId}).</p>
      )}
      {phase === "error" && error && <p role="alert">{error}</p>}
      {phase === "done" && (
        <p role="status">Payment recorded. Start translation from the job screen.</p>
      )}
    </section>
  );
}
