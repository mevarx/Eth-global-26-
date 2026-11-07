"use client";
// Registry: real Arkiv opportunities through indexed queries.
// Failed reads stay distinct from an empty catalogue; a failed refresh never
// proves withdrawal or expiry. Closed records remain readable until expiry.
// Text search and budget presence filter client-side after the indexed fetch;
// category and status filter server-side through indexed fields.
// Presentation only: cards, filter bar and state panels live in components/opportunities.
import { useState } from "react";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
import { filterOpportunities } from "@/lib/shared/briefmint-validation";
import OpportunityCard, { CopyButton, BudgetText, FreshnessChip, OpportunityStatusChip } from "@/components/opportunities/OpportunityCard";
import OpportunityFilterBar from "@/components/opportunities/OpportunityFilters";
import { EmptyPanel, FailedPanel, LoadingPanel, StaleBanner } from "@/components/opportunities/OpportunityStates";
import {
  DEFAULT_FILTERS,
  checksumAddress,
  formatDeadline,
  formatRefresh,
  freshnessFor,
  parseTimestamp,
  safeHttpsUrl,
  shortKey as shortEntityKey,
} from "@/components/opportunities/opportunity-format";
import "@/components/opportunities/opportunities.css";

interface OpportunityBoardProps {
  opportunities: OpportunityView[];
  loading: boolean;
  error: string | null;
  lastRefresh: string | null;
  stale: boolean;
  onRefresh: () => void;
  selected: OpportunityView | null;
  onSelect: (o: OpportunityView) => void;
  filters: OpportunityFilters;
  onFiltersChange: (f: OpportunityFilters) => void;
}

export function shortKey(key: string): string {
  return shortEntityKey(key);
}

const LISTS = [
  ["deliverables", "Deliverables"],
  ["acceptanceCriteria", "Acceptance criteria"],
  ["exclusions", "Exclusions"],
  ["openQuestions", "Open questions"],
] as const;

function OpportunityDetail({ o, freshness, lastRefreshedAt }: { o: OpportunityView; freshness: "fresh" | "stale"; lastRefreshedAt: number | null }) {
  const owner = checksumAddress(o.ownerAddress);
  const contact = safeHttpsUrl(o.contactUrl);
  return (
    <aside className="opp-detail bm-glass bm-glass--text" aria-label="Selected opportunity">
      <h3 className="bm-title-panel">{o.title}</h3>
      <div className="opp-card__chips">
        <OpportunityStatusChip opportunity={o} />
        <FreshnessChip freshness={freshness} />
      </div>
      <p className="opp-detail__summary">{o.summary}</p>
      <dl className="opp-detail__facts">
        <div><dt>Owner</dt><dd>{owner ? <><span className="bm-mono">{owner}</span><CopyButton value={owner} label="owner address" /></> : "Address unavailable"}</dd></div>
        <div><dt>Entity key</dt><dd><span className="bm-mono">{o.entityKey}</span><CopyButton value={o.entityKey} label="entity key" /></dd></div>
        <div><dt>Advertised budget (unfunded)</dt><dd><BudgetText cents={o.budgetUsdCents} /></dd></div>
        <div><dt>Revision</dt><dd className="bm-num">r{o.revision}</dd></div>
        <div><dt>Deadline</dt><dd className="bm-num">{formatDeadline(o.deadline)}</dd></div>
        <div>
          <dt>Contact</dt>
          <dd>
            {contact
              ? <a className="opp-card__link" href={contact} target="_blank" rel="noopener noreferrer">{contact}<span className="bm-sr-only"> (opens in a new tab)</span></a>
              : (o.contactUrl ? "Not shown (not a valid HTTPS link)" : "None")}
          </dd>
        </div>
        <div><dt>Expires at block</dt><dd className="bm-mono">{o.expiresAtBlock ?? "not reported"}</dd></div>
      </dl>
      {LISTS.map(([key, label]) => (
        <section key={key} className="opp-detail__list">
          <h4>{label}</h4>
          {o[key].length > 0
            ? <ul>{o[key].map((text, index) => <li key={index}>{text}</li>)}</ul>
            : <p className="bm-muted">None listed.</p>}
        </section>
      ))}
      <p className="bm-muted">{formatRefresh(lastRefreshedAt)}</p>
      <p className="bm-muted">Anyone may reuse the namespace tag; only the actual owner address above can mutate this record. Content renders as untrusted text.</p>
    </aside>
  );
}

export default function OpportunityBoard(p: OpportunityBoardProps) {
  const [query, setQuery] = useState("");
  const f = p.filters;

  const visible = filterOpportunities(p.opportunities, { ...f, query });
  const hasRows = p.opportunities.length > 0;
  const freshness = freshnessFor(p.stale || (!!p.error && hasRows));
  const lastRefreshedAt = parseTimestamp(p.lastRefresh);
  const resetFilters = () => {
    setQuery("");
    p.onFiltersChange({ ...DEFAULT_FILTERS });
  };

  return (
    <div className="opp-board" aria-busy={p.loading}>
      <OpportunityFilterBar
        filters={f}
        onFiltersChange={p.onFiltersChange}
        query={query}
        onQueryChange={setQuery}
        onRefresh={p.onRefresh}
        loading={p.loading}
        shownCount={visible.length}
        totalCount={p.opportunities.length}
      />
      {p.loading && !hasRows && <LoadingPanel />}
      {!p.loading && p.error && !hasRows && <FailedPanel message={p.error} onRetry={p.onRefresh} />}
      {!p.loading && hasRows && (p.stale || p.error) && <StaleBanner message={p.error} />}
      {!p.loading && !p.error && !hasRows && <EmptyPanel />}
      {!p.loading && !p.error && hasRows && visible.length === 0 && <EmptyPanel filtered onReset={resetFilters} />}
      {(visible.length > 0 || p.selected) && (
        <div className="opp-layout">
          {visible.length > 0 && (
            <ul className={`opp-grid${p.loading ? " opp-grid--busy" : ""}`}>
              {visible.map((o) => (
                <li key={o.entityKey}>
                  <OpportunityCard
                    opportunity={o}
                    freshness={freshness}
                    lastRefreshedAt={lastRefreshedAt}
                    selected={p.selected?.entityKey === o.entityKey}
                    onSelect={p.onSelect}
                  />
                </li>
              ))}
            </ul>
          )}
          {p.selected && <OpportunityDetail o={p.selected} freshness={freshness === "fresh" ? "fresh" : "stale"} lastRefreshedAt={lastRefreshedAt} />}
        </div>
      )}
    </div>
  );
}
