// Pure helpers for the BriefMint glass panel (PRD §10 state model proxy:
// src/components/city/city-state.ts). No React, DOM, timers or I/O: unit-tested in tests/ui.
// Runtime imports are relative so the node:test build can resolve them.
import type {
  BriefSummary,
  BriefView,
  BriefmintConfig,
  OpportunityFilters,
  OpportunityView,
} from "../../lib/shared/briefmint";
import { cityInputFromBrief, deriveCityState, type CityStateInput } from "../city/city-state";
import {
  CITY_MIN_GLASS_OPACITY_FOR,
  DASHBOARD_MIN_TEXT_GLASS_OPACITY,
  TEXT_PRIMARY_HEX,
} from "../../lib/ui/contrast";

/* ------------------------------------------------------------------ tabs */

export type PanelTab = "overview" | "briefs" | "opportunities" | "explain";
export const PANEL_TABS: ReadonlyArray<{ id: PanelTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "briefs", label: "Briefs" },
  { id: "opportunities", label: "Opportunities" },
  { id: "explain", label: "Explain" },
];

/** Roving-tab keyboard model of the reference dashboard: arrows wrap, Home/End jump. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/* -------------------------------------------------------------- pipeline */

export type StageId = "compile" | "review" | "approve" | "publish";
export type StageState = "done" | "current" | "upcoming" | "blocked" | "stale" | "unavailable";

export interface PipelineStage {
  id: StageId;
  label: string;
  state: StageState;
  detail: string;
}

export const STAGE_STATE_LABEL: Record<StageState, string> = {
  done: "Done",
  current: "Current",
  upcoming: "Upcoming",
  blocked: "Needs attention",
  stale: "Stale read",
  unavailable: "Unavailable",
};

/**
 * Compile, Review, Approve, Publish from persisted state only (never a percentage).
 * Review is shown done only once the owner's approval of the current revision exists,
 * because the record has no separate "reviewed" flag.
 */
export function derivePipeline(input: CityStateInput): PipelineStage[] {
  const city = deriveCityState(input);
  const ready = input.execution === "ready";
  const approved = ready && input.review === "approved" && input.approvalCurrent;

  let compile: Pick<PipelineStage, "state" | "detail">;
  switch (input.execution) {
    case null:
      compile = { state: "upcoming", detail: "No brief saved yet." };
      break;
    case "draft":
      compile = { state: "current", detail: "Saved as a draft. Compilation has not started." };
      break;
    case "running":
      compile = { state: "current", detail: "Compilation is running. No time estimate is available." };
      break;
    case "failed":
      compile = { state: "blocked", detail: "Compilation failed. Open the brief for the error and retry eligibility." };
      break;
    case "interrupted":
      compile = { state: "blocked", detail: "Compilation was interrupted. Open the brief for retry eligibility." };
      break;
    default:
      compile = { state: "done", detail: "Compiled draft is saved." };
  }

  let review: Pick<PipelineStage, "state" | "detail">;
  if (!ready) review = { state: "upcoming", detail: "Waits for a compiled draft." };
  else if (approved) review = { state: "done", detail: "The public preview was reviewed and approved." };
  else if (input.review === "approved") {
    review = { state: "current", detail: "Edited since the last approval. Review the current revision." };
  } else review = { state: "current", detail: "Review the public preview of the compiled draft." };

  let approve: Pick<PipelineStage, "state" | "detail">;
  if (!ready) approve = { state: "upcoming", detail: "Waits for a compiled draft." };
  else if (approved) approve = { state: "done", detail: "This exact revision is approved by the owner." };
  else approve = { state: "upcoming", detail: "Approve the exact revision after review." };

  let publish: Pick<PipelineStage, "state" | "detail">;
  switch (city.registry) {
    case "none":
      publish = approved
        ? { state: "current", detail: "Approved. Ready to publish to Arkiv." }
        : { state: "upcoming", detail: "Needs an approved revision first." };
      break;
    case "pending":
      publish = { state: "current", detail: "Waiting for Arkiv confirmation. Not live until confirmed." };
      break;
    case "live":
      publish = {
        state: "done",
        detail: approved
          ? "Live on Arkiv, confirmed at the Registry Hall."
          : "Live on Arkiv. Edits stay unpublished until you approve and sign an update.",
      };
      break;
    case "closed":
      publish = { state: "done", detail: "Closed on Arkiv. The private brief remains available." };
      break;
    case "expired":
      publish = { state: "done", detail: "Expired on Arkiv, confirmed by query." };
      break;
    case "stale":
      publish = {
        state: "stale",
        detail: `Registry read is stale. Last confirmed status: ${city.registryLastConfirmed}. This is not closure or expiry.`,
      };
      break;
    default:
      publish = {
        state: "unavailable",
        detail: `Registry read is unavailable. Last confirmed status: ${city.registryLastConfirmed}. This is not closure or expiry.`,
      };
  }

  return [
    { id: "compile", label: "Compile", ...compile },
    { id: "review", label: "Review", ...review },
    { id: "approve", label: "Approve", ...approve },
    { id: "publish", label: "Publish", ...publish },
  ];
}

