"use client";
// Release Desk: exact public preview + explicit approval.
// Approval binds the canonical public payload hash and the saved revision;
// any later public-content edit invalidates it. Public preview is allowlist
// only, private notes, source IDs, and database IDs never appear here.
// Hashing is async (Web Crypto SHA-256 per the frozen contract).
import { useEffect, useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { useApproveBrief } from "@/lib/client/use-briefs";
import { currentSessionGeneration, isCurrentSessionGeneration } from "@/lib/client/session-generation";
import {
  hashPublicOpportunity,
  projectPublicOpportunity,
  type BriefView,
  type PublicOpportunity,
} from "@/lib/shared/briefmint";

export default function ReleaseDesk({ brief, onSaved }: { brief: BriefView | null; onSaved: (b: BriefView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const approve = useApproveBrief();

  const candidate = brief?.editedDraft ?? null;
  let preview: PublicOpportunity | null = null;
  let previewError: string | null = null;
  if (brief && candidate) {
    try {
      preview = projectPublicOpportunity(candidate, brief.draftRevision);
    } catch (e) {
      previewError = e instanceof Error ? e.message : "Cannot build public preview.";
    }
  }
  const payloadForHash = preview;

  // Keyed by brief+revision from the parent, so this runs once per revision.
  useEffect(() => {
    let cancelled = false;
    if (payloadForHash) {
      hashPublicOpportunity(payloadForHash)
        .then((h) => {
          if (!cancelled) setHash(h);
        })
        .catch(() => {
          if (!cancelled) setHash(null);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!brief) return <p className="tc-muted">Save a private brief at the Creator&apos;s Home first.</p>;
  if (!candidate || !preview) {
    if (previewError) return <p className="error" role="alert">{previewError}</p>;
    return <p className="tc-muted">Nothing compiled to preview yet, run compilation at the AI Studio.</p>;
  }

  const approval = brief.review.status === "approved" ? brief.review.approval : null;
  const current = approval !== null && approval.draftRevision === brief.draftRevision;
  const stale = approval !== null && !current;

  const doApprove = async () => {
    setError(null);
    const generation = currentSessionGeneration();
    try {
      const shown = projectPublicOpportunity(candidate, brief.draftRevision);
      const publicPayloadHash = await hashPublicOpportunity(shown);
      const updated = await approve.mutateAsync({
        id: brief.id,
        req: { expectedRevision: brief.draftRevision, publicPayloadHash },
      });
      if (!isCurrentSessionGeneration(generation)) return;
      onSaved(updated);
    } catch (e) {
      if (isApiError(e) && e.status === 409) setError("CONFLICT: revision changed, review the current preview before approving.");
      else setError(isApiError(e) ? `${e.code}: ${e.message}` : "Approval failed.");
    }
  };

  return (
    <div>
      <h3>Exact public preview (revision r{preview.revision}, status {preview.status})</h3>
      {stale && (
        <p className="error" role="alert">
          Approval invalidated: the public candidate changed after approval. Review and approve the current revision before publishing.
        </p>
      )}
      {current && approval && (
        <p className="notice" role="status">
          Approved by <span className="tc-mono">{approval.approvedBy}</span> at {approval.approvedAt}. Hash{" "}
          <span className="tc-mono">{approval.publicPayloadHash.slice(0, 18)}…</span>
        </p>
      )}
      <dl>
        <div><dt>Title</dt><dd>{preview.title}</dd></div>
        <div><dt>Summary</dt><dd>{preview.summary}</dd></div>
        <div><dt>Category / language</dt><dd>{preview.category} / {preview.language}</dd></div>
        <div><dt>Budget (unfunded)</dt><dd>{preview.budgetUsdCents === null ? "not advertised" : `$${(preview.budgetUsdCents / 100).toFixed(2)} (${preview.budgetUsdCents}¢)`}</dd></div>
        <div><dt>Contact</dt><dd className="tc-mono">{preview.contactUrl ?? "none"}</dd></div>
        <div><dt>Deadline</dt><dd className="tc-mono">{preview.deadline}</dd></div>
      </dl>
      {(["deliverables", "acceptanceCriteria", "exclusions", "openQuestions"] as const).map((k) => (
        <div key={k}>
          <h4 style={{ textTransform: "capitalize" }}>{k}</h4>
          {preview[k].length === 0 ? <p className="tc-muted">None.</p> : <ul>{preview[k].map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </div>
      ))}
      <p className="tc-muted">
        Canonical hash: <span className="tc-mono">{hash ?? "computing…"}</span>
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={approve.isPending || current || hash === null} onClick={doApprove}>
          {approve.isPending ? "Approving…" : current ? "Approved (current)" : `Approve revision r${preview.revision} for publication`}
        </button>
      </div>
      <p className="tc-muted">Approval records the exact payload hash above. Publishing a different revision requires a new approval.</p>
    </div>
  );
}
