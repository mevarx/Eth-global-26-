"use client";
// Owner publication: prepare an approved intent with the backend, sign the
// Arkiv write with the connected project-owner wallet, then reconcile the
// confirmed entity with the backend. A submitted transaction alone is never
// treated as success, `pending` stays until the server confirms owner,
// payload, revision, and expiry. Never requests a private key; signing
// happens in the browser wallet. Intent and broadcast identifiers are
// persisted locally (non-sensitive) before reporting success.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { assertPreparedIntentMatches, clearPublicationRecovery, readPublicationRecovery, storePublicationRecovery } from "@/lib/client/publication-recovery";
import { isApiError } from "@/lib/client/briefmint-api";
import { useSession } from "@/lib/client/use-session";
import { useArmPublication, useReconcilePublication, useRefreshPublication } from "@/lib/client/use-briefs";
import { currentSessionGeneration, isCurrentSessionGeneration } from "@/lib/client/session-generation";
import {
  arkivBroadcastTransactionHash,
  arkivFailureDiagnostic,
  writeArkivIntent,
  type ArkivWriteDiagnostic,
} from "@/lib/arkiv/briefmint/write";
import {
  hashPublicOpportunity,
  projectPublicOpportunity,
  validatePublicationIntent,
  type BriefView,
  type Hex,
} from "@/lib/shared/briefmint";

interface OpportunityPublisherProps {
  brief: BriefView | null;
  onSaved: (b: BriefView) => void;
  rpcLabel: string;
}

