// Pure model for the living districts: maps the owner's saved briefs and the public
// Arkiv opportunities onto the reserved record plots of the slot plan.
// No React, timers or randomness: same input, same output, stable order.
// Privacy: labels carry the PUBLIC title only, never notes, drafts' sections or model output.
import type { BriefFreshness, BriefView, OpportunityView } from "@/lib/shared/briefmint";
import {
  HOUSE_SLOTS,
  TOWER_SLOTS,
  slotsByRole,
  type RecordDistrict,
  type RecordPlotSlot,
  type VacantLotSlot,
} from "./slots";
import type { GridPt } from "./iso-layout";

export type BriefHouseState =
  | "draft"
  | "compiling"
  | "needs review"
  | "approved"
  | "publishing"
  | "live"
  | "closed"
  | "expired"
  | "failed"
  | "unknown";
export type OpportunityTowerState = "open" | "closed";

interface PlotBase {
  /** Brief id or Arkiv entity key. */
  id: string;
  /** Public title only. */
  label: string;
  slot: RecordPlotSlot;
  /** Short text glyph; state is never conveyed by colour alone. */
  glyph: string;
}
export interface BriefPlot extends PlotBase {
  kind: "brief-house";
  state: BriefHouseState;
}
export interface OpportunityPlot extends PlotBase {
  kind: "opportunity-tower";
  state: OpportunityTowerState;
}
export type Plot = BriefPlot | OpportunityPlot;

export interface DistrictInput {
  /** null = not loaded (or not readable). */
  briefs: BriefView[] | null;
  /** null = not loaded or the read failed. */
  opportunities: OpportunityView[] | null;
  freshness: BriefFreshness;
  signedIn: boolean;
}

export interface DistrictModel {
  houses: BriefPlot[];
  towers: OpportunityPlot[];
  vacant: VacantLotSlot[];
  /** Records beyond the slot plan count; shown as a "+N more" sign, never as buildings. */
  houseOverflow: number;
  towerOverflow: number;
  towerDistrict: { dimmed: boolean; notice: string | null };
  /** True once a real answer exists; arrival animation must not run for the first answer. */
  loaded: { houses: boolean; towers: boolean };
}

export const UNTITLED_BRIEF = "Untitled brief";
export const UNTITLED_OPPORTUNITY = "Untitled opportunity";
export const NOTICE_UNAVAILABLE = "Opportunities unavailable";
export const NOTICE_STALE = "Showing last confirmed results";

export const BRIEF_STATE_GLYPH: Record<BriefHouseState, string> = {
  draft: "✎",
  compiling: "…",
  "needs review": "◐",
  approved: "✓",
  publishing: "↑",
  live: "●",
  closed: "×",
  expired: "◌",
  failed: "!",
  unknown: "?",
};
export const OPPORTUNITY_STATE_GLYPH: Record<OpportunityTowerState, string> = {
  open: "▲",
  closed: "×",
};

/**
 * Brief state from persisted fields only. "live" needs reconciled Arkiv evidence AND a fresh
 * read; a transaction hash or a stale/failed read never proves it. "interrupted" shows as failed.
 */
export function deriveBriefState(b: BriefView): BriefHouseState {
  switch (b.executionStatus) {
    case "draft":
      return "draft";
    case "running":
      return "compiling";
    case "failed":
    case "interrupted":
      return "failed";
    case "ready":
      break;
    default:
      return "unknown";
  }
  const pub = b.publication;
  if (pub.status === "pending") return "publishing";
  if (pub.status === "live" || pub.status === "closed" || pub.status === "expired") {
    const c = pub.confirmed;
    const reconciled = Boolean(c?.entityKey && c.expiresAtBlock && c.observedAt);
    if (!reconciled) return pub.status === "live" ? "publishing" : "unknown";
    if (pub.freshness !== "fresh") return "unknown";
    return pub.status;
  }
  const approved =
    b.review.status === "approved" && b.review.approval !== null && b.review.approval.draftRevision === b.draftRevision;
  return approved ? "approved" : "needs review";
}

