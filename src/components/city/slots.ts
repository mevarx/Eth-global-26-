// SLOT PLAN: every block, street segment, shoreline slot and water region of the
// island assigned to exactly one presentation role. Pure data; no React, no randomness.
// Grid rects are half-open tile ranges [gx, gx + w) x [gy, gy + h) in iso grid units
// (see iso-layout.ts); world pixels come from toWorld().
import { BLOCK_SIZE, GRID_N, KEY_BLOCKS, PLAZA_BLOCK, ROAD_LINES, ROAD_MAX, ROAD_MIN, blockOrigin, toWorld, type GridPt } from "./iso-layout";
import type { BuildingId } from "./scene-config";

export interface GridRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export type SlotRole =
  | "working-building"
  | "record-plot"
  | "vacant-record-lot"
  | "landmark"
  | "scenery-block"
  | "street-lane"
  | "water-region";

export type RecordDistrict = "brief-house" | "opportunity-tower";
export type LandmarkKind = "lighthouse" | "clock-tower" | "gatehouse" | "notice-board";
export type SceneryKind =
  | "plaza"
  | "park"
  | "market"
  | "court"
  | "solar"
  | "wind"
  | "garden"
  | "bus-station"
  | "playground"
  | "amphitheater"
  | "dock"
  | "grove";

interface SlotBase {
  id: string;
  rect: GridRect;
}
export interface WorkingBuildingSlot extends SlotBase {
  role: "working-building";
  building: BuildingId;
}
export interface RecordPlotSlot extends SlotBase {
  role: "record-plot";
  district: RecordDistrict;
  /** Fill order: 0 is filled first (back to front). */
  index: number;
}
export interface VacantLotSlot extends SlotBase {
  role: "vacant-record-lot";
  district: RecordDistrict;
}
export interface LandmarkSlot extends SlotBase {
  role: "landmark";
  landmark: LandmarkKind;
  /** Already drawn by the Pixi engine (only the explainer pin is added). */
  existing: boolean;
}
export interface ScenerySlot extends SlotBase {
  role: "scenery-block";
  scenery: SceneryKind;
  /** Already drawn by the Pixi engine; scenery layers must not draw here. */
  existing: boolean;
  /** Optional small neutral name plate. */
  plate?: string;
}
export interface StreetLaneSlot extends SlotBase {
  role: "street-lane";
  /** "x" runs along gx (constant gy = line); "y" runs along gy (constant gx = line). */
  axis: "x" | "y";
  line: number;
  intersection: boolean;
}
export interface WaterRegionSlot extends SlotBase {
  role: "water-region";
}

export type Slot =
  | WorkingBuildingSlot
  | RecordPlotSlot
  | VacantLotSlot
  | LandmarkSlot
  | ScenerySlot
  | StreetLaneSlot
  | WaterRegionSlot;

/** Lot size inside a 6x6 block. */
export const LOT_SIZE = 2;
export const HOUSE_DISTRICT_BLOCK = { bx: 1, by: 2 } as const;
export const TOWER_DISTRICT_BLOCK = { bx: 2, by: 1 } as const;
export const PARK_BLOCK = { bx: 2, by: 2 } as const;
/** Front-most lot of each record block stays an honest vacant lot. */
const VACANT_LOT = { px: 2, py: 2 } as const;
export const HOUSE_SLOT_COUNT = 8;
export const TOWER_SLOT_COUNT = 8;
export const VACANT_LOT_COUNT = 2;

/** Lane offsets from a road centreline, in tile units. */
export const CAR_LANE_OFFSET = 0.2;
export const SIDEWALK_OFFSET = 0.42;
/** Land (and its shallow halo) that boats must never enter, in grid units. */
export const LAND_EXCLUSION: GridRect = { gx: -2, gy: -2, w: GRID_N + 4, h: GRID_N + 4 };

const blockRect = (bx: number, by: number): GridRect => {
  const o = blockOrigin(bx, by);
  return { gx: o.gx, gy: o.gy, w: BLOCK_SIZE, h: BLOCK_SIZE };
};

