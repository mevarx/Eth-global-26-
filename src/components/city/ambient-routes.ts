// Ambient life routes: boats, cars and pedestrians as predefined waypoint loops.
// Pure data and samplers: every pose is a pure function of accumulated ticker time
// (no randomness, no Date.now, no state). Grid units in, world pixels out (toWorld).
import { toWorld, type GridPt } from "./iso-layout";
import { keyBuildingDef } from "./iso-buildings";
import { isoGeometry } from "./iso-geometry";
import { HOUSE_SLOTS, TOWER_SLOTS, slotCentreWorld, slotsByRole } from "./slots";

export interface Pt {
  x: number;
  y: number;
}

// ───────────────────────── paths ─────────────────────────

/** Closed polyline: dense grid points, matching world points and cumulative world length. */
export interface PathTable {
  g: GridPt[];
  w: Pt[];
  cum: number[];
  total: number;
}

const CORNER_STEPS = 8;
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Closed loop through `corners`; every real turn is rounded with a quadratic arc. */
export function buildLoopPath(corners: readonly GridPt[], radius: number): PathTable {
  const n = corners.length;
  const g: GridPt[] = [];
  for (let i = 0; i < n; i++) {
    const p = corners[i];
    const a = corners[(i + n - 1) % n];
    const b = corners[(i + 1) % n];
    const d1 = Math.hypot(a.gx - p.gx, a.gy - p.gy);
    const d2 = Math.hypot(b.gx - p.gx, b.gy - p.gy);
    const cross = (p.gx - a.gx) * (b.gy - p.gy) - (p.gy - a.gy) * (b.gx - p.gx);
    if (Math.abs(cross) < 1e-9) {
      g.push({ ...p });
      continue;
    }
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const e = { gx: p.gx + ((a.gx - p.gx) / d1) * r, gy: p.gy + ((a.gy - p.gy) / d1) * r };
    const x = { gx: p.gx + ((b.gx - p.gx) / d2) * r, gy: p.gy + ((b.gy - p.gy) / d2) * r };
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const t = k / CORNER_STEPS;
      const u = 1 - t;
      g.push({ gx: u * u * e.gx + 2 * u * t * p.gx + t * t * x.gx, gy: u * u * e.gy + 2 * u * t * p.gy + t * t * x.gy });
    }
  }
  g.push({ ...g[0] });
  const w = g.map(toWorld);
  const cum = [0];
  for (let i = 1; i < w.length; i++) cum.push(cum[i - 1] + Math.hypot(w[i].x - w[i - 1].x, w[i].y - w[i - 1].y));
  return { g, w, cum, total: cum[cum.length - 1] };
}

export interface PathPoint {
  gx: number;
  gy: number;
  x: number;
  y: number;
  /** World-space travel angle (radians, atan2(dy, dx)). */
  angle: number;
  /** Unit travel direction in grid space. */
  dgx: number;
  dgy: number;
}

export function pathPointAt(path: PathTable, s: number): PathPoint {
  const d = mod(s, path.total);
  let lo = 0;
  let hi = path.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const len = path.cum[lo + 1] - path.cum[lo];
  const t = len > 0 ? (d - path.cum[lo]) / len : 0;
  const ga = path.g[lo];
  const gb = path.g[lo + 1];
  const wa = path.w[lo];
  const wb = path.w[lo + 1];
  const gl = Math.hypot(gb.gx - ga.gx, gb.gy - ga.gy) || 1;
  return {
    gx: ga.gx + (gb.gx - ga.gx) * t,
    gy: ga.gy + (gb.gy - ga.gy) * t,
    x: wa.x + (wb.x - wa.x) * t,
    y: wa.y + (wb.y - wa.y) * t,
    angle: Math.atan2(wb.y - wa.y, wb.x - wa.x),
    dgx: (gb.gx - ga.gx) / gl,
    dgy: (gb.gy - ga.gy) / gl,
  };
}

