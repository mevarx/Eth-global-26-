"use client";
// Distinct, honest states for the catalogue: loading, failed read, empty, stale, no filter match.
// A failed read never looks like an empty catalogue.
import { CircleAlert, Clock, Compass, SearchX } from "lucide-react";
import "./opportunities.css";

export function LoadingPanel({ count = 6 }: { count?: number }) {
  return (
    <div className="opp-state-wrap" aria-busy="true">
      <p className="bm-sr-only" role="status">Querying Arkiv indexed records…</p>
      <div className="opp-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="opp-skeleton bm-glass bm-glass--text">
            <span className="opp-skeleton__bar opp-skeleton__bar--chip" />
            <span className="opp-skeleton__bar opp-skeleton__bar--title" />
            <span className="opp-skeleton__bar" />
            <span className="opp-skeleton__bar opp-skeleton__bar--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FailedPanel({ message, onRetry, busy }: { message: string; onRetry: () => void; busy?: boolean }) {
  return (
    <section className="opp-state opp-state--danger bm-glass bm-glass--text" role="alert">
      <CircleAlert size={22} aria-hidden="true" className="opp-state__icon" />
      <div>
        <h3 className="bm-title-panel">Could not reach Arkiv (unavailable)</h3>
        <p className="bm-secondary">{message}</p>
        <p className="bm-secondary">This is a failed read, not an empty catalogue. Nothing has been withdrawn or expired.</p>
        <button type="button" className="bm-btn bm-btn--primary" onClick={onRetry} disabled={busy}>Try again</button>
      </div>
    </section>
  );
}

export function StaleBanner({ message }: { message?: string | null }) {
  return (
    <section className="opp-state opp-state--warn bm-glass bm-glass--text" role="status">
      <Clock size={22} aria-hidden="true" className="opp-state__icon" />
      <div>
        <h3 className="bm-title-panel">Showing last confirmed results (stale)</h3>
        <p className="bm-secondary">{message ?? "Could not reach Arkiv, so these results may be out of date."}</p>
      </div>
    </section>
  );
}

export function EmptyPanel({ onReset, filtered }: { onReset?: () => void; filtered?: boolean }) {
  return (
    <section className="opp-state opp-state--info bm-glass bm-glass--text" role="status">
      {filtered ? <SearchX size={22} aria-hidden="true" className="opp-state__icon" /> : <Compass size={22} aria-hidden="true" className="opp-state__icon" />}
      <div>
        {filtered ? (
          <>
            <h3 className="bm-title-panel">No records match these filters</h3>
            <p className="bm-secondary">Try a different category, status or search term.</p>
            {onReset && <button type="button" className="bm-btn" onClick={onReset}>Reset filters</button>}
          </>
        ) : (
          <>
            <h3 className="bm-title-panel">No opportunities published yet</h3>
            <p className="bm-secondary">The public catalogue is empty. This is not an error.</p>
            <p className="bm-secondary">Next step: turn a private note into a brief in the city, approve it, and publish it for others to find.</p>
          </>
        )}
      </div>
    </section>
  );
}
