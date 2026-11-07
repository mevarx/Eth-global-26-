"use client";
// FIX 7: the ONE shared opportunity data source. The city home page (HUD +
// scan cards), the districts and the /opportunities page all read this hook:
// one module cache, one in-flight read, one freshness value, so the surfaces
// can no longer disagree (a failed real read used to show "0 open" beside a
// fixtures-backed page that showed an open opportunity).
//
// The underlying read implementation is unchanged: readOpportunitiesIndependent
// (frozen contract). Filters stay per-surface; the fetched rows (M) are shared.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readOpportunitiesIndependent } from "@/lib/arkiv/opportunities-independent";
import { devFixturesEnabled } from "@/lib/shared/fixtures";
import { fixtureOpportunities, fixtureStateFromSearch } from "@/components/opportunities/opportunity-format";
import type { OpportunityFilters, OpportunityView } from "@/lib/shared/briefmint";

export interface OpportunitiesSnapshot {
  /** Everything the source returned in the last completed read, BEFORE filtering. */
  rows: OpportunityView[];
  loading: boolean;
  error: string | null;
  /** Failed refresh with an earlier confirmed list still visible. */
  stale: boolean;
  /** ISO time of the last completed read; null = never read. */
  lastRefresh: string | null;
}

const FAILED_FIRST = "Arkiv query failed. The catalogue could not be read right now; this does not mean records were withdrawn or expired.";
const FAILED_REFRESH = "Arkiv query failed, showing last confirmed list (stale). This does not mean records were withdrawn.";

const emptySnapshot: OpportunitiesSnapshot = { rows: [], loading: false, error: null, stale: false, lastRefresh: null };
let snapshot: OpportunitiesSnapshot = emptySnapshot;
const listeners = new Set<() => void>();
let epoch = 0;
let fixtureReads = 0;
let started = false;

function getSnapshot(): OpportunitiesSnapshot {
  return snapshot;
}
function getServerSnapshot(): OpportunitiesSnapshot {
  return emptySnapshot;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function setSnapshot(patch: Partial<OpportunitiesSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

// Flag-only development fixtures (NEXT_PUBLIC_ENABLE_DEV_FIXTURES): labelled
// rows and ?state=loading|failed|empty|stale previews, same helper the fixtures
// visual checks use. No fixtures = the real independent Arkiv reader.
async function readSource(f: OpportunityFilters): Promise<OpportunityView[]> {
  if (devFixturesEnabled()) {
    const state = fixtureStateFromSearch(window.location.search);
    if (state === "loading") return new Promise<OpportunityView[]>(() => {});
    if (state === "failed" || (state === "stale" && fixtureReads > 0)) throw new Error("fixture read failure");
    if (state === "empty") return [];
    fixtureReads++;
    return fixtureOpportunities().filter((o) => {
      if (f.status && f.status !== "all" && o.status !== f.status) return false;
      if (f.category && f.category !== "all" && o.category !== f.category) return false;
      return true;
    });
  }
  return readOpportunitiesIndependent({ accessKey: "" }, f);
}

/** Kick off (or re-run) the shared read: one place, epoch-guarded. */
export function loadOpportunities(f: OpportunityFilters): void {
  const id = ++epoch;
  setSnapshot({ loading: true, error: null });
  void (async () => {
    try {
      const list = await readSource(f);
      if (id !== epoch) return;
      setSnapshot({ rows: list, loading: false, stale: false, error: null, lastRefresh: new Date().toISOString() });
    } catch {
      if (id !== epoch) return;
      if (snapshot.rows.length > 0) {
        setSnapshot({ loading: false, stale: true, error: FAILED_REFRESH });
      } else {
        setSnapshot({ loading: false, stale: false, error: FAILED_FIRST });
      }
    }
  })();
}

const DEFAULT_INITIAL: OpportunityFilters = { status: "open" };

export interface UseOpportunitiesResult extends OpportunitiesSnapshot {
  /** Run a fresh shared read with the surface's filters. */
  refresh: (f: OpportunityFilters) => void;
  /** True once the shared source read at least once (lastRefresh set or error). */
  hasRead: boolean;
}

export function useOpportunities(): UseOpportunitiesResult {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The first consumer on a page starts the initial open-records read; later
  // mounts reuse the shared cache and never duplicate it.
  useEffect(() => {
    if (!started) {
      started = true;
      loadOpportunities(DEFAULT_INITIAL);
    }
  }, []);
  const refresh = useCallback((f: OpportunityFilters) => {
    loadOpportunities(f);
  }, []);
  return { ...snap, hasRead: snap.lastRefresh !== null || (snap.error !== null && !snap.loading), refresh };
}