/** Arc length (world px) of the path point nearest to a grid point. */
export function pathDistanceOf(path: PathTable, pt: GridPt): number {
  let best = Infinity;
  let bestS = 0;
  for (let i = 0; i < path.g.length - 1; i++) {
    const a = path.g[i];
    const b = path.g[i + 1];
    const dx = b.gx - a.gx;
    const dy = b.gy - a.gy;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((pt.gx - a.gx) * dx + (pt.gy - a.gy) * dy) / l2)) : 0;
    const d = Math.hypot(a.gx + dx * t - pt.gx, a.gy + dy * t - pt.gy);
    if (d < best) {
      best = d;
      bestS = path.cum[i] + (path.cum[i + 1] - path.cum[i]) * t;
    }
  }
  return bestS;
}

// ───────────────────────── timelines (stops as pure functions of time) ─────────────────────────

export type SegKind = "cruise" | "accel" | "decel" | "rest";

interface Seg {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
  kind: SegKind;
  stop: number;
}

/** One lap: cruise at `v`, brake over `ramp` px into each stop, rest `ms`, accelerate out. */
export interface Timeline {
  period: number;
  total: number;
  v: number;
  ramp: number;
  segs: Seg[];
}

export function buildTimeline(total: number, stops: ReadonlyArray<{ s: number; ms: number }>, v: number, ramp: number): Timeline {
  const segs: Seg[] = [];
  let t = 0;
  let s = 0;
  const push = (kind: SegKind, ds: number, dt: number, stop: number) => {
    segs.push({ t0: t, t1: t + dt, s0: s, s1: s + ds, kind, stop });
    t += dt;
    s += ds;
  };
  const rampT = ramp > 0 ? (2 * ramp) / v : 0;
  stops.forEach((st, i) => {
    const line = st.s - ramp;
    if (line > s) push("cruise", line - s, (line - s) / v, -1);
    if (ramp > 0) push("decel", ramp, rampT, i);
    if (st.ms > 0) push("rest", 0, st.ms, i);
    if (ramp > 0) push("accel", ramp, rampT, i);
  });
  if (total > s) push("cruise", total - s, (total - s) / v, -1);
  return { period: t, total, v, ramp, segs };
}

export interface TimelineSample {
  /** Distance along the loop (world px). */
  s: number;
  kind: SegKind;
  /** Index into the loop's stop list, -1 while cruising. */
  stop: number;
  /** 0 at rest .. 1 at cruise speed. */
  speedFrac: number;
}

export function sampleTimeline(tl: Timeline, u: number): TimelineSample {
  const t = mod(u, tl.period);
  let seg = tl.segs[tl.segs.length - 1];
  for (const c of tl.segs) {
    if (t < c.t1) {
      seg = c;
      break;
    }
  }
  const tau = t - seg.t0;
  const T = seg.t1 - seg.t0;
  const a = tl.ramp > 0 ? (tl.v * tl.v) / (2 * tl.ramp) : 0;
  switch (seg.kind) {
    case "rest":
      return { s: seg.s0, kind: "rest", stop: seg.stop, speedFrac: 0 };
    case "accel":
      return { s: seg.s0 + 0.5 * a * tau * tau, kind: "accel", stop: seg.stop, speedFrac: T > 0 ? tau / T : 1 };
    case "decel":
      return { s: seg.s0 + tl.v * tau - 0.5 * a * tau * tau, kind: "decel", stop: seg.stop, speedFrac: T > 0 ? 1 - tau / T : 0 };
    default:
      return { s: seg.s0 + tl.v * tau, kind: "cruise", stop: -1, speedFrac: 1 };
  }
}

// ───────────────────────── silhouettes (never draw over buildings) ─────────────────────────

