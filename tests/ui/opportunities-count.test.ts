// FIX 7 unit tests: one count/state definition for every opportunity surface
// (city scan, city HUD panel, /opportunities page). Covers N (shown) vs M
// (all fetched rows, BEFORE filters), loading, failed, empty, no-match, stale
// and refreshing. Nothing here touches the network or the frozen contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countOpportunities, type OpportunityCountInput } from "../../src/components/opportunities-count";
import { fixtureOpportunities } from "../../src/components/opportunities/opportunity-format";
import type { OpportunityFilters, OpportunityView } from "../../src/lib/shared/briefmint";

/** The fixture catalogue provides full OpportunityView rows; map index to override. */
const make = (overrides: Array<Partial<OpportunityView>> = []): OpportunityView[] => {
  const catalog = fixtureOpportunities();
  const rows = catalog.map((r, i) => (overrides[i] ? { ...r, ...overrides[i] } : r));
  for (let i = catalog.length; i < overrides.length; i++) {
    rows.push({ ...catalog[0], entityKey: `0x${String(i).padStart(4, "0")}`, ...overrides[i] });
  }
  return rows;
};

const OPEN_WRITING: OpportunityFilters = { status: "open" };

const base: OpportunityCountInput = {
  rows: make([]), // 2 open + 1 closed fixture rows
  filters: OPEN_WRITING,
  query: "",
  loading: false,
  error: null,
  stale: false,
  hasRead: true,
};

test("N counts the filtered subset, M counts everything fetched before filters", () => {
  const rows = make([
    { title: "Admin guide one", status: "open" },
    { status: "closed" },
    { status: "closed" },
    { title: "Admin guide two", status: "closed" },
  ]);
  const r = countOpportunities({ ...base, rows, filters: OPEN_WRITING, query: "admin" });
  assert.equal(r.total, 4, "M ignores the status filter and search");
  assert.equal(r.shown, 1, "N applies the filters and search");
  assert.equal(r.state, "ready");
});

test("a loading first read is 'loading', never a bare 0", () => {
  const r = countOpportunities({ ...base, rows: [], loading: true, hasRead: false });
  assert.deepEqual(r, { shown: 0, total: 0, state: "loading", refreshing: false });
});

test("a failed read with nothing confirmed is 'failed', never 'empty'", () => {
  const r = countOpportunities({ ...base, rows: [], loading: false, error: "Arkiv read failed", hasRead: false });
  assert.equal(r.state, "failed");
  assert.equal(r.total, 0);
});

test("a confirmed empty catalogue is 'empty'", () => {
  const r = countOpportunities({ ...base, rows: [], hasRead: true });
  assert.equal(r.state, "empty");
  assert.equal(r.total, 0);
});

test("no-match: rows exist but the current filters hide all of them", () => {
  const rows = make([{ budgetUsdCents: 100 }, { budgetUsdCents: 100 }]);
  const r = countOpportunities({ ...base, rows, filters: { status: "open", category: "design", budget: "without" } });
  assert.equal(r.total, 3, "M is still every fetched row");
  assert.deepEqual({ shown: r.shown, state: r.state }, { shown: 0, state: "no-match" });
});

test("stale: a failed refresh keeps the confirmed list and is labelled stale", () => {
  const rows = make([{}, {}, {}]).slice(0, 2);
  const idle = countOpportunities({ ...base, rows, error: "Arkiv query failed", stale: true });
  assert.equal(idle.state, "stale");
  assert.equal(idle.total, 2);
  assert.equal(idle.shown, 2, "rows stay visible after a failed refresh");
  // A refresh over known rows keeps the list visible and marks it refreshing.
  const refreshing = countOpportunities({ ...base, rows, error: null, stale: false, loading: true });
  assert.equal(refreshing.state, "ready");
  assert.equal(refreshing.refreshing, true);
});
