// Pure count semantics for the opportunity list (FIX 7). No React, no fetch.
// One shared definition so every surface (city HUD, home page, /opportunities)
// reports the same N/M/State: N counts records inside the current filters and
// search, M counts everything the source returned BEFORE those filters, a
// loading read reports "loading" (never "0"), a failed first read is "failed"
// (never "empty"), and a failed refresh over existing rows is "stale" (the
// confirmed list stays visible).
import { filterOpportunities } from "../lib/shared/briefmint-validation";
import type { OpportunityFilters, OpportunityView } from "../lib/shared/briefmint";

export type OpportunityListState = "loading" | "failed" | "stale" | "empty" | "no-match" | "ready";

export interface OpportunityCountInput {
  /** Every record the source returned in the last completed read, BEFORE filtering. */
  rows: OpportunityView[];
  filters: OpportunityFilters;
  /** Room for the client-side search text, empty string defaults for filters. */
  query?: string;
  loading: boolean;
  error: string | null;
  /** True only when a failed refresh left an earlier confirmed list visible. */
  stale: boolean;
  /** True once at least one read ever completed (lastRefresh !== null). */
  hasRead: boolean;
}

export interface OpportunityCountResult {
  /** N: records inside the current filters (+search). */
  shown: number;
  /** M: all fetched records before filters — never the filtered subset. */
  total: number;
  state: OpportunityListState;
  /** True while a refresh is running on top of an already visible list. */
  refreshing: boolean;
}

export function countOpportunities(i: OpportunityCountInput): OpportunityCountResult {
  const total = i.rows.length;
  // A first read with nothing confirmed yet: loading and failure are distinct
  // states — never a bare "0 of 0" while the read is in flight.
  if (total === 0) {
    if (i.loading) return { shown: 0, total, state: "loading", refreshing: false };
    if (i.error) return { shown: 0, total, state: "failed", refreshing: false };
    if (!i.hasRead) return { shown: 0, total, state: "loading", refreshing: false };
    return { shown: 0, total, state: "empty", refreshing: false };
  }
  const visible = filterOpportunities(i.rows, { ...i.filters, query: i.query ?? "" });
  if (i.loading) {
    // Refreshing over known rows keeps the list; a real error turns it stale.
    return { shown: visible.length, total, state: i.error || i.stale ? "stale" : "ready", refreshing: true };
  }
  if (i.error || i.stale) return { shown: visible.length, total, state: "stale", refreshing: false };
  if (visible.length === 0) return { shown: 0, total, state: "no-match", refreshing: false };
  return { shown: visible.length, total, state: "ready", refreshing: false };
}
