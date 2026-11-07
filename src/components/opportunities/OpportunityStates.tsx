"use client";
// Distinct, honest states for the catalogue: loading, failed read, empty, stale, no filter match.
// A failed read never looks like an empty catalogue. FIX 4: every state is its
// own Block with a single sentence-case title and tone accent.
import { CircleAlert, Clock, Compass, SearchX } from "lucide-react";
import Block from "@/components/dashboard/Block";
import BlockGrid from "@/components/dashboard/BlockGrid";
import "./opportunities.css";

export function LoadingPanel({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading opportunities">
      <p className="bm-sr-only">Querying Arkiv indexed records…</p>
      <BlockGrid as="ul">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <div className="opp-skeleton bm-glass bm-glass--text" aria-hidden="true">
              <span className="opp-skeleton__bar opp-skeleton__bar--chip" />
              <span className="opp-skeleton__bar opp-skeleton__bar--title" />
              <span className="opp-skeleton__bar" />
              <span className="opp-skeleton__bar opp-skeleton__bar--short" />
            </div>
          </li>
        ))}
      </BlockGrid>
    </div>
  );
}

export function FailedPanel({ message, onRetry, busy }: { message: string; onRetry: () => void; busy?: boolean }) {
  return (
    <Block
      tone="danger"
      role="alert"
      icon={CircleAlert}
      title="Could not reach Arkiv (unavailable)"
      ariaLabel="Failed read"
    >
      <p className="bm-secondary">{message}</p>
      <p className="bm-secondary">This is a failed read, not an empty catalogue. Nothing has been withdrawn or expired.</p>
      <button type="button" className="bm-btn bm-btn--primary" onClick={onRetry} disabled={busy}>Try again</button>
    </Block>
  );
}

export function StaleBanner({ message }: { message?: string | null }) {
  return (
    <Block
      tone="warn"
      role="status"
      icon={Clock}
      title="Showing last confirmed results (stale)"
      ariaLabel="Stale results"
    >
      <p className="bm-secondary">{message ?? "Could not reach Arkiv, so these results may be out of date."}</p>
    </Block>
  );
}

export function EmptyPanel({ onReset, filtered }: { onReset?: () => void; filtered?: boolean }) {
  return (
    <Block
      tone="info"
      role="status"
      icon={filtered ? SearchX : Compass}
      title={filtered ? "No records match these filters" : "No opportunities published yet"}
      ariaLabel={filtered ? "No filter matches" : "Empty catalogue"}
    >
      {filtered ? (
        <>
          <p className="bm-secondary">Try a different category, status or search term.</p>
          {onReset && <button type="button" className="bm-btn" onClick={onReset}>Reset filters</button>}
        </>
      ) : (
        <>
          <p className="bm-secondary">The public catalogue is empty. This is not an error.</p>
          <p className="bm-secondary">Next step: turn a private note into a brief in the city, approve it, and publish it for others to find.</p>
        </>
      )}
    </Block>
  );
}
