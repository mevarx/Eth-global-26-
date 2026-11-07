"use client";
// Public opportunities via the independent Arkiv reader.
// Works without a wallet session or the BriefMint API. An explicit Arkiv
// access key (operator-provided public rate-limit key, never committed)
// enables reads; failures stay distinct from an empty catalogue.
// FIX 4: page built from the dashboard system — header block, filter block,
// results grid, detail panel (inside the board), developer reader block.
import { useCallback, useState } from "react";
import AppShell from "@/components/app/AppShell";
import PageShell from "@/components/dashboard/PageShell";
import Block from "@/components/dashboard/Block";
import OpportunityBoard from "@/components/briefs/OpportunityBoard";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import { FreshnessChip } from "@/components/opportunities/OpportunityCard";
import {
  formatRefresh,
  freshnessFor,
  parseTimestamp,
} from "@/components/opportunities/opportunity-format";
import { useOpportunities } from "@/components/use-opportunities-data";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
import { devFixturesEnabled } from "@/lib/shared/fixtures";
import "@/components/opportunities/opportunities.css";

export default function OpportunitiesPage() {
  // FIX 7: this page consumes the same shared opportunity source as the city
  // scan/panel (one hook, one shared cache and freshness value); only its
  // filter state stays local. Fixture previews via ?state= are handled in the source.
  const { rows, loading, error, stale, lastRefresh, refresh } = useOpportunities();
  const [picked, setPicked] = useState<OpportunityView | null>(null);
  const [filters, setFilters] = useState<OpportunityFilters>({ status: "open" });
  const fixtures = devFixturesEnabled();

  // Selection stays user-driven; the first row is the derived default and the
  // user's pick survives refreshes even when its row moves or vanishes.
  const selected = picked && rows.some((row) => row.entityKey === picked.entityKey) ? picked : rows[0] ?? null;

  const handleFilters = useCallback(
    (f: OpportunityFilters) => {
      setFilters(f);
      refresh(f);
    },
    [refresh],
  );

  const freshness = freshnessFor(stale || (!!error && rows.length > 0));
  const lastRefreshedAt = parseTimestamp(lastRefresh);

  return (
    <AppShell>
      <PageShell>
        <section className="bm-block bm-glass bm-glass--text opp-header" aria-label="Public opportunities">
          <div className="bm-block__head bm-block__head--baseline">
            <h1 className="bm-title opp-header__title">Public opportunities</h1>
            <span className="bm-block__action opp-header__meta">
              <FreshnessChip freshness={freshness} />
              {fixtures && <span className="bm-chip bm-chip--warn">FIXTURE DATA</span>}
              <span className="bm-muted opp-header__refresh">{formatRefresh(lastRefreshedAt)}</span>
            </span>
          </div>
          <div className="bm-block__body">
            <p className="bm-secondary bm-measure">
              Indexed Arkiv records any application can discover. Reading works without the BriefMint API or a wallet session.
            </p>
          </div>
        </section>
        <OpportunityBoard
          opportunities={rows}
          loading={loading}
          error={error}
          lastRefresh={lastRefresh}
          stale={stale}
          onRefresh={() => refresh(filters)}
          selected={selected}
          onSelect={setPicked}
          onDeselect={() => setPicked(null)}
          filters={filters}
          onFiltersChange={handleFilters}
        />
        <Block collapsible title="Developer reader" ariaLabel="Developer reader" className="opp-reader-block">
          <OpportunityReader />
        </Block>
      </PageShell>
    </AppShell>
  );
}