function convexHull(points: Pt[]): Pt[] {
  const ps = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of [...ps].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Overlay art that rises above a record lot (mirrors DistrictLayer HouseArt / TowerArt). */
const LOT_ART = {
  house: { hw: 19, hh: 9.5, rise: 29 },
  tower: { hw: 17, hh: 8.5, rise: 46 },
} as const;

function lotHull(c: Pt, art: { hw: number; hh: number; rise: number }): Pt[] {
  return convexHull([
    { x: c.x - art.hw, y: c.y },
    { x: c.x + art.hw, y: c.y },
    { x: c.x, y: c.y - art.hh },
    { x: c.x, y: c.y + art.hh },
    { x: c.x - art.hw, y: c.y - art.rise },
    { x: c.x + art.hw, y: c.y - art.rise },
    { x: c.x, y: c.y - art.rise - art.hh },
  ]);
}

/** Screen silhouettes (world px) of the Pixi working buildings, as convex hulls. */
export function workingBuildingSilhouettes(): Pt[][] {
  return slotsByRole("working-building").map((s) => {
    const g = isoGeometry(keyBuildingDef(s.building));
    return convexHull([g.T, g.R, g.B, g.L, g.Tt, g.Rt, g.Bt, g.Lt, g.apex]);
  });
}

/** Silhouettes of the record-district houses and towers drawn by the district layer. */
export function districtSilhouettes(): Pt[][] {
  return [
    ...HOUSE_SLOTS.map((s) => lotHull(slotCentreWorld(s), LOT_ART.house)),
    ...TOWER_SLOTS.map((s) => lotHull(slotCentreWorld(s), LOT_ART.tower)),
  ];
}

function insideHull(h: Pt[], p: Pt): boolean {
  let sign = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (c !== 0) {
      const sg = c > 0 ? 1 : -1;
      if (sign === 0) sign = sg;
      else if (sg !== sign) return false;
    }
  }
  return true;
}

const SILHOUETTES: Pt[][] = [...workingBuildingSilhouettes(), ...districtSilhouettes()];
/** Ground footprint probes of a street entity (px around its ground point). */
const FOOTPRINT: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [10, 0],
  [-10, 0],
  [0, 5],
  [0, -5],
];

/** True when an entity standing at `p` would be drawn over a building behind it. */
export function isHiddenBehindBuilding(p: Pt, silhouettes: Pt[][] = SILHOUETTES): boolean {
  return silhouettes.some((h) => FOOTPRINT.some(([dx, dy]) => insideHull(h, { x: p.x + dx, y: p.y + dy })));
}

// ───────────────────────── boats ─────────────────────────

export type BoatStyle = "sailboat" | "ferry" | "fishing" | "kayak" | "dinghy";

interface BoatDef {
  id: string;
  style: BoatStyle;
  label: string;
  corners: GridPt[];
  /** px per second along the loop. */
  speed: number;
  /** Start position as a fraction of one lap. */
  start: number;
}

export interface BoatRoute extends BoatDef {
  path: PathTable;
  /** Lap duration in ms. */
  period: number;
}

const BOAT_DEFS: BoatDef[] = [
  { id: "boat-sailboat", style: "sailboat", label: "Sailboat", speed: 15, start: 0.1, corners: [{ gx: 8, gy: -7 }, { gx: 20, gy: -7 }, { gx: 22, gy: -5.2 }, { gx: 20, gy: -3.6 }, { gx: 8, gy: -3.6 }, { gx: 6, gy: -5.2 }] },
  { id: "boat-ferry", style: "ferry", label: "Ferry", speed: 11, start: 0.35, corners: [{ gx: 34.5, gy: 3 }, { gx: 37.5, gy: 3 }, { gx: 37.5, gy: 17 }, { gx: 34.5, gy: 17 }] },
  { id: "boat-fishing", style: "fishing", label: "Fishing boat", speed: 11, start: 0.6, corners: [{ gx: 8, gy: 34.5 }, { gx: 22, gy: 34.5 }, { gx: 22, gy: 37.5 }, { gx: 8, gy: 37.5 }] },
  { id: "boat-kayak", style: "kayak", label: "Kayak", speed: 17, start: 0.2, corners: [{ gx: -6.5, gy: 5 }, { gx: -4.5, gy: 5 }, { gx: -4.5, gy: 11 }, { gx: -6.5, gy: 11 }] },
  { id: "boat-dinghy", style: "dinghy", label: "Sailing dinghy", speed: 13, start: 0.75, corners: [{ gx: -9, gy: 15 }, { gx: -5, gy: 15 }, { gx: -5, gy: 19.5 }, { gx: -9, gy: 19.5 }] },
];

