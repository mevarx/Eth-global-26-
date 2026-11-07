// Pure presentation helpers for the opportunities UI. No DOM, no network.
// Runtime imports are relative so tests/ui can compile this module on its own.
import { getAddress } from "viem";
import type { OpportunityFilters, OpportunityView } from "../../lib/shared/briefmint";

export type Freshness = "fresh" | "stale" | "unavailable";
export type OpportunityStatus = "open" | "closed" | "expired";
export type FixtureState = "ok" | "loading" | "failed" | "empty" | "stale";

export const DEFAULT_FILTERS: OpportunityFilters = { status: "open" };

export function isDefaultFilters(filters: OpportunityFilters, query: string): boolean {
  return (
    (filters.category ?? "all") === "all" &&
    (filters.status ?? "open") === "open" &&
    (filters.budget ?? "all") === "all" &&
    query.trim() === ""
  );
}

/** EIP-55 checksummed address, or null when the value is not a valid address. */
export function checksumAddress(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

/** Shortened checksummed address (0xD582…6aB8); null when invalid. */
export function shortAddress(address: string): string | null {
  const full = checksumAddress(address);
  return full ? `${full.slice(0, 6)}…${full.slice(-4)}` : null;
}

export function shortKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : key;
}

/** Returns a normalised URL only for plain HTTPS links without credentials. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 2048 || /[\u0000-\u001f\u007f\s]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Hostname of a validated HTTPS URL, for compact display. */
export function urlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** "expired" only when a query has actually confirmed it; never inferred from a clock. */
export function deriveStatus(o: Pick<OpportunityView, "status">, confirmedExpired = false): OpportunityStatus {
  if (confirmedExpired) return "expired";
  return o.status === "closed" ? "closed" : "open";
}

export function freshnessFor(stale: boolean): Freshness {
  return stale ? "stale" : "fresh";
}

export function parseTimestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    ...(timeZone ? { timeZone } : {}), timeZoneName: "short",
  }).format(new Date(ms));
}

export function formatDeadline(iso: string): string {
  const ms = parseTimestamp(iso);
  return ms === null ? "Deadline not readable" : formatDateTime(ms, "UTC");
}

export function formatRefresh(ms: number | null | undefined, timeZone?: string): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "No successful refresh yet";
  return `Last refreshed ${formatDateTime(ms, timeZone)}`;
}

/** Advertised (unfunded) budget in whole units, or null when none is advertised. */
export function formatBudget(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents) || cents < 0) return null;
  const units = cents / 100;
  const text = Number.isInteger(units)
    ? units.toLocaleString("en-US")
    : units.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return text;
}

export function fixtureStateFromSearch(search: string): FixtureState {
  const value = new URLSearchParams(search).get("state");
  return value === "loading" || value === "failed" || value === "empty" || value === "stale" ? value : "ok";
}

const FIXTURE_OWNER = "0x000000000000000000000000000000000000dEaD" as const;

/** Labelled development rows; callers must show FIXTURE DATA and gate on fixturesEnabled. */
export function fixtureOpportunities(): OpportunityView[] {
  const base = {
    ownerAddress: FIXTURE_OWNER,
    language: "en" as const,
    exclusions: [],
    openQuestions: ["Who reviews the final draft?"],
    contactUrl: null,
    revision: 1,
    expiresAtBlock: "587315",
    observedAtBlock: "587000",
    observedAt: "2026-11-06T09:00:00.000Z",
    fetchedAt: "2026-11-06T09:00:00.000Z",
    freshness: "fresh" as const,
  };
  return [
    {
      ...base, entityKey: `0x${"a1".repeat(32)}` as const, title: "Onboarding guide for a community project",
      summary: "Write a beginner-friendly setup guide with reproducible steps and a short FAQ.",
      deliverables: ["Markdown setup guide", "FAQ with ten questions"],
      acceptanceCriteria: ["Steps are reproducible", "Plain language"],
      category: "writing" as const, status: "open" as const, budgetUsdCents: 45000,
      contactUrl: "https://example.org/apply", deadline: "2026-11-20T09:00:00.000Z",
    },
    {
      ...base, entityKey: `0x${"b2".repeat(32)}` as const, title: "Launch poster set",
      summary: "Design three poster layouts for a community launch event, print-ready and accessible.",
      deliverables: ["Three poster layouts"], acceptanceCriteria: ["Contrast meets guidance"],
      category: "design" as const, status: "open" as const, budgetUsdCents: null, deadline: "2026-11-27T12:00:00.000Z",
    },
    {
      ...base, entityKey: `0x${"c3".repeat(32)}` as const, title: "Newsletter editing pass",
      summary: "Edit a four-page newsletter for tone and clarity.",
      deliverables: ["Edited newsletter"], acceptanceCriteria: ["Consistent tone"],
      category: "writing" as const, status: "closed" as const, budgetUsdCents: 12050, deadline: "2026-11-12T17:30:00.000Z",
      contactUrl: "http://insecure.example.org/not-shown",
    },
  ];
}
