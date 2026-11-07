// Pure helper checks for the opportunities UI: addresses, HTTPS links, status, freshness, budget, filters.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILTERS,
  checksumAddress,
  deriveStatus,
  fixtureOpportunities,
  fixtureStateFromSearch,
  formatBudget,
  formatDeadline,
  formatRefresh,
  freshnessFor,
  isDefaultFilters,
  parseTimestamp,
  safeHttpsUrl,
  shortAddress,
  shortKey,
  urlHost,
} from "../../src/components/opportunities/opportunity-format";

const LOWER = "0xd582d7c24528a3f0294acafa46fae6e797b76ab8";

test("addresses are checksummed and shortened; invalid values give null", () => {
  const full = checksumAddress(LOWER);
  assert.ok(full && /^0x[0-9a-fA-F]{40}$/.test(full));
  assert.notEqual(full, LOWER);
  assert.equal(full?.toLowerCase(), LOWER);
  const short = shortAddress(LOWER);
  assert.equal(short, `${full?.slice(0, 6)}…${full?.slice(-4)}`);
  assert.equal(shortAddress("0x1234"), null);
  assert.equal(checksumAddress("not an address"), null);
});

test("shortKey keeps short values and elides long entity keys", () => {
  assert.equal(shortKey("0xabc"), "0xabc");
  assert.equal(shortKey(`0x${"a1".repeat(32)}`), "0xa1a1a1…a1a1");
});

test("safeHttpsUrl accepts only plain https links", () => {
  assert.equal(safeHttpsUrl("https://example.org/apply"), "https://example.org/apply");
  assert.equal(urlHost("https://example.org/apply"), "example.org");
  for (const bad of [
    null, undefined, "", "   ", "http://example.org", "javascript:alert(1)", "data:text/html,x", "ftp://example.org",
    "https://user:pw@example.org", "//example.org", "example.org", "https://exa mple.org", "https://example.org/\u0000",
  ]) {
    assert.equal(safeHttpsUrl(bad), null, String(bad));
  }
});

test("status is open or closed unless a query confirmed expiry", () => {
  assert.equal(deriveStatus({ status: "open" }), "open");
  assert.equal(deriveStatus({ status: "closed" }), "closed");
  assert.equal(deriveStatus({ status: "open" }, true), "expired");
});

test("freshness reflects the stale flag", () => {
  assert.equal(freshnessFor(false), "fresh");
  assert.equal(freshnessFor(true), "stale");
});

test("dates and refresh times format deterministically and fail honestly", () => {
  assert.equal(parseTimestamp("2026-11-13T09:00:00.000Z"), Date.UTC(2026, 10, 13, 9));
  assert.equal(parseTimestamp("nope"), null);
  assert.equal(parseTimestamp(null), null);
  assert.match(formatDeadline("2026-11-13T09:00:00.000Z"), /13 Nov 2026/);
  assert.equal(formatDeadline("garbage"), "Deadline not readable");
  assert.match(formatRefresh(Date.UTC(2026, 10, 6, 10, 12), "UTC"), /^Last refreshed 6 Nov 2026, 10:12/);
  assert.equal(formatRefresh(null), "No successful refresh yet");
});

test("budget shows only an advertised amount", () => {
  assert.equal(formatBudget(null), null);
  assert.equal(formatBudget(-1), null);
  assert.equal(formatBudget(45000), "450");
  assert.equal(formatBudget(12050), "120.50");
});

test("default filters and fixture state parsing", () => {
  assert.deepEqual(DEFAULT_FILTERS, { status: "open" });
  assert.equal(isDefaultFilters(DEFAULT_FILTERS, ""), true);
  assert.equal(isDefaultFilters({ status: "open", category: "all", budget: "all" }, "  "), true);
  assert.equal(isDefaultFilters({ status: "closed" }, ""), false);
  assert.equal(isDefaultFilters({ status: "open", category: "design" }, ""), false);
  assert.equal(isDefaultFilters(DEFAULT_FILTERS, "poster"), false);
  assert.equal(fixtureStateFromSearch("?state=failed"), "failed");
  assert.equal(fixtureStateFromSearch("?state=bogus"), "ok");
  assert.equal(fixtureStateFromSearch(""), "ok");
});

test("fixture rows are well-formed and include an unsafe contact link to exercise the filter", () => {
  const rows = fixtureOpportunities();
  assert.ok(rows.length >= 3);
  assert.ok(rows.every((r) => shortAddress(r.ownerAddress) !== null && /^0x[0-9a-f]{64}$/.test(r.entityKey)));
  assert.ok(rows.some((r) => r.contactUrl && safeHttpsUrl(r.contactUrl) === null));
});
