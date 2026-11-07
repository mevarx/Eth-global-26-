// ONE shared depth key for every Tool City scene object (brief fix pass 1):
// the isometric ground position (x + y) of a footprint's FRONT (max gx, max gy) corner,
// broke ties by object height, so painter order never depends on which component draws.
// Pure data: no React, no randomness, no state. Shared by the Scenery/Landmark SVG layers,
// tests and any renderer that needs world-space occlusion between object layers.
import { isoGeometry, type Pt } from "./iso-geometry";
import { KEY_PLOTS, GRID_N } from "./iso-layout";
import { keyBuildingDef } from "./iso-buildings";
import { BUILDING_IDS, type BuildingId } from "./scene-config";
import type { GridRect } from "./slots";

/** Ground depth key: front-corner grid sum (iso ground y grows with gx + gy). */
export function depthKey(rect: GridRect): number {
  return rect.gx + rect.w + (rect.gy + rect.h);
}

export interface GroundObject {
  id: string;
  /** Ground footprint in grid units (scene slots). */
  rect: GridRect;
  /** Object height above ground in world px; later tiebreak only. */
  heightPx?: number;
}

/**
 * Back-to-front painter order: further back first, taller objects last at equal depth.
 * Layer order builds on this: water and boats paint first, labels last (see CityScene).
 */
export function sortSceneObjects<T extends GroundObject>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => depthKey(a.rect) - depthKey(b.rect) || (a.heightPx ?? 0) - (b.heightPx ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Ground footprint of a key working building in grid units. */
export function keyBuildingFootprint(id: BuildingId): GridRect {
  const p = KEY_PLOTS[id];
  return { gx: p.gx, gy: p.gy, w: p.size, h: p.size };
}

export const keyBuildingFrontDepth = (id: BuildingId): number => depthKey(keyBuildingFootprint(id));

/**
 * True for objects that sit BEHIND at least one key building: the building's front corner
 * projects a greater ground depth, so the canvas building must occlude this object's
 * up-screen art (rear scenery rides in a masked layer; front scenery paints unmasked).
 */
export function isRearObject(rect: GridRect): boolean {
  const depth = depthKey(rect);
  return BUILDING_IDS.some((id) => keyBuildingFrontDepth(id) > depth);
}

export const isRearSlot: (rect: GridRect) => boolean = isRearObject;

export interface Occluder {
  id: BuildingId;
  /** World-space polygon point strings ("x,y x,y ..."), exactly the union the engine paints. */
  polys: string[];
}

const fmt = (p: Pt) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
const buildPoly = (ps: Pt[]) => ps.map(fmt).join(" ");

/**
 * World-space occluder polygons for the five key buildings, mirroring what
 * pixi/city-engine buildKeyBuilding draws: the plinth pad, both walls and the
 * visible roof (hip sails with their 1.08 eave overhang, or the flat roof slab).
 */
export function buildingOccluders(): Occluder[] {
  return BUILDING_IDS.map((id) => {
    const def = keyBuildingDef(id);
    const g = isoGeometry(def);
    const { cx, cy } = def;
    const polys: string[] = [];
    const scaleAboutCentre = (p: Pt, f: number): Pt => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f });
    // plinth pad (engine scale 1.08 about the ground centre)
    polys.push(buildPoly([scaleAboutCentre(g.L, 1.08), scaleAboutCentre(g.B, 1.08), scaleAboutCentre(g.R, 1.08), scaleAboutCentre(g.T, 1.08)]));
    // walls: left (-gx+) and right (+gx+) faces
    polys.push(buildPoly([g.L, g.B, g.Bt, g.Lt]));
    polys.push(buildPoly([g.R, g.B, g.Bt, g.Rt]));
    if (def.roof === "hip") {
      const eaveY = cy - def.wallH;
      const overhang = (p: Pt): Pt => ({ x: cx + (p.x - cx) * 1.08, y: eaveY + (p.y - eaveY) * 1.08 + 1.5 });
      polys.push(buildPoly([g.apex, overhang(g.Lt), overhang(g.Bt)]));
      polys.push(buildPoly([g.apex, overhang(g.Bt), overhang(g.Rt)]));
    } else {
      const lift = (p: Pt): Pt => ({ x: p.x, y: p.y - 7 });
      polys.push(buildPoly([g.L, g.B, g.R, lift(g.Rt), lift(g.Tt), lift(g.Lt)]));
    }
    return { id, polys };
  });
}

/** Island containment for a ground footprint: every tile falls inside the [0, GRID_N) plan. */
export function rectInsideIsland(rect: GridRect): boolean {
  return rect.gx >= 0 && rect.gy >= 0 && rect.gx + rect.w <= GRID_N && rect.gy + rect.h <= GRID_N;
}

/** Lighthouse ground point (the engine draws the art; Landmarks only pins it). */
export const LIGHTHOUSE_FOOTPRINT: GridRect = { gx: 0, gy: 21, w: 2, h: 3 };