function districtSlots(district: RecordDistrict, block: { bx: number; by: number }, prefix: string): Slot[] {
  const o = blockOrigin(block.bx, block.by);
  const lots: Array<{ px: number; py: number }> = [];
  for (let px = 0; px < 3; px++) for (let py = 0; py < 3; py++) lots.push({ px, py });
  // back (small gx + gy) to front, then left (small gx - gy) to right
  lots.sort((a, b) => a.px + a.py - (b.px + b.py) || a.px - a.py - (b.px - b.py));
  const out: Slot[] = [];
  let index = 0;
  for (const l of lots) {
    const rect = { gx: o.gx + l.px * LOT_SIZE, gy: o.gy + l.py * LOT_SIZE, w: LOT_SIZE, h: LOT_SIZE };
    if (l.px === VACANT_LOT.px && l.py === VACANT_LOT.py) out.push({ id: `${prefix}-vacant`, role: "vacant-record-lot", district, rect });
    else out.push({ id: `${prefix}-${index}`, role: "record-plot", district, index: index++, rect });
  }
  return out;
}

/** Segments between road lines along the coastal strips and road lines. */
const SEGMENTS: ReadonlyArray<readonly [number, number]> = [
  [ROAD_MIN, ROAD_LINES[0]],
  [ROAD_LINES[0] + 1, ROAD_LINES[1]],
  [ROAD_LINES[1] + 1, ROAD_LINES[2]],
  [ROAD_LINES[2] + 1, ROAD_LINES[3]],
  [ROAD_LINES[3] + 1, ROAD_MAX],
];
const STRIP_W = ROAD_LINES[0] - ROAD_MIN; // 2 tiles between sand ring and first road
const FAR_STRIP = ROAD_LINES[3] + 1; // 26

function stripRect(side: "west" | "north" | "east" | "south", seg: number): GridRect {
  const [a, b] = SEGMENTS[seg];
  switch (side) {
    case "west":
      return { gx: ROAD_MIN, gy: a, w: STRIP_W, h: b - a };
    case "east":
      return { gx: FAR_STRIP, gy: a, w: STRIP_W, h: b - a };
    case "north":
      return { gx: a, gy: ROAD_MIN, w: b - a, h: STRIP_W };
    case "south":
      return { gx: a, gy: FAR_STRIP, w: b - a, h: STRIP_W };
  }
}

function streetSlots(): StreetLaneSlot[] {
  const out: StreetLaneSlot[] = [];
  for (const line of ROAD_LINES) {
    for (let s = 0; s < SEGMENTS.length; s++) {
      const [a, b] = SEGMENTS[s];
      out.push({ id: `street-x${line}-${s}`, role: "street-lane", axis: "x", line, intersection: false, rect: { gx: a, gy: line, w: b - a, h: 1 } });
      out.push({ id: `street-y${line}-${s}`, role: "street-lane", axis: "y", line, intersection: false, rect: { gx: line, gy: a, w: 1, h: b - a } });
    }
    for (const other of ROAD_LINES)
      out.push({ id: `crossing-${line}-${other}`, role: "street-lane", axis: "x", line, intersection: true, rect: { gx: other, gy: line, w: 1, h: 1 } });
  }
  return out;
}

const WATER_FAR = 16;
function waterSlots(): WaterRegionSlot[] {
  const lo = LAND_EXCLUSION.gx;
  const hi = LAND_EXCLUSION.gx + LAND_EXCLUSION.w;
  return [
    { id: "water-ne", role: "water-region", rect: { gx: lo, gy: lo - WATER_FAR, w: hi + WATER_FAR - lo, h: WATER_FAR } },
    { id: "water-nw", role: "water-region", rect: { gx: lo - WATER_FAR, gy: lo - WATER_FAR, w: WATER_FAR, h: hi - lo + WATER_FAR } },
    { id: "water-se", role: "water-region", rect: { gx: hi, gy: lo, w: WATER_FAR, h: hi + WATER_FAR - lo } },
    { id: "water-sw", role: "water-region", rect: { gx: lo - WATER_FAR, gy: hi, w: hi - lo + WATER_FAR, h: WATER_FAR } },
  ];
}

