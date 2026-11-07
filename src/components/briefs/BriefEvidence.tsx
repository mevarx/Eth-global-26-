"use client";
// Honest compilation evidence: requested policy, Router-reported verification,
// and independent verification stay separate. Null means unknown, never success.
import type { BriefView } from "@/lib/shared/briefmint";

export default function BriefEvidence({ brief }: { brief: BriefView }) {
  const ev = brief.evidence;
  return (
    <div className="card">
      <h3>Compilation evidence</h3>
      {brief.publicationCopy && <p className="notice">Generation reused from the original brief, revision R{brief.publicationCopy.sourceRevision}. This copy made no inference request; the request evidence below belongs to that original generation.</p>}
      <dl>
        <div><dt>Execution</dt><dd>{brief.executionStatus} · attempts used {brief.attemptsUsed}{brief.retryEligible ? " · retry eligible" : ""}</dd></div>
        <div><dt>Review</dt><dd>{brief.review.status}{brief.review.status === "approved" ? ` · approved r${brief.review.approval.draftRevision}` : ""}</dd></div>
        <div><dt>Publication</dt><dd>{brief.publication.status} ({brief.publication.freshness})</dd></div>
      </dl>
      <h4>0G private request</h4>
      {ev ? (
        <dl>
          <div><dt>Request ID</dt><dd className="tc-mono">{ev.requestId ?? "not reported"}</dd></div>
          <div><dt>Model</dt><dd className="tc-mono">{ev.modelId ?? "not reported"}</dd></div>
          <div><dt>Provider</dt><dd className="tc-mono">{ev.providerId ?? "not reported"}</dd></div>
          <div><dt>Routing tier</dt><dd>{ev.routingTier ?? "not reported"}</dd></div>
          <div><dt>Private routing requested</dt><dd>{ev.privateRoutingRequested ? "yes" : "no"}</dd></div>
          <div><dt>Fallbacks allowed</dt><dd>{ev.fallbacksAllowed ? "yes" : "no"}</dd></div>
          <div><dt>Verification requested</dt><dd>{ev.verificationRequested ? "yes" : "no"}</dd></div>
          <div><dt>Router-reported verification</dt><dd>
            {ev.routerVerification === null || ev.routerVerification === undefined ? (
              <span className="badge">not reported, not verified</span>
            ) : ev.routerVerification ? (
              <span className="badge badge-ready">router reports verified</span>
            ) : (
              <span className="badge badge-bad">router reports unverified</span>
            )}
          </dd></div>
          <div><dt>Independent response verification</dt><dd>
            {ev.independentResponseVerification === "unavailable" ? (
              <span className="badge">not performed, unknown</span>
            ) : ev.independentResponseVerification === "verified" ? (
              <span className="badge badge-ready">independently verified</span>
            ) : (
              <span className="badge badge-bad">independent check failed</span>
            )}
          </dd></div>
          <div><dt>Response reference</dt><dd className="tc-mono">{ev.responseReference ?? "not reported"}</dd></div>
          <div><dt>Checked at</dt><dd className="tc-mono">{ev.checkedAt ?? "not reported"}</dd></div>
          {ev.sanitizedFailureReason && <div><dt>Failure detail</dt><dd>{ev.sanitizedFailureReason}</dd></div>}
        </dl>
      ) : (
        <p className="tc-muted">Compilation evidence unavailable, not reported, not success.</p>
      )}
      {brief.error && <p className="error" role="alert">{brief.error.code}: {brief.error.message}</p>}
      <p className="tc-muted">Private notes and model internals are never exposed here. Verification labels distinguish what was requested, what the Router reported, and what was independently checked.</p>
    </div>
  );
}
