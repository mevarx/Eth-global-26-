// Pure water geometry for draggable boats: which world points are water and where
// an invalid point should snap. Reuses the slot plan's LAND_EXCLUSION (grid units)
// and iso-layout's projection. No React, timers or randomness.
import { TILE_H, TILE_W, toWorld, type GridPt } from "./iso-layout";
import { LAND_EXCLUSION } from "./slots";

export interface Pt {
  x: number;
  y: number;
}

/** Axis-aligned world-pixel rectangle (inclusive edges). */
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Generous default so boats can be dropped anywhere on wide viewports. */
export const WATER_WORLD_BOUNDS: WorldBounds = { minX: -1500, maxX: 1500, minY: -800, maxY: 1400 };

/** Boats keep this clearance (in tiles) from the land-exclusion rectangle. */
export const WATER_MARGIN_TILES = 0.5;

const EPS = 1e-6;

/** Inverse of toWorld(). */
export function worldToGrid(p: Pt): GridPt {
  const a = p.y / TILE_H;
  const b = p.x / TILE_W;
  return { gx: a + b, gy: a - b };
}

const LO = LAND_EXCLUSION.gx - WATER_MARGIN_TILES;
const HI_X = LAND_EXCLUSION.gx + LAND_EXCLUSION.w + WATER_MARGIN_TILES;
const LO_Y = LAND_EXCLUSION.gy - WATER_MARGIN_TILES;
const HI_Y = LAND_EXCLUSION.gy + LAND_EXCLUSION.h + WATER_MARGIN_TILES;

export function clampToBounds(p: Pt, bounds: WorldBounds = WATER_WORLD_BOUNDS): Pt {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, p.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, p.y)),
  };
}

function inBounds(p: Pt, b: WorldBounds): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

function onLand(g: GridPt): boolean {
  return g.gx > LO + EPS && g.gx < HI_X - EPS && g.gy > LO_Y + EPS && g.gy < HI_Y - EPS;
}

/** True iff `p` (world px) is inside `bounds` and clear of the land exclusion plus margin. */
export function isWater(p: Pt, bounds: WorldBounds = WATER_WORLD_BOUNDS): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  return inBounds(p, bounds) && !onLand(worldToGrid(p));
}

/**
 * Nearest valid water point (grid-space distance). Water points inside bounds are
 * returned unchanged; land points are pushed out through the closest side of the
 * exclusion square; the result is clamped to bounds. Ties resolve in a fixed order.
 */
export function nearestWater(p: Pt, bounds: WorldBounds = WATER_WORLD_BOUNDS): Pt {
  const src = { x: Number.isFinite(p.x) ? p.x : 0, y: Number.isFinite(p.y) ? p.y : 0 };
  const clamped = clampToBounds(src, bounds);
  if (isWater(clamped, bounds)) return clamped;

  const g = worldToGrid(clamped);
  const sides: GridPt[] = [
    { gx: LO, gy: g.gy },
    { gx: HI_X, gy: g.gy },
    { gx: g.gx, gy: LO_Y },
    { gx: g.gx, gy: HI_Y },
  ];
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const s of sides) {
    const w = clampToBounds(toWorld(s), bounds);
    if (!isWater(w, bounds)) continue;
    const wg = worldToGrid(w);
    const d = Math.hypot(wg.gx - g.gx, wg.gy - g.gy);
    if (d < bestD - EPS) {
      best = w;
      bestD = d;
    }
  }
  if (best) return best;

  // Bounds clip every side (tiny viewports): fall back to the nearest valid corner.
  const corners: Pt[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  for (const c of corners) {
    if (!isWater(c, bounds)) continue;
    const d = Math.hypot(c.x - clamped.x, c.y - clamped.y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best ?? clamped;
}
