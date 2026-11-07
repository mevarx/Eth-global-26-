"use client";
// Archive: owner-authenticated private briefs and saved revisions.
// Each row links to the private detail page; reopening never recompiles.
import Link from "next/link";
import type { BriefSummary } from "@/lib/shared/briefmint";

export function BriefStatusBadge({ status }: { status: string }) {
  return <span className="badge badge-info">{status}</span>;
}

export default function BriefList({ briefs }: { briefs: BriefSummary[] }) {
  if (briefs.length === 0) return <p className="tc-muted">No private briefs yet, save one at the Creator&apos;s Home.</p>;
  return (
    <ul className="job-list">
      {briefs.map((b) => (
        <li key={b.id}>
          <Link href={`/briefs/${b.id}`}>
            <BriefStatusBadge status={b.executionStatus} />{" "}
            <span className="badge">{b.category}</span>{" "}
            <span className="badge">{b.publicationStatus}</span>{" "}
            <strong>{b.title}</strong>{" "}
            <span className="tc-muted">r{b.draftRevision} · {b.reviewStatus}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