export const boatRoutes: readonly BoatRoute[] = BOAT_DEFS.map((d) => {
  const path = buildLoopPath(d.corners, 1.2);
  return { ...d, path, period: (path.total / d.speed) * 1000 };
});

/** Boat pose at `timeMs`; heading is the world travel angle in radians (bow = +x). */
export function sampleBoat(route: BoatRoute, timeMs: number): { x: number; y: number; heading: number } {
  const s = (timeMs / 1000) * route.speed + route.start * route.path.total;
  const p = pathPointAt(route.path, s);
  return { x: p.x, y: p.y, heading: p.angle };
}

// ───────────────────────── stops ─────────────────────────

export type PedPose = "walk" | "stand" | "look" | "sit" | "chat";
export type StopFace = "along" | "back" | 1 | -1;

export interface StopDef {
  at: GridPt;
  ms: number;
  tag?: string;
  pose?: Exclude<PedPose, "walk">;
  /** Screen facing while resting: 1 right, -1 left, "along"/"back" relative to travel. */
  face?: StopFace;
}

export interface MoverLoop {
  id: string;
  path: PathTable;
  stops: Array<StopDef & { s: number }>;
  timeline: Timeline;
  /** Lap duration in ms. */
  period: number;
}

function makeLoop(id: string, corners: GridPt[], radius: number, stops: StopDef[], speedPxPerSec: number, rampPx: number): MoverLoop {
  const path = buildLoopPath(corners, radius);
  const resolved = stops.map((st) => ({ ...st, s: pathDistanceOf(path, st.at) })).sort((a, b) => a.s - b.s);
  const timeline = buildTimeline(path.total, resolved, speedPxPerSec / 1000, rampPx);
  return { id, path, stops: resolved, timeline, period: timeline.period };
}

const G = (gx: number, gy: number): GridPt => ({ gx, gy });

// ───────────────────────── cars ─────────────────────────

export type CarShape = "hatchback" | "van" | "bus";

export interface CarDef {
  id: string;
  shape: CarShape;
  /** CSS colour tokens only. */
  body: string;
  accent: string;
}

export interface Car extends CarDef {
  loop: MoverLoop;
  /** Time shift along the loop's shared schedule (ms). */
  offsetMs: number;
}

const LANE = 0.2; // CAR_LANE_OFFSET, checked against slots.ts in tests
const RING_LO = 18.5 - LANE;
const RING_HI = 25.5 + LANE;
const MAIN_STOP = "main";

/**
 * Counter-clockwise ring around the park block on the OUTER (right-hand) lanes, so the
 * block-side sidewalks keep a lane of clearance. Corner (18,18) is the main crossing.
 */
const RING_LOOP = makeLoop(
  "car-ring",
  [G(22, RING_LO), G(RING_LO, RING_LO), G(RING_LO, RING_HI), G(RING_HI, RING_HI), G(RING_HI, RING_LO)],
  0.7,
  [
    { at: G(19.45, RING_LO), ms: 1800, tag: MAIN_STOP },
    { at: G(RING_LO, 24.55), ms: 1500 },
    { at: G(24.55, RING_HI), ms: 1500 },
    { at: G(RING_HI, 19.45), ms: 1500 },
  ],
  36,
  12,
);

/** Out-and-back along the south road (y 25), west of the ring; stops at the (11,25) crossing. */
const WEST_LOOP = makeLoop(
  "car-west",
  [G(9, 25.5 - LANE), G(5.6, 25.5 - LANE), G(5.6, 25.5 + LANE), G(15.4, 25.5 + LANE), G(15.4, 25.5 - LANE)],
  0.2,
  [
    { at: G(6.4, 25.5 - LANE), ms: 700, tag: "turn" },
    { at: G(10.1, 25.5 + LANE), ms: 1500 },
    { at: G(14.3, 25.5 + LANE), ms: 700, tag: "turn" },
    { at: G(12.9, 25.5 - LANE), ms: 1500 },
  ],
  30,
  12,
);

