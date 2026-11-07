"use client";
// Brief detail: private intake state, deliberate compilation (POST run, user
// action only, never on mount), structured review with saved revisions, exact
// public preview + approval, owner-signed publication with reconciliation,
// read-only chain refresh, and honest evidence. Polls while running/pending;
// reopening loads saved state.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/app/AppShell";
import BriefEvidence from "@/components/briefs/BriefEvidence";
import BriefReview from "@/components/briefs/BriefReview";
import OpportunityPublisher from "@/components/briefs/OpportunityPublisher";
import ReleaseDesk from "@/components/briefs/ReleaseDesk";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import { useBrief, useRefreshPublication } from "@/lib/client/use-briefs";
import { useSession } from "@/lib/client/use-session";

export default function BriefDetailPage() {
  const params = useParams();
  const raw = (params as Record<string, string | string[]>).id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const valid = typeof id === "string" && id.length > 0;
  const sessionQ = useSession();
  const briefQ = useBrief(valid ? id : undefined, sessionQ.address);
  const refreshPub = useRefreshPublication();
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!briefQ.data || !sessionQ.address) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await briefmintApi.runBrief(briefQ.data.id, sessionQ.address);
      await briefQ.refetch();
      void result;
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start compilation. Retry.");
      try { await briefQ.refetch(); } catch { /* Keep the last saved brief view. */ }
    } finally {
      setRunBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!briefQ.data || !sessionQ.address) return;
    setRunError(null);
    try {
      await refreshPub.mutateAsync(briefQ.data.id);
      await briefQ.refetch();
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}` : "Refresh failed.");
    }
  };

  let body: React.ReactNode;
  if (!valid) {
    body = <p className="error" role="alert">BAD_INPUT: invalid brief id.</p>;
  } else if (!sessionQ.address) {
    body = <p className="notice">Connect the project-owner wallet and sign in to open this brief.</p>;
  } else if (briefQ.isLoading) {
    body = <p className="tc-muted">Loading brief…</p>;
  } else if (briefQ.error) {
    const e = briefQ.error;
    if (isApiError(e) && e.status === 401) {
      body = <p className="notice">Connect the project-owner wallet and sign in to open this brief.</p>;
    } else if (isApiError(e) && e.status === 404) {
      body = <p className="error" role="alert">NOT_FOUND: no such brief for this owner.</p>;
    } else if (isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")) {
      body = <p className="notice" role="status">BriefMint backend unavailable (503), the saved brief cannot be reopened yet.</p>;
    } else {
      body = <p className="error" role="alert">{isApiError(e) ? `${e.code}: ${e.message}` : "Could not load the brief."}</p>;
    }
  } else if (!briefQ.data) {
    body = <p className="error" role="alert">NOT_FOUND: no such brief for this owner.</p>;
  } else {
    const brief = briefQ.data;
    const canStart = brief.executionStatus === "draft" || (brief.executionStatus === "failed" && brief.retryEligible);
    const approved = brief.review.status === "approved" && brief.review.approval?.draftRevision === brief.draftRevision;
    body = (
      <>
        <p>
          <span className="badge badge-info">{brief.executionStatus}</span>{" "}
          <span className="badge">{brief.review.status}</span>{" "}
          <span className="badge">{brief.publication.status}</span>{" "}
          <span className="tc-mono">{brief.id}</span>
        </p>
        {brief.error && <p className="error" role="alert">{brief.error.code}: {brief.error.message}</p>}
        {runError && <p className="error" role="alert">{runError}</p>}
        <div className="card">
          <h2>Private notes (owner-only, immutable after dispatch)</h2>
          {brief.inputSegments.map((s) => (
            <p key={s.id}><span className="tc-mono tc-muted">{s.id}</span>, {s.text}</p>
          ))}
        </div>
        {canStart && (
          <div className="card">
            <h2>{brief.executionStatus === "draft" ? "Start compilation" : "Retry compilation"}</h2>
            <p className="tc-muted">Runs once against the configured private model. Maximum bounded attempts; reopening never redispatches.</p>
            <button type="button" className="btn btn-primary" disabled={runBusy} onClick={handleRun}>
              {runBusy ? "Working…" : brief.executionStatus === "draft" ? "Start compilation" : "Retry compilation"}
            </button>
          </div>
        )}
        <div className="card">
          <h2>Review & revise</h2>
          <BriefReview brief={brief} onSaved={() => void briefQ.refetch()} />
        </div>
        <div className="card">
          <h2>Release Desk, approve exactly what publishes</h2>
          <ReleaseDesk key={`${brief.id}:${brief.draftRevision}`} brief={brief} onSaved={() => void briefQ.refetch()} />
        </div>
        <div className="card">
          <OpportunityPublisher brief={brief} onSaved={() => void briefQ.refetch()} rpcLabel="Rabdi 7794095" />
          <div className="btn-row">
            <button type="button" className="btn" disabled={refreshPub.isPending} onClick={handleRefresh}>
              {refreshPub.isPending ? "Refreshing…" : "Refresh chain observation"}
            </button>
          </div>
          {approved && <p className="tc-muted">Approved r{brief.draftRevision}, refresh re-reads the confirmed entity without signing or compiling.</p>}
        </div>
        <BriefEvidence brief={brief} />
      </>
    );
  }

  return (
    <AppShell>
      <div className="bm-dash-page">
        <header className="bm-glass bm-glass--text bm-dash-panel">
          <p><Link href="/briefs">← My Briefs</Link></p>
          <h1>Brief detail</h1>
        </header>
        <section className="bm-glass bm-glass--text bm-dash-panel" aria-label="Brief">
          {body}
        </section>
      </div>
    </AppShell>
  );
}
