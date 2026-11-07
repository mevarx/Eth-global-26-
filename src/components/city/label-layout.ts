// Pure screen-space label layout for the city scene (no DOM, no pixi, no randomness).
// Labels sit above their anchor (roof apex), are nudged in a fixed candidate order to
// avoid each other, building bodies, HUD rectangles and (softly) road tiles, and are
// clamped to the viewport. Same inputs always give the same output.
import { worldToScreen, type Camera, type Pt } from "./camera-store";
import { isoGeometry } from "./iso-geometry";
import { keyBuildingDef } from "./iso-buildings";
import { isRoadCell } from "./iso-layout";
import { BUILDINGS, type BuildingId } from "./scene-config";

export type LabelKind = "building" | "plot" | "landmark" | "scenery";

export interface LabelSpec {
  id: string;
  text: string;
  kind: LabelKind;
  /** World px (iso-layout toWorld space). */
  anchor: Pt;
  /** Screen px; initial estimate, the DOM layer replaces it with measured sizes. */
  width: number;
  height: number;
  /** Higher is placed first; non-building labels are hidden rather than overlap. */
  priority: number;
  ariaLabel?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelPlacement {
  id: string;
  /** Screen px, top-left of the plate. */
  x: number;
  y: number;
  pinFrom: Pt;
  pinTo: Pt;
  hidden: boolean;
}

export interface LayoutOptions {
  /** Viewport inset for plates (default 8). */
  margin?: number;
  /** Extra clearance kept between plates and obstacles (default 4). */
  pad?: number;
  /** Screen px between plate bottom and anchor, per kind. */
  gaps?: Partial<Record<LabelKind, number>>;
  /** World-space obstacle rectangles; a rect whose id equals a label id is ignored for that label. Defaults to the five building bodies. */
  bodies?: Array<{ id: string; rect: Rect }>;
  /** Hide non-building labels below this camera zoom. */
  minZoom?: Partial<Record<LabelKind, number>>;
  /** Penalise plates covering road tiles (default true). */
  avoidRoads?: boolean;
}

export const BUILDING_ARIA: Record<BuildingId, string> = {
  home: "Planning Desk: write private notes and public parameters",
  studio: "AI Studio: private compilation",
  treasury: "Release Desk: review and approve the exact public revision",
  registry: "Registry Hall: publish to Arkiv, update or close",
  archive: "Archive: reopen private briefs",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Plate font size in px for a camera zoom; whole pixels so plates re-measure rarely. */
export function labelFontPx(zoom: number, kind: LabelKind = "building"): number {
  const px = Math.round(10 + 5 * zoom);
  return kind === "building" ? clamp(px, 12, 16) : clamp(px, 12, 14);
}

/** Camera zoom the engine's fit() produces before its start multiplier. */
export function fitZoomFor(viewportW: number, viewportH: number, reserve: number): number {
  const bw = 1280; // BOUNDS in city-engine: GRID_N * 40 + 80
  const bh = 780;
  return Math.min((viewportW - reserve) / bw, viewportH / bh) * 0.98;
}

interface BuildingGeo {
  id: BuildingId;
  name: string;
  anchor: Pt;
  /** Stepped silhouette: narrow roof above, full-width walls below. */
  body: Rect[];
}

function buildingGeos(): BuildingGeo[] {
  return BUILDINGS.map((b) => {
    const def = keyBuildingDef(b.id);
    const g = isoGeometry(def);
    // Roof apex (hip) or the roof's top corner (flat), same lift the engine draws.
    const y = Math.min(g.apex.y, g.Tt.y - 6);
    return {
      id: b.id,
      name: def.name,
      anchor: { x: def.cx, y },
      body: [
        { x: def.cx - def.hw / 2, y, w: def.hw, h: g.Lt.y - y },
        { x: def.cx - def.hw, y: g.Lt.y, w: def.hw * 2, h: g.B.y - g.Lt.y },
      ],
    };
  });
}

const GEOS = buildingGeos();

/** Roof-apex world anchor for each working building, from the geometry the engine draws. */
export function labelAnchorsForBuildings(): Array<{ id: BuildingId; name: string; anchor: Pt }> {
  return GEOS.map((g) => ({ id: g.id, name: g.name, anchor: { ...g.anchor } }));
}

/** World-space silhouette rectangles (two per building: roof, walls) of the five buildings. */
export function buildingBodies(): Array<{ id: string; rect: Rect }> {
  return GEOS.flatMap((g) => g.body.map((rect) => ({ id: g.id, rect: { ...rect } })));
}

/** Rough plate size before the DOM can measure it (Inter 600, uppercase tracking). */
export function estimateLabelSize(text: string, kind: LabelKind, fontPx: number, hasTag = false): { width: number; height: number } {
  const building = kind === "building";
  const padX = building ? 14 : 10;
  const padY = building ? 7 : 4;
  const line = Math.ceil(fontPx * 1.25);
  const width = Math.ceil(text.length * fontPx * (building ? 0.72 : 0.6)) + padX * 2;
  const height = line + padY * 2 + (hasTag ? 12 + 3 : 0);
  return { width, height };
}

/** Specs for the five working buildings; sizes are estimates until the layer measures them. */
export function buildingLabelSpecs(zoom = 1): LabelSpec[] {
  const px = labelFontPx(zoom);
  return GEOS.map((g) => {
    const text = g.name.toUpperCase();
    return {
      id: g.id,
      text,
      kind: "building" as const,
      anchor: { ...g.anchor },
      ...estimateLabelSize(text, "building", px),
      priority: 100,
      ariaLabel: BUILDING_ARIA[g.id],
    };
  });
}

const DEFAULT_GAPS: Record<LabelKind, number> = { building: 22, plot: 10, landmark: 12, scenery: 8 };

// Candidate nudges (screen px), fixed order: nearest to the preferred spot first.
function candidates(dxs: number[], dys: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const dy of dys) for (const dx of dxs) out.push([dx, dy]);
  return out.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) * 1.5 - (Math.abs(b[0]) + Math.abs(b[1]) * 1.5) || a[1] - b[1] || a[0] - b[0]);
}
const range = (from: number, to: number, step: number) => {
  const r: number[] = [];
  for (let v = from; v <= to; v += step) r.push(v);
  return r;
};
const NEAR = candidates(range(-64, 64, 16), range(-40, 0, 10));
const FAR = candidates(range(-320, 320, 16), range(-144, 0, 12));

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const inflate = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 });