/** Out-and-back along the east road (x 25), north of the ring; stops at the (25,11) crossing. */
const NORTH_LOOP = makeLoop(
  "car-north",
  [G(25.5 + LANE, 9), G(25.5 + LANE, 5.6), G(25.5 - LANE, 5.6), G(25.5 - LANE, 15.4), G(25.5 + LANE, 15.4)],
  0.2,
  [
    { at: G(25.5 + LANE, 6.4), ms: 700, tag: "turn" },
    { at: G(25.5 - LANE, 10.1), ms: 1500 },
    { at: G(25.5 - LANE, 14.3), ms: 700, tag: "turn" },
    { at: G(25.5 + LANE, 12.9), ms: 1500 },
  ],
  30,
  12,
);

const quarter = (loop: MoverLoop, k: number) => Math.round((loop.period * k) / 4);

export const cars: readonly Car[] = [
  { id: "car-1", shape: "hatchback", body: "var(--bm-scene-roof-red)", accent: "var(--bm-scene-wall-light)", loop: RING_LOOP, offsetMs: 0 },
  { id: "car-2", shape: "van", body: "var(--bm-scene-wall-light)", accent: "var(--bm-scene-roof-blue)", loop: RING_LOOP, offsetMs: quarter(RING_LOOP, 1) },
  { id: "car-3", shape: "bus", body: "var(--bm-scene-roof-blue)", accent: "var(--bm-scene-wall-light)", loop: RING_LOOP, offsetMs: quarter(RING_LOOP, 2) },
  { id: "car-4", shape: "hatchback", body: "var(--bm-scene-foliage)", accent: "var(--bm-scene-wall-light)", loop: RING_LOOP, offsetMs: quarter(RING_LOOP, 3) },
  { id: "car-5", shape: "van", body: "var(--bm-scene-crate)", accent: "var(--bm-scene-wood-dark)", loop: WEST_LOOP, offsetMs: 0 },
  { id: "car-6", shape: "hatchback", body: "var(--bm-scene-court)", accent: "var(--bm-scene-ink)", loop: NORTH_LOOP, offsetMs: 0 },
];