export function pipelineFromBrief(brief: BriefView | null): PipelineStage[] {
  return derivePipeline(cityInputFromBrief(brief));
}

/** The stage that needs the owner's (or the registry's) attention, or null. */
export function activeStage(stages: PipelineStage[]): PipelineStage | null {
  return stages.find((s) => s.state !== "done" && s.state !== "upcoming") ?? null;
}

/* ------------------------------------------------------------- readiness */

export type ReadinessState = "ok" | "unavailable" | "checking";
export interface ReadinessItem {
  id: "sign-in" | "compilation" | "arkiv";
  label: string;
  state: ReadinessState;
  detail: string;
}

export function deriveReadiness(config: BriefmintConfig | null, configError: string | null): ReadinessItem[] {
  const rows = [
    { id: "sign-in", label: "Sign-in", source: config?.auth.readiness },
    { id: "compilation", label: "Compilation", source: config?.compilation },
    { id: "arkiv", label: "Arkiv", source: config?.arkiv.readiness },
  ] as const;
  return rows.map(({ id, label, source }): ReadinessItem => {
    if (!config || !source) {
      return configError
        ? { id, label, state: "unavailable", detail: "BriefMint configuration could not be read." }
        : { id, label, state: "checking", detail: "Reading BriefMint configuration." };
    }
    return source.available
      ? { id, label, state: "ok", detail: "Ready." }
      : { id, label, state: "unavailable", detail: source.reason ?? "Reported unavailable by the backend." };
  });
}

export function sessionLabel(address: string | null, loading: boolean): string {
  if (address) return `Signed in as ${address.slice(0, 6)}…${address.slice(-4)}`;
  return loading ? "Checking sign-in…" : "Not signed in";
}

/* ------------------------------------------------------ public footprint */

export type FootprintValue =
  | { kind: "count"; value: number; stale: boolean; scope: string | null }
  | { kind: "unavailable"; reason: string }
  | { kind: "checking" };
export interface Footprint {
  live: FootprintValue;
  closed: FootprintValue;
}

export interface FootprintInput {
  ownerAddress: string | null;
  opportunities: OpportunityView[];
  loading: boolean;
  error: string | null;
  stale: boolean;
  /** ISO time of the last successful read; null = never read. */
  lastRefreshedAt: string | null;
  filters: OpportunityFilters;
}

/** The owner's live (open) and closed records, counted only from a real Arkiv read. */
export function derivePublicFootprint(i: FootprintInput): Footprint {
  const both = (v: FootprintValue): Footprint => ({ live: v, closed: v });
  if (!i.ownerAddress) return both({ kind: "unavailable", reason: "Sign in to see your own opportunities." });
  if (!i.lastRefreshedAt) {
    return both(i.loading && !i.error ? { kind: "checking" } : { kind: "unavailable", reason: "The Arkiv read failed." });
  }
  const owner = i.ownerAddress.toLowerCase();
  const mine = i.opportunities.filter((o) => o.ownerAddress.toLowerCase() === owner);
  const stale = i.stale || i.error !== null || mine.some((o) => o.freshness !== "fresh");
  const status = i.filters.status ?? "open";
  const category = i.filters.category && i.filters.category !== "all" ? i.filters.category : null;
  const scope = category ? `${category} only` : null;
  const count = (wanted: "open" | "closed", loaded: boolean): FootprintValue =>
    loaded
      ? { kind: "count", value: mine.filter((o) => o.status === wanted).length, stale, scope }
      : {
          kind: "unavailable",
          reason: `${wanted === "open" ? "Open" : "Closed"} records are not part of the current read. Set Status to All to count them.`,
        };
  return {
    live: count("open", status === "open" || status === "all"),
    closed: count("closed", status === "closed" || status === "all"),
  };
}

/* ------------------------------------------------------------ opportunities */

export type OpportunitiesViewKind = "loading" | "failed" | "stale" | "empty" | "no-match" | "ready";