/** Fraction of the rect's sample points that land on a road tile. */
function roadFraction(r: Rect, c: Camera): number {
  const step = 8;
  let hit = 0;
  let n = 0;
  for (let sy = r.y + step / 2; sy < r.y + r.h; sy += step) {
    for (let sx = r.x + step / 2; sx < r.x + r.w; sx += step) {
      const wx = (sx - c.x) / c.z;
      const wy = (sy - c.y) / c.z;
      const gx = Math.floor((wx / 20 + wy / 10) / 2);
      const gy = Math.floor((wy / 10 - wx / 20) / 2);
      n++;
      if (isRoadCell(gx, gy)) hit++;
    }
  }
  return n ? hit / n : 0;
}

export function layoutLabels(
  specs: LabelSpec[],
  camera: Camera,
  viewport: { w: number; h: number },
  avoidRects: Rect[] = [],
  opts: LayoutOptions = {},
): LabelPlacement[] {
  const margin = opts.margin ?? 8;
  const pad = opts.pad ?? 4;
  const gaps = { ...DEFAULT_GAPS, ...opts.gaps };
  const avoidRoads = opts.avoidRoads ?? true;
  const bodies = (opts.bodies ?? buildingBodies()).map((b) => {
    const p0 = worldToScreen(camera, { x: b.rect.x, y: b.rect.y });
    return { id: b.id, rect: { x: p0.x, y: p0.y, w: b.rect.w * camera.z, h: b.rect.h * camera.z } };
  });
  const hud = avoidRects.map((r) => inflate(r, pad));

  const order = specs
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.priority - a.s.priority || a.i - b.i);
  const placed: Rect[] = [];
  const result = new Map<string, LabelPlacement>();

  for (const { s } of order) {
    const a = worldToScreen(camera, s.anchor);
    const building = s.kind === "building";
    const w = s.width;
    const h = s.height;
    const mk = (x: number, y: number, hidden: boolean): LabelPlacement => {
      const fromX = clamp(a.x, x + Math.min(10, w / 2), x + w - Math.min(10, w / 2));
      const above = a.y >= y + h;
      return {
        id: s.id,
        x,
        y,
        pinFrom: { x: fromX, y: above ? y + h : a.y },
        pinTo: { x: a.x, y: a.y },
        hidden,
      };
    };
    const hide = () => {
      const p = mk(a.x - w / 2, a.y - gaps[s.kind] - h, true);
      result.set(s.id, p);
    };

    const minZoom = opts.minZoom?.[s.kind];
    const offscreen = a.x < -40 || a.y < -40 || a.x > viewport.w + 40 || a.y > viewport.h + 120;
    if (!building && ((minZoom !== undefined && camera.z < minZoom) || offscreen)) {
      hide();
      continue;
    }

    const baseX = a.x - w / 2;
    const baseY = a.y - gaps[s.kind] - h;
    const maxX = Math.max(margin, viewport.w - w - margin);
    const maxY = Math.max(margin, viewport.h - h - margin);
    const at = (dx: number, dy: number): Rect => ({
      x: clamp(baseX + dx, margin, maxX),
      y: clamp(baseY + dy, margin, maxY),
      w,
      h,
    });
    const hardOverlap = (r: Rect): number => {
      const g = inflate(r, pad / 2);
      let t = 0;
      for (const p of placed) t += overlapArea(g, inflate(p, pad / 2));
      for (const q of hud) t += overlapArea(r, q);
      return t;
    };
    const bodyOverlap = (r: Rect): number => {
      let t = 0;
      for (const b of bodies) if (b.id !== s.id) t += overlapArea(r, b.rect);
      return t;
    };
    const disp = (r: Rect) => Math.abs(r.x - baseX) + Math.abs(r.y - baseY);

    let best: Rect | null = null;
    let bestCost = Infinity;
    for (const [dx, dy] of NEAR) {
      const r = at(dx, dy);
      if (hardOverlap(r) > 0) continue;
      const cost = bodyOverlap(r) * 20 + (avoidRoads ? roadFraction(r, camera) * w * h * 0.35 : 0) + disp(r);
      if (cost < bestCost) {
        best = r;
        bestCost = cost;
      }
    }
    // Wide search only for building labels, which must always be placed.
    if (!best && building) {
      let fallback: Rect | null = null;
      let fallbackOverlap = Infinity;
      let freeCost = Infinity;
      for (const [dx, dy] of FAR) {
        const r = at(dx, dy);
        const o = hardOverlap(r);
        if (o > 0) {
          if (o < fallbackOverlap) {
            fallback = r;
            fallbackOverlap = o;
          }
          continue;
        }
        const cost = bodyOverlap(r) * 20 + disp(r);
        if (cost < freeCost) {
          best = r;
          freeCost = cost;
        }
      }
      if (!best) best = fallback ?? at(0, 0);
    }
    if (!best) {
      hide();
      continue;
    }
    placed.push(best);
    result.set(s.id, mk(best.x, best.y, false));
  }
  return specs.map((s) => result.get(s.id)!);
}