export interface CarSample {
  x: number;
  y: number;
  gx: number;
  gy: number;
  heading: number;
  dgx: number;
  dgy: number;
  moving: boolean;
  kind: SegKind;
  stopTag?: string;
  /** Sprite mirror (1 faces right on screen, -1 left) and the screen slope of travel. */
  mirror: 1 | -1;
  slope: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function screenOrientation(angle: number): { mirror: 1 | -1; slope: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return { mirror: dx >= 0 ? 1 : -1, slope: Math.abs(dx) < 1e-3 ? 0 : clamp(dy / dx, -0.5, 0.5) };
}

export function sampleCar(car: Car, timeMs: number): CarSample {
  const lt = sampleTimeline(car.loop.timeline, timeMs + car.offsetMs);
  const p = pathPointAt(car.loop.path, lt.s);
  return {
    x: p.x,
    y: p.y,
    gx: p.gx,
    gy: p.gy,
    heading: p.angle,
    dgx: p.dgx,
    dgy: p.dgy,
    moving: lt.kind !== "rest",
    kind: lt.kind,
    stopTag: lt.stop >= 0 ? car.loop.stops[lt.stop].tag : undefined,
    ...screenOrientation(p.angle),
  };
}

/** Reduced-motion pose: the car's start position nudged toward the kerb on its right. */
export function parkedCar(car: Car): CarSample {
  const s = sampleCar(car, 0);
  const KERB = 0.12;
  const gx = s.gx - s.dgy * KERB;
  const gy = s.gy + s.dgx * KERB;
  const w = toWorld({ gx, gy });
  return { ...s, gx, gy, x: w.x, y: w.y, moving: false, kind: "rest", stopTag: undefined };
}

export type LightState = "red" | "amber" | "green";

/** Light at the main crossing, derived from the cars queued at its stop line. */
export function trafficLightState(timeMs: number): LightState {
  let state: LightState = "green";
  for (const car of cars) {
    const s = sampleCar(car, timeMs);
    if (s.stopTag !== MAIN_STOP) continue;
    if (s.kind === "rest") return "red";
    state = "amber";
  }
  return state;
}

/** Ground position of the traffic light pole: sidewalk corner of the main crossing (18,18). */
export const TRAFFIC_LIGHT_AT: GridPt = G(18.08, 18.08);

// ───────────────────────── pedestrians ─────────────────────────

export interface PedOutfit {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "bun" | "cap" | "bald";
  /** Optional scarf colour; never a carried item. */
  scarf?: string;
  skirt?: boolean;
  /** Height scale around the 32 px nominal body. */
  height: number;
}

export interface PedDef {
  id: string;
  outfit: PedOutfit;
}

export interface Walker extends PedDef {
  loop: MoverLoop;
  offsetMs: number;
  /** Walks this far behind the loop schedule (a chat partner trailing its friend). */
  lagPx: number;
  role: "solo" | "lead" | "follow";
}

const SW = 0.42; // SIDEWALK_OFFSET, checked against slots.ts in tests
const SW_LO = 18.5 + SW; // park-block side of the top / left roads
const SW_HI = 25.5 - SW; // park-block side of the bottom / right roads

export interface Bench {
  id: string;
  at: GridPt;
  /** Direction the bench runs along: "x" runs along gx. */
  axis: "x" | "y";
  /** Screen facing of a seated person. */
  face: 1 | -1;
}

export const benches: readonly Bench[] = [
  { id: "bench-north", at: G(23.2, SW_LO), axis: "x", face: 1 },
  { id: "bench-south", at: G(21.6, SW_HI), axis: "x", face: -1 },
  { id: "bench-west", at: G(SW_LO, 21.4), axis: "y", face: -1 },
];

/** Clockwise promenade on the park block's own sidewalk (benches sit on this edge). */
const PARK_WALK = makeLoop(
  "ped-park",
  [G(21.5, SW_LO), G(SW_HI, SW_LO), G(SW_HI, SW_HI), G(SW_LO, SW_HI), G(SW_LO, SW_LO)],
  0.25,
  [
    ...benches.map((b): StopDef => ({ at: b.at, ms: 5500, pose: "sit", face: b.face })),
    { at: G(SW_HI, 21.8), ms: 2500, pose: "look", face: "along" },
  ],
  14,
  4,
);

/** Closed rectangle around one car-free road: out on one sidewalk, back on the other. */
const TOP_WALK = makeLoop(
  "ped-top",
  [G(10.6, 11.5 - SW), G(16.4, 11.5 - SW), G(16.4, 11.5 + SW), G(10.6, 11.5 + SW)],
  0.25,
  [
    { at: G(13.5, 11.5 - SW), ms: 7000, pose: "chat", face: "along" },
    { at: G(12.3, 11.5 + SW), ms: 2500, pose: "look", face: "along" },
  ],
  14,
  4,
);

const LEFT_WALK = makeLoop(
  "ped-left",
  [G(11.5 - SW, 13.2), G(11.5 + SW, 13.2), G(11.5 + SW, 16.2), G(11.5 - SW, 16.2)],
  0.25,
  [
    { at: G(11.5 + SW, 14.4), ms: 3000, pose: "look", face: "along" },
    { at: G(11.5 - SW, 15.0), ms: 3000, pose: "look", face: "back" },
  ],
  14,
  4,
);

const fifth = (loop: MoverLoop, k: number) => Math.round((loop.period * k) / 5);
const T = "var(--bm-scene-";
const outfit = (shirt: string, pants: string, skin: string, hair: string, hairStyle: PedOutfit["hairStyle"], height: number, extra: Partial<PedOutfit> = {}): PedOutfit => ({
  shirt: `${T}${shirt})`,
  pants: `${T}${pants})`,
  skin: `${T}${skin})`,
  hair: `${T}${hair})`,
  hairStyle,
  height,
  ...extra,
});

export const walkers: readonly Walker[] = [
  { id: "ped-1", outfit: outfit("roof-red", "ink", "path", "wood-dark", "short", 1.06), loop: PARK_WALK, offsetMs: fifth(PARK_WALK, 0), lagPx: 0, role: "solo" },
  { id: "ped-2", outfit: outfit("roof-blue", "stone", "crate", "ink", "long", 0.94), loop: PARK_WALK, offsetMs: fifth(PARK_WALK, 1), lagPx: 0, role: "solo" },
  { id: "ped-3", outfit: outfit("foliage", "wood-dark", "trunk", "ink", "cap", 1.0), loop: PARK_WALK, offsetMs: fifth(PARK_WALK, 2), lagPx: 0, role: "solo" },
  { id: "ped-4", outfit: outfit("wall-light", "solar-panel", "path", "trunk", "bun", 0.9, { skirt: true }), loop: PARK_WALK, offsetMs: fifth(PARK_WALK, 3), lagPx: 0, role: "solo" },
  { id: "ped-5", outfit: outfit("court", "ink", "wood", "stone", "bald", 1.08, { scarf: `${T}wall-light)` }), loop: PARK_WALK, offsetMs: fifth(PARK_WALK, 4), lagPx: 0, role: "solo" },
  { id: "ped-6", outfit: outfit("solar-panel", "wood-dark", "crate", "trunk", "long", 0.96), loop: TOP_WALK, offsetMs: 0, lagPx: 28, role: "follow" },
  { id: "ped-7", outfit: outfit("roof-red", "stone", "path", "ink", "short", 1.02), loop: TOP_WALK, offsetMs: 0, lagPx: 0, role: "lead" },
  { id: "ped-8", outfit: outfit("stone", "ink", "wood", "wood-dark", "cap", 0.98), loop: LEFT_WALK, offsetMs: 0, lagPx: 0, role: "solo" },
  { id: "ped-9", outfit: outfit("crate", "roof-blue", "trunk", "ink", "bun", 0.92, { skirt: true }), loop: LEFT_WALK, offsetMs: Math.round(LEFT_WALK.period / 2), lagPx: 0, role: "solo" },
];
// Pair on the top loop: ped-7 leads, ped-6 trails it by 28 px on the same schedule.

export interface PedSample {
  x: number;
  y: number;
  pose: PedPose;
  /** Screen facing: 1 right, -1 left. */
  facing: 1 | -1;
  /** Walk-cycle phase in [0, 1). */
  phase: number;
  /** 0..1 stride amplitude (eases in and out of pauses). */
  speedFrac: number;
  moving: boolean;
}

/** Strides per loop are rounded so the walk cycle wraps seamlessly. */
const STRIDE_PX = 26;

export function sampleWalker(w: Walker, timeMs: number): PedSample {
  const lt = sampleTimeline(w.loop.timeline, timeMs + w.offsetMs);
  const s = lt.s - w.lagPx;
  const p = pathPointAt(w.loop.path, s);
  const dirSign: 1 | -1 = p.dgx - p.dgy >= 0 ? 1 : -1;
  const strides = Math.max(1, Math.round(w.loop.path.total / STRIDE_PX));
  const phase = mod((mod(s, w.loop.path.total) / w.loop.path.total) * strides, 1);
  if (lt.kind === "rest") {
    const stop = w.loop.stops[lt.stop];
    let facing = dirSign;
    const f = stop.face ?? "along";
    if (f === "back") facing = -dirSign as 1 | -1;
    else if (f === 1 || f === -1) facing = f;
    // chat partners face each other: the one ahead looks back, the one behind looks ahead
    if (stop.pose === "chat" && w.role === "lead") facing = -dirSign as 1 | -1;
    if (stop.pose === "chat" && w.role === "follow") facing = dirSign;
    return { x: p.x, y: p.y, pose: stop.pose ?? "stand", facing, phase, speedFrac: 0, moving: false };
  }
  return { x: p.x, y: p.y, pose: "walk", facing: dirSign, phase, speedFrac: lt.speedFrac, moving: true };
}

/** Reduced-motion pose: where the walker starts, standing. */
export function standingWalker(w: Walker): PedSample {
  const s = sampleWalker(w, 0);
  return { ...s, pose: s.pose === "sit" ? "sit" : "stand", moving: false, speedFrac: 0 };
}

// ───────────────────────── totals ─────────────────────────

export const AMBIENT_ENTITY_CAP = 25;
export const ambientEntityCount = boatRoutes.length + cars.length + walkers.length;