type Phase = "idle" | "preparing" | "signing" | "reconciling" | "pending" | "done" | "error";
type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function randomIntentId(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function readLocalRecovery(briefId: string, intentId: string) {
  try { return readPublicationRecovery(localStorage, briefId, intentId); } catch { return null; }
}

async function assertWalletReady(intent: Awaited<ReturnType<typeof validatePublicationIntent>>, provider: EthereumProvider): Promise<void> {
  const [accounts, rawChainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string"
    || accounts[0].toLowerCase() !== intent.ownerAddress.toLowerCase()) {
    throw new Error("Connect the project-owner wallet before starting a publication attempt.");
  }
  if (typeof rawChainId !== "string" || !/^0x[0-9a-fA-F]+$/.test(rawChainId)
    || Number(BigInt(rawChainId)) !== intent.chainId) {
    throw new Error("Switch the wallet to Arkiv Rabdi before starting a publication attempt.");
  }
}

export default function OpportunityPublisher({ brief, onSaved, rpcLabel }: OpportunityPublisherProps) {
  const router = useRouter();
  const { address } = useSession();
  const runInFlight = useRef(false);
  const [accessKey, setAccessKey] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [manualHash, setManualHash] = useState("");
  const [diagnostic, setDiagnostic] = useState<ArkivWriteDiagnostic | null>(null);
  const [acknowledgeCopy, setAcknowledgeCopy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const arm = useArmPublication();
  const reconcile = useReconcilePublication();
  const refresh = useRefreshPublication();

  if (!brief) return <p className="tc-muted">Approve a public revision at the Release Desk first.</p>;
  const approval = brief.review.status === "approved" ? brief.review.approval : null;
  const approved = approval !== null && approval.draftRevision === brief.draftRevision;
  const confirmed = brief.publication.confirmed;
  const pending = brief.publication.pending;
  const live = brief.publication.status === "live";
  const canCopy = approved && !brief.publicationCopy && !confirmed && pending?.state === "unknown"
    && !pending.transactionHash && !["preparing", "signing", "reconciling"].includes(phase);

  const createDemoCopy = async () => {
    if (!canCopy || !acknowledgeCopy || !approval || !address || runInFlight.current || copyBusy) return;
    if (pending && readLocalRecovery(brief.id, pending.intent.intentId)?.transactionHash) {
      setError("A broadcast hash exists in local recovery storage. Reconcile that known transaction before creating a demo copy."); return;
    }
    setCopyBusy(true); setError(null);
    try {
      const generation = currentSessionGeneration();
      const { briefmintApi } = await import("@/lib/client/briefmint-api");
      const copy = await briefmintApi.copyPublication(brief.id, { expectedRevision: brief.draftRevision,
        publicPayloadHash: approval.publicPayloadHash, acknowledgeDuplicateRisk: true }, address);
      if (isCurrentSessionGeneration(generation)) router.push(`/briefs/${copy.id}`);
    } catch (error) {
      setError(isApiError(error) ? `${error.code}: ${error.message}` : "Could not create the separate demo copy.");
    } finally { setCopyBusy(false); }
  };

  const run = async (operation: "create" | "update" | "close") => {
    if (runInFlight.current) return;
    runInFlight.current = true;
    setError(null);
    setPhase("preparing");
    try {
      const generation = currentSessionGeneration();
      if (!address || address.toLowerCase() !== brief.ownerAddress.toLowerCase()) throw new Error("Connect and sign in with the owner wallet first.");
      if (!brief.editedDraft) throw new Error("No saved draft to publish, compile and save first.");
      if (!approved) throw new Error("Only the currently approved revision can be published.");
      if (pending && pending.state !== "prepared") {
        throw new Error("This publication attempt is already uncertain or submitted. Reconcile it; do not sign again.");
      }
      if (pending && pending.intent.operation !== operation) {
        throw new Error("Resume the existing prepared publication operation first.");
      }
      if (typeof window === "undefined" || !(window as unknown as { ethereum?: EthereumProvider }).ethereum) {
        throw new Error("Install or unlock an EVM browser wallet first.");
      }
      const provider = (window as unknown as { ethereum: EthereumProvider }).ethereum;
      setPhase("preparing");
      const intentId = (pending?.intent.intentId as Hex | undefined) ?? randomIntentId();
      const reviewedPayload = projectPublicOpportunity(brief.editedDraft, brief.draftRevision);
      const hash = await hashPublicOpportunity(reviewedPayload);
      if (hash !== approval?.publicPayloadHash) throw new Error("The saved draft differs from its approval. Review and approve this exact revision again.");
      const { briefmintApi } = await import("@/lib/client/briefmint-api");
      const intent = await briefmintApi.preparePublication(brief.id, {
        intentId,
        expectedRevision: brief.draftRevision,
        publicPayloadHash: hash,
        operation,
      }, address);
      if (!isCurrentSessionGeneration(generation)) throw new Error("Wallet account changed during preparation. No signature was requested.");
      const checkedIntent = await validatePublicationIntent(intent);
      assertPreparedIntentMatches(checkedIntent, { intentId, operation, ownerAddress: brief.ownerAddress, payload: reviewedPayload, publicPayloadHash: hash });
      await assertWalletReady(checkedIntent, provider);
      storePublicationRecovery(localStorage, brief.id, { intentId, operation, transactionHash: null, entityKey: checkedIntent.entityKey as Hex | null });
      const armed = await arm.mutateAsync({
        id: brief.id,
        req: { intentId, transactionHash: null, entityKey: null },
      });
      if (isCurrentSessionGeneration(generation)) onSaved(armed.brief);
      if (!armed.pending || armed.brief.publication.pending?.intent.intentId !== intentId
        || armed.brief.publication.pending.state !== "unknown") {
        throw new Error("The server did not confirm the one-time signing arm; no wallet write was started.");
      }
      if (!isCurrentSessionGeneration(generation)) throw new Error("Wallet account changed after the attempt was armed. It is locked and no signature was requested.");
      setPhase("signing");
      let transactionHash: Hex;
      let entityKey: Hex | null;
      try {
        const receipt = await writeArkivIntent(checkedIntent, accessKey.trim(), provider, (hash) => {
          try { storePublicationRecovery(localStorage, brief.id, { intentId, operation, transactionHash: hash, entityKey: checkedIntent.entityKey as Hex | null }); } catch { /* Still persist to the server below. */ }
          // Record the observed broadcast immediately, without waiting for the
          // SDK's receipt polling. This endpoint only observes; it never sends.
          void briefmintApi.reconcilePublication(brief.id, { intentId, transactionHash: hash, entityKey: checkedIntent.entityKey }, address)
            .then((result) => { if (isCurrentSessionGeneration(generation)) onSaved(result.brief); })
            .catch(() => { /* Local hash remains available for explicit recovery. */ });
          if (isCurrentSessionGeneration(generation)) setLastTx(hash);
        }, (value) => {
          storePublicationRecovery(localStorage, brief.id, { intentId, operation, transactionHash: value.transactionHash,
            entityKey: checkedIntent.entityKey as Hex | null, diagnostic: value });
          if (isCurrentSessionGeneration(generation)) setDiagnostic(value);
        });
        transactionHash = receipt.transactionHash as Hex;
        entityKey = receipt.entityKey as Hex;
      } catch (e) {
        const uncertain = arkivBroadcastTransactionHash(e)
          ?? readLocalRecovery(brief.id, intentId)?.transactionHash;
        if (!uncertain) {
          setPhase("pending");
          setError(`${arkivFailureDiagnostic(e)}: no broadcast hash was returned. The attempt remains locked; do not sign again.`);
          return;
        }
        transactionHash = uncertain as Hex;
        entityKey = intent.entityKey as Hex | null;
        setLastTx(transactionHash);
        try { storePublicationRecovery(localStorage, brief.id, { intentId, operation, transactionHash, entityKey }); } catch { /* Server reconciliation below records the hash. */ }
        setPhase("reconciling");
        const result = await reconcile.mutateAsync({
          id: brief.id,
          req: { intentId, transactionHash, entityKey },
        });
        if (isCurrentSessionGeneration(generation)) onSaved(result.brief);
        if (result.pending) {
          setPhase("pending");
          setError("The transaction is still being confirmed. Its identifiers are saved; do not sign again.");
          return;
        }
        try { clearPublicationRecovery(localStorage, brief.id, intentId); } catch { /* Confirmed server state remains authoritative. */ }
        setPhase("done");
        return;
      }
      setLastTx(transactionHash);
      try { storePublicationRecovery(localStorage, brief.id, { intentId, operation, transactionHash, entityKey }); } catch { /* Server reconciliation below records the hash. */ }
      setPhase("reconciling");
      // Reconcile against the recorded approved intent; the server reads the
      // chain and confirms owner/payload/revision/expiry before marking live.
      const result = await reconcile.mutateAsync({
        id: brief.id,
        req: { intentId, transactionHash, entityKey },
      });
      if (isCurrentSessionGeneration(generation)) onSaved(result.brief);
      if (result.pending) {
        setPhase("pending");
        setError("The transaction is still being confirmed. Its identifiers are saved; do not sign again.");
        return;
      }
      try {
        clearPublicationRecovery(localStorage, brief.id, intentId);
      } catch {
        /* Local persistence is best-effort. */
      }
      setPhase("done");
    } catch (e) {
      setPhase("error");
      if (isApiError(e)) setError(`${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}`);
      else setError(e instanceof Error ? e.message : "Publication failed.");
    } finally {
      runInFlight.current = false;
    }
  };

  const recover = async () => {
    setError(null);
    const current = brief.publication.pending;
    if (!current || current.state === "prepared") return;
    const found = readLocalRecovery(brief.id, current.intent.intentId);
    const saved = found?.intentId === current.intent.intentId ? found : null;
    const priorDiagnostic = saved?.diagnostic;
    if (priorDiagnostic && ["wallet_confirmation", "broadcast", "rpc_failed", "invalid_wallet_response", "receipt_confirmed"].includes(priorDiagnostic.phase)
      && /^eth_[A-Za-z0-9_]{1,60}$/.test(priorDiagnostic.method)
      && (priorDiagnostic.rpcCode === null || Number.isSafeInteger(priorDiagnostic.rpcCode))) setDiagnostic(priorDiagnostic);
    const knownHash = current.transactionHash ?? saved?.transactionHash ?? null;
    const candidate = manualHash.trim().toLowerCase();
    const transactionHash = knownHash ?? (/^0x[0-9a-f]{64}$/.test(candidate) ? candidate as Hex : null);
    if (!transactionHash) {
      setError("No valid transaction hash is available. Obtain the actual hash from the wallet or explorer; the attempt remains locked.");
      setPhase("pending");
      return;
    }
    setPhase("reconciling");
    try {
      const generation = currentSessionGeneration();
      const result = await reconcile.mutateAsync({
        id: brief.id,
        req: {
          intentId: current.intent.intentId,
          transactionHash,
          entityKey: saved?.entityKey ?? current.intent.entityKey,
          ...(!current.transactionHash ? { recovery: true as const } : {}),
        },
      });
      if (isCurrentSessionGeneration(generation)) onSaved(result.brief);
      if (result.pending) {
        setPhase("pending");
        setError("The transaction is still unresolved. Keep the saved identifiers and do not sign again.");
        return;
      }
      clearPublicationRecovery(localStorage, brief.id, current.intent.intentId);
      setPhase("done");
    } catch (e) {
      setPhase("pending");
      setError(isApiError(e) ? `${e.code}: ${e.message}` : "Reconciliation is unavailable; keep the identifiers and do not sign again.");
    }
  };

  const doRefresh = async () => {
    setError(null);
    try {
      const generation = currentSessionGeneration();
      const updated = await refresh.mutateAsync(brief.id);
      if (isCurrentSessionGeneration(generation)) onSaved(updated);
    } catch (e) {
      setError(isApiError(e) ? `${e.code}: ${e.message}` : "Refresh failed.");
    }
  };

  return (
    <section aria-label="Arkiv publication">
      <h3>Owner-signed Arkiv publication</h3>
      {brief.publicationCopy && <p className="notice">Separate demo copy reusing the genuine generated draft from source revision R{brief.publicationCopy.sourceRevision}. No new inference was requested. The original publication remains unresolved and may still appear; this copy could duplicate it. Review and approve this copy separately.</p>}
      <p className="tc-muted">
        Signing wallet must be the project owner. Network: Arkiv Rabdi ({rpcLabel}). Once signing is armed, a declined or interrupted signature leaves the attempt locked until its outcome can be resolved.
      </p>
      <div className="form-field">
        <label htmlFor="arkiv-access-key">Arkiv access key (optional public rate-limit key; never committed)</label>
        <input
          id="arkiv-access-key"
          type="text"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="Leave empty for the rate-limited public endpoint"
          autoComplete="off"
        />
      </div>
      <p>
        Status: <span className="badge badge-info">{brief.publication.status}</span>{" "}
        <span className="badge">{brief.publication.freshness}</span>
        {pending && <span className="tc-muted">, intent {pending.state}; do not sign again while this attempt is unresolved.</span>}
      </p>
      {confirmed && (
        <p className="tc-mono tc-muted">
          Entity: {confirmed.entityKey} · r{confirmed.publicRevision} · {confirmed.status}
          {confirmed.expiresAtBlock ? ` · expires at block ${confirmed.expiresAtBlock}` : ""}
        </p>
      )}
      {lastTx && <p className="tc-mono tc-muted">Broadcast tx: {lastTx}, confirmation status is shown above.</p>}
      {diagnostic && <p className="tc-muted" role="status">Wallet stage: {diagnostic.phase} · {diagnostic.method}{diagnostic.rpcCode === null ? "" : ` · RPC ${diagnostic.rpcCode}`}</p>}
      {phase === "reconciling" && <p role="status">Reconciling on-chain entity with the backend…</p>}
      {phase === "pending" && <p role="status">Publication remains locked until the backend confirms its outcome.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {phase === "done" && <p className="notice" role="status">Reconciliation finished, see the confirmed status above.</p>}
      {pending && pending.state !== "prepared" && !pending.transactionHash && (
        <div className="form-field">
          <label htmlFor="arkiv-recovery-hash">Known transaction hash for recovery (optional; never invent one)</label>
          <input id="arkiv-recovery-hash" value={manualHash} onChange={(event) => setManualHash(event.target.value)} placeholder="0x… actual wallet or explorer hash" disabled={phase === "reconciling"} />
          <p className="tc-muted">Manual recovery verifies chain, sender, engine receipt and exact approved entity before binding the hash. This sends no transaction.</p>
        </div>
      )}
      {canCopy && (
        <div className="card">
          <p className="error">The original transaction may still appear. A separate demo copy creates a distinct brief/title and later intent/entity, with duplicate-publication risk. It does not recover or unlock this attempt.</p>
          <label><input type="checkbox" checked={acknowledgeCopy} onChange={(event) => setAcknowledgeCopy(event.target.checked)} disabled={copyBusy} /> I accept the duplicate risk and will review and approve the separate demo copy.</label>
          <button type="button" className="btn" onClick={createDemoCopy} disabled={!acknowledgeCopy || copyBusy || !address}>{copyBusy ? "Creating copy…" : "Create separate demo copy (no AI)"}</button>
        </div>
      )}
      <div className="btn-row">
        {pending?.state === "prepared" && (
          <button type="button" className="btn btn-primary" disabled={phase === "preparing" || phase === "signing" || phase === "reconciling" || arm.isPending} onClick={() => run(pending.intent.operation)}>
            Resume prepared signing attempt
          </button>
        )}
        {!pending && !confirmed && (
          <button type="button" className="btn btn-primary" disabled={phase === "preparing" || phase === "signing" || phase === "reconciling" || arm.isPending || reconcile.isPending} onClick={() => run("create")}>
            Sign publication (approved revision)
          </button>
        )}
        {!pending && live && (
          <>
            <button type="button" className="btn btn-primary" disabled={phase === "preparing" || phase === "signing" || phase === "reconciling" || arm.isPending || reconcile.isPending} onClick={() => run("update")}>
              Sign update (approved revision)
            </button>
            <button type="button" className="btn btn-danger" disabled={phase === "preparing" || phase === "signing" || phase === "reconciling" || arm.isPending || reconcile.isPending} onClick={() => run("close")}>
              Sign closure
            </button>
          </>
        )}
        {pending && pending.state !== "prepared" && (
          <button type="button" className="btn" disabled={phase === "reconciling" || reconcile.isPending} onClick={recover}>
            Reconcile existing attempt
          </button>
        )}
        <button type="button" className="btn" disabled={refresh.isPending} onClick={doRefresh}>
          {refresh.isPending ? "Refreshing…" : "Refresh chain observation"}
        </button>
      </div>
      {!approved && <p className="tc-muted">Publication prepares only the currently approved revision.</p>}
    </section>
  );
}