const lt = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function briefLabel(b: BriefView): string {
  const t = (b.editedDraft?.parameters.title ?? b.publicParameters?.title ?? "").trim();
  return t || UNTITLED_BRIEF;
}

function dedupe<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function buildHouses(briefs: BriefView[]): { plots: BriefPlot[]; overflow: number } {
  // Oldest first: a new brief takes the next free lot, so existing houses never move.
  const sorted = dedupe(briefs, (b) => b.id).sort((a, b) => lt(a.createdAt, b.createdAt) || lt(a.id, b.id));
  const plots = sorted.slice(0, HOUSE_SLOTS.length).map((b, i): BriefPlot => {
    const state = deriveBriefState(b);
    return { kind: "brief-house", id: b.id, state, label: briefLabel(b), slot: HOUSE_SLOTS[i], glyph: BRIEF_STATE_GLYPH[state] };
  });
  return { plots, overflow: Math.max(0, sorted.length - HOUSE_SLOTS.length) };
}

function buildTowers(opps: OpportunityView[]): { plots: OpportunityPlot[]; overflow: number } {
  // Open first, then nearest deadline, then entity key (payload fields only, never read times).
  const rank = (o: OpportunityView) => (o.status === "open" ? 0 : 1);
  const sorted = dedupe(opps, (o) => o.entityKey).sort(
    (a, b) => rank(a) - rank(b) || lt(a.deadline, b.deadline) || lt(a.entityKey, b.entityKey),
  );
  const plots = sorted.slice(0, TOWER_SLOTS.length).map((o, i): OpportunityPlot => {
    const state: OpportunityTowerState = o.status === "open" ? "open" : "closed";
    return {
      kind: "opportunity-tower",
      id: o.entityKey,
      state,
      label: o.title.trim() || UNTITLED_OPPORTUNITY,
      slot: TOWER_SLOTS[i],
      glyph: OPPORTUNITY_STATE_GLYPH[state],
    };
  });
  return { plots, overflow: Math.max(0, sorted.length - TOWER_SLOTS.length) };
}

const DISTRICT_ORDER: Record<RecordDistrict, number> = { "brief-house": 0, "opportunity-tower": 1 };

export function buildDistrictModel(input: DistrictInput): DistrictModel {
  const vacant = slotsByRole("vacant-record-lot").sort((a, b) => DISTRICT_ORDER[a.district] - DISTRICT_ORDER[b.district]);

  const housesLoaded = input.signedIn && input.briefs !== null;
  const houses = housesLoaded ? buildHouses(input.briefs ?? []) : { plots: [], overflow: 0 };

  // A failed read is "unavailable", never an empty district.
  const hasTowerData = input.freshness !== "unavailable" && input.opportunities !== null;
  const towers = hasTowerData ? buildTowers(input.opportunities ?? []) : { plots: [], overflow: 0 };
  let notice: string | null = null;
  if (input.freshness === "unavailable") notice = NOTICE_UNAVAILABLE;
  else if (input.freshness === "stale") notice = input.opportunities !== null ? NOTICE_STALE : NOTICE_UNAVAILABLE;

  return {
    houses: houses.plots,
    towers: towers.plots,
    vacant,
    houseOverflow: houses.overflow,
    towerOverflow: towers.overflow,
    towerDistrict: { dimmed: input.freshness !== "fresh", notice },
    loaded: { houses: housesLoaded, towers: hasTowerData },
  };
}

/**
 * Anchor of the "+N more" sign: a point just inside the front corner of the district's last
 * record plot (max gx, max gy of its rect). Half-open rect, so the point lies inside the slot.
 */
export function overflowAnchor(district: RecordDistrict): GridPt {
  const slots = district === "brief-house" ? HOUSE_SLOTS : TOWER_SLOTS;
  const r = slots[slots.length - 1].rect;
  return { gx: r.gx + r.w - 0.25, gy: r.gy + r.h - 0.25 };
}

export function plotAriaLabel(p: Plot): string {
  return `${p.kind === "brief-house" ? "Brief" : "Opportunity"}: ${p.label}, ${p.state}`;
}