const STRIP_ASSIGNMENT: Record<"west" | "north" | "east" | "south", Array<Pick<LandmarkSlot, "landmark"> | Pick<ScenerySlot, "scenery" | "plate">>> = {
  // segments 1..3 only; segments 0 and 4 are corners handled below
  west: [{ landmark: "gatehouse" }, { landmark: "clock-tower" }, { landmark: "notice-board" }],
  north: [{ scenery: "solar" }, { scenery: "garden", plate: "Garden" }, { scenery: "court", plate: "Court" }],
  east: [{ scenery: "bus-station", plate: "Bus station" }, { scenery: "playground" }, { scenery: "amphitheater" }],
  south: [{ scenery: "market", plate: "Market" }, { scenery: "wind" }, { scenery: "grove" }],
};

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  for (const id of Object.keys(KEY_BLOCKS) as BuildingId[]) {
    const b = KEY_BLOCKS[id];
    slots.push({ id: `building-${id}`, role: "working-building", building: id, rect: blockRect(b.bx, b.by) });
  }
  slots.push({ id: "scenery-plaza", role: "scenery-block", scenery: "plaza", existing: true, rect: blockRect(PLAZA_BLOCK.bx, PLAZA_BLOCK.by) });
  slots.push({ id: "scenery-park", role: "scenery-block", scenery: "park", existing: false, plate: "Park", rect: blockRect(PARK_BLOCK.bx, PARK_BLOCK.by) });
  slots.push(...districtSlots("brief-house", HOUSE_DISTRICT_BLOCK, "house"));
  slots.push(...districtSlots("opportunity-tower", TOWER_DISTRICT_BLOCK, "tower"));

  for (const side of ["west", "north", "east", "south"] as const) {
    STRIP_ASSIGNMENT[side].forEach((a, k) => {
      const rect = stripRect(side, k + 1);
      if ("landmark" in a) slots.push({ id: `landmark-${a.landmark}`, role: "landmark", landmark: a.landmark, existing: false, rect });
      else slots.push({ id: `scenery-${side}-${a.scenery}`, role: "scenery-block", scenery: a.scenery, existing: false, plate: a.plate, rect });
    });
  }
  // the four strip corners
  for (const [gx, gy, name] of [
    [ROAD_MIN, ROAD_MIN, "n"],
    [FAR_STRIP, ROAD_MIN, "e"],
    [ROAD_MIN, FAR_STRIP, "w"],
    [FAR_STRIP, FAR_STRIP, "s"],
  ] as const)
    slots.push({ id: `scenery-corner-${name}`, role: "scenery-block", scenery: "grove", existing: false, rect: { gx, gy, w: STRIP_W, h: STRIP_W } });

  // shoreline (sand ring) slots
  slots.push({ id: "landmark-lighthouse", role: "landmark", landmark: "lighthouse", existing: true, rect: { gx: 0, gy: 21, w: 2, h: 3 } });
  slots.push({ id: "scenery-dock", role: "scenery-block", scenery: "dock", existing: false, rect: { gx: GRID_N - 2, gy: 13, w: 2, h: 4 } });

  slots.push(...streetSlots());
  slots.push(...waterSlots());
  return slots;
}

export const SLOTS: readonly Slot[] = Object.freeze(buildSlots());

export const slotsByRole = <R extends SlotRole>(role: R): Array<Extract<Slot, { role: R }>> =>
  SLOTS.filter((s): s is Extract<Slot, { role: R }> => s.role === role);

export const HOUSE_SLOTS = slotsByRole("record-plot").filter((s) => s.district === "brief-house").sort((a, b) => a.index - b.index);
export const TOWER_SLOTS = slotsByRole("record-plot").filter((s) => s.district === "opportunity-tower").sort((a, b) => a.index - b.index);

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.gx < b.gx + b.w && b.gx < a.gx + a.w && a.gy < b.gy + b.h && b.gy < a.gy + a.h;
}

export function rectContains(r: GridRect, p: GridPt): boolean {
  return p.gx >= r.gx && p.gx < r.gx + r.w && p.gy >= r.gy && p.gy < r.gy + r.h;
}

export function rectCentre(r: GridRect): GridPt {
  return { gx: r.gx + r.w / 2, gy: r.gy + r.h / 2 };
}

/** Ground centre of a slot in world pixels. */
export function slotCentreWorld(s: Slot): { x: number; y: number } {
  return toWorld(rectCentre(s.rect));
}