/** Distinct states: a failed read is never "empty", and stale keeps the last confirmed list. */
export function opportunitiesViewState(i: {
  loading: boolean;
  error: string | null;
  stale: boolean;
  total: number;
  shown: number;
  hasRead: boolean;
}): { kind: OpportunitiesViewKind; refreshing: boolean } {
  if (i.total === 0) {
    if (i.loading) return { kind: "loading", refreshing: false };
    if (i.error) return { kind: "failed", refreshing: false };
    return { kind: i.hasRead ? "empty" : "loading", refreshing: false };
  }
  const refreshing = i.loading;
  if (i.stale || i.error) return { kind: "stale", refreshing };
  if (i.shown === 0) return { kind: "no-match", refreshing };
  return { kind: "ready", refreshing };
}

/* ------------------------------------------------------------------ briefs */

export type ChipTone = "ok" | "warn" | "danger" | "info" | "muted";
export interface StateChip {
  key: "execution" | "review" | "publication";
  label: string;
  tone: ChipTone;
}

export interface BriefStateLike {
  executionStatus: BriefSummary["executionStatus"];
  reviewStatus: BriefSummary["reviewStatus"];
  publicationStatus: BriefSummary["publicationStatus"];
  freshness: BriefSummary["freshness"];
}

export function chipsFromView(brief: BriefView): BriefStateLike {
  return {
    executionStatus: brief.executionStatus,
    reviewStatus: brief.review.status,
    publicationStatus: brief.publication.status,
    freshness: brief.publication.freshness,
  };
}

export function briefStateChips(s: BriefStateLike): StateChip[] {
  const execution: Record<BriefStateLike["executionStatus"], [string, ChipTone]> = {
    draft: ["Draft", "muted"],
    running: ["Compiling", "info"],
    ready: ["Compiled", "ok"],
    failed: ["Compile failed", "danger"],
    interrupted: ["Interrupted", "warn"],
  };
  const [execLabel, execTone] = execution[s.executionStatus];
  const chips: StateChip[] = [
    { key: "execution", label: execLabel, tone: execTone },
    s.reviewStatus === "approved"
      ? { key: "review", label: "Approved", tone: "ok" }
      : { key: "review", label: "Not approved", tone: "muted" },
  ];
  const p = s.publicationStatus;
  if (p === "unpublished") chips.push({ key: "publication", label: "Unpublished", tone: "muted" });
  else if (p === "pending") chips.push({ key: "publication", label: "Awaiting confirmation", tone: "warn" });
  else {
    const name = p === "live" ? "Live" : p === "closed" ? "Closed" : "Expired";
    if (s.freshness === "unavailable") {
      chips.push({ key: "publication", label: `${name}: read unavailable`, tone: "warn" });
    } else if (s.freshness === "stale") {
      chips.push({ key: "publication", label: `${name}: stale read`, tone: "warn" });
    } else {
      chips.push({ key: "publication", label: name, tone: p === "live" ? "ok" : "muted" });
    }
  }
  return chips;
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** Newest first by updatedAt; does not mutate its input. */
export function recentBriefs(briefs: BriefSummary[], limit = 3): BriefSummary[] {
  return [...briefs].sort((a, b) => time(b.updatedAt) - time(a.updatedAt)).slice(0, Math.max(0, limit));
}

/* ------------------------------------------------------------------ glass */
/* The glass look is FIXED at the reference "Frosted" defaults. The adjustable
 * settings provider is gone, so nothing reads any leftover viewer-preset
 * localStorage key. The fixed values live in src/styles/briefmint-tokens.css
 * (--bm-glass-*). Only the contrast mirrors stay here for the contrast tests. */

/** Worst case behind a city panel: white walls and surf foam (SA-9 contrast check). */
export const BRIGHTEST_SCENE_HEX = "#ffffff";
/** Smallest city opacity keeping text-primary at 4.5:1 over the brightest scene color (shared helper, no underlay credit). */
export const CITY_MIN_TEXT_GLASS_OPACITY = CITY_MIN_GLASS_OPACITY_FOR(TEXT_PRIMARY_HEX, BRIGHTEST_SCENE_HEX);
export { DASHBOARD_MIN_TEXT_GLASS_OPACITY };
/** Mirrors of the CSS recipe used by the contrast checks: `--bm-glass-underlay`, tint overlay and `.bmg-well`. */
export const GLASS_UNDERLAY_ALPHA = 0.35;
export const GLASS_TINT_ALPHA = 0.12;
export const GLASS_WELL_ALPHA = 0.7;
