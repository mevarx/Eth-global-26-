"use client";
// Public opportunities via the independent Arkiv reader.
// Works without a wallet session or the BriefMint API. An explicit Arkiv
// access key (operator-provided public rate-limit key, never committed)
// enables reads; failures stay distinct from an empty catalogue.
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/app/AppShell";
import OpportunityBoard from "@/components/briefs/OpportunityBoard";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import { fixtureOpportunities, fixtureStateFromSearch } from "@/components/opportunities/opportunity-format";
import { readOpportunitiesIndependent } from "@/lib/arkiv/opportunities-independent";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";
import { filterOpportunities } from "@/lib/shared/briefmint-validation";
import { devFixturesEnabled } from "@/lib/shared/fixtures";
import "@/components/opportunities/opportunities.css";

// Development fixtures (flag only): deterministic rows and states via ?state=loading|failed|empty|stale.
async function readFixtures(f: OpportunityFilters, refreshes: number): Promise<OpportunityView[]> {
  const state = fixtureStateFromSearch(window.location.search);
  if (state === "loading") return new Promise<OpportunityView[]>(() => {});
  if (state === "failed" || (state === "stale" && refreshes > 0)) throw new Error("fixture read failure");
  if (state === "empty") return [];
  return filterOpportunities(fixtureOpportunities(), { category: f.category, status: f.status });
}

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<OpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selected, setSelected] = useState<OpportunityView | null>(null);
  const [filters, setFilters] = useState<OpportunityFilters>({ status: "open" });
  const readEpoch = useRef(0);
  const rowCount = useRef(0);
  const reads = useRef(0);
  const fixtures = devFixturesEnabled();

  const load = useCallback(async (f: OpportunityFilters) => {
    const epoch = ++readEpoch.current;
    setLoading(true);
    setError(null);
    try {
      const list = fixtures
        ? await readFixtures(f, reads.current++)
        : await readOpportunitiesIndependent({ accessKey: "" }, f);
      if (epoch !== readEpoch.current) return;
      rowCount.current = list.length;
      setRows(list);
      setStale(false);
      setLastRefresh(new Date().toISOString());
      setSelected((prev) => list.find((row) => row.entityKey === prev?.entityKey) ?? list[0] ?? null);
    } catch {
      if (epoch !== readEpoch.current) return;
      if (rowCount.current > 0) {
        setStale(true);
        setError("Could not reach Arkiv, showing last confirmed results.");
      } else {
        setError("The indexed catalogue could not be read right now.");
      }
    } finally {
      if (epoch === readEpoch.current) setLoading(false);
    }
  }, [fixtures]);

  useEffect(() => {
    const timer = setTimeout(() => { void load({ status: "open" }); }, 0);
    return () => {
      clearTimeout(timer);
      readEpoch.current += 1;
    };
  }, [load]);

  const handleFilters = useCallback(
    (f: OpportunityFilters) => {
      setFilters(f);
      void load(f);
    },
    [load],
  );

  return (
    <AppShell>
      <div className="opp-page">
        <header className="opp-header bm-glass bm-glass--text">
          <div>
            <h1 className="bm-title-page">Public opportunities</h1>
            <p className="bm-secondary bm-measure">
              Indexed Arkiv records any application can discover. Reading works without the BriefMint API or a wallet session.
            </p>
          </div>
          {fixtures && <span className="bm-chip bm-chip--warn">FIXTURE DATA</span>}
        </header>
        <OpportunityBoard
          opportunities={rows}
          loading={loading}
          error={error}
          lastRefresh={lastRefresh}
          stale={stale}
          onRefresh={() => load(filters)}
          selected={selected}
          onSelect={setSelected}
          filters={filters}
          onFiltersChange={handleFilters}
        />
        <OpportunityReader />
      </div>
    </AppShell>
  );
}
