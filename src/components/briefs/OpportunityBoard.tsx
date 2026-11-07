"use client";
// Registry: real Arkiv opportunities through indexed queries.
// Failed reads stay distinct from an empty catalogue; a failed refresh never
// proves withdrawal or expiry. Closed records remain readable until expiry.
// Text search and budget presence filter client-side after the indexed fetch;
// category and status filter server-side through indexed fields.
// FIX 4: filter bar is a sticky Block, cards live in a BlockGrid of equal-size
// summary cards, and the selected opportunity opens a separate detail panel
// (sticky column or sheet) instead of expanding a card in place.
import { useEffect, useRef, useState } from "react";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
import { filterOpportunities } from "@/lib/shared/briefmint-validation";
import Block from "@/components/dashboard/Block";
import BlockGrid from "@/components/dashboard/BlockGrid";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import OpportunityFilterBar from "@/components/opportunities/OpportunityFilters";
import OpportunityDetailPanel from "@/components/opportunities/OpportunityDetailPanel";
import { EmptyPanel, FailedPanel, LoadingPanel, StaleBanner } from "@/components/opportunities/OpportunityStates";
import {
  DEFAULT_FILTERS,
  freshnessFor,
  parseTimestamp,
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
  onDeselect?: () => void;
  filters: OpportunityFilters;
  onFiltersChange: (f: OpportunityFilters) => void;
}

export function shortKey(key: string): string {
  return shortEntityKey(key);
}

export default function OpportunityBoard(p: OpportunityBoardProps) {
  const [query, setQuery] = useState("");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const f = p.filters;

  const visible = filterOpportunities(p.opportunities, { ...f, query });
  const hasRows = p.opportunities.length > 0;
  const freshness = freshnessFor(p.stale || (!!p.error && hasRows));
  const lastRefreshedAt = parseTimestamp(p.lastRefresh);
  const resetFilters = () => {
    setQuery("");
    p.onFiltersChange({ ...DEFAULT_FILTERS });
  };

  /* Track the sticky filter bar's height so the detail column sticks below
     nav + filter bar and never slides underneath it while scrolling. */
  useEffect(() => {
    const host = boardRef.current;
    if (!host) return;
    const bar = host.querySelector("[data-opp-filter]");
    if (!bar) return;
    const apply = () =>
      host.style.setProperty("--opp-filter-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      host.style.removeProperty("--opp-filter-h");
    };
  }, []);

  return (
    <div ref={boardRef} className="opp-board" aria-busy={p.loading}>
      <div className="opp-filter-slot" data-opp-filter="">
        <Block sticky ariaLabel="Filter opportunities">
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
        </Block>
      </div>
      {p.loading && !hasRows && <LoadingPanel />}
      {!p.loading && p.error && !hasRows && <FailedPanel message={p.error} onRetry={p.onRefresh} />}
      {!p.loading && hasRows && (p.stale || p.error) && <StaleBanner message={p.error} />}
      {!p.loading && !p.error && !hasRows && <EmptyPanel />}
      {!p.loading && !p.error && hasRows && visible.length === 0 && <EmptyPanel filtered onReset={resetFilters} />}
      {visible.length > 0 && (
        <div className={`opp-layout${p.selected ? " opp-layout--detail" : ""}`}>
          <BlockGrid as="ul" ariaLabel="Opportunities" className={`opp-cards${p.loading ? " opp-cards--busy" : ""}`}>
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
          </BlockGrid>
          {p.selected && (
            <OpportunityDetailPanel
              o={p.selected}
              freshness={freshness === "fresh" ? "fresh" : "stale"}
              lastRefreshedAt={lastRefreshedAt}
              onClose={p.onDeselect ?? (() => {})}
            />
          )}
        </div>
      )}
    </div>
  );
}
