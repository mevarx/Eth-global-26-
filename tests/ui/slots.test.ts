// SLOT PLAN invariants: no two roles share a slot, every buildable island tile has one owner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRID_N, ROAD_MAX, ROAD_MIN, isRoadCell, isSandCell } from "../../src/components/city/iso-layout";
import {
  HOUSE_SLOTS,
  HOUSE_SLOT_COUNT,
  LAND_EXCLUSION,
  SLOTS,
  TOWER_SLOTS,
  TOWER_SLOT_COUNT,
  VACANT_LOT_COUNT,
  rectContains,
  rectsOverlap,
  slotsByRole,
} from "../../src/components/city/slots";

test("slot ids are unique", () => {
  const ids = SLOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("no two slots overlap", () => {
  for (let i = 0; i < SLOTS.length; i++)
    for (let j = i + 1; j < SLOTS.length; j++)
      assert.ok(!rectsOverlap(SLOTS[i].rect, SLOTS[j].rect), `${SLOTS[i].id} overlaps ${SLOTS[j].id}`);
});

test("every land tile inside the road ring has exactly one owner", () => {
  for (let gx = ROAD_MIN; gx < ROAD_MAX; gx++)
    for (let gy = ROAD_MIN; gy < ROAD_MAX; gy++) {
      const owners = SLOTS.filter((s) => rectContains(s.rect, { gx, gy }));
      assert.equal(owners.length, 1, `tile ${gx},${gy} has ${owners.length} owners`);
    }
});

test("street lanes cover road tiles only; land roles never cover roads", () => {
  for (const s of SLOTS) {
    if (s.role === "water-region") continue;
    for (let gx: number = s.rect.gx; gx < s.rect.gx + s.rect.w; gx++)
      for (let gy: number = s.rect.gy; gy < s.rect.gy + s.rect.h; gy++)
        assert.equal(isRoadCell(gx, gy), s.role === "street-lane", `${s.id} at ${gx},${gy}`);
  }
});

test("water regions stay off the island and its halo", () => {
  for (const w of slotsByRole("water-region")) assert.ok(!rectsOverlap(w.rect, LAND_EXCLUSION), w.id);
});

test("shoreline slots sit on sand", () => {
  for (const id of ["landmark-lighthouse", "scenery-dock"]) {
    const s = SLOTS.find((x) => x.id === id)!;
    for (let gx: number = s.rect.gx; gx < s.rect.gx + s.rect.w; gx++)
      for (let gy: number = s.rect.gy; gy < s.rect.gy + s.rect.h; gy++) assert.ok(isSandCell(gx, gy) && gx < GRID_N && gy < GRID_N, `${id} ${gx},${gy}`);
  }
});

test("role counts match the plan", () => {
  assert.equal(slotsByRole("working-building").length, 5);
  assert.equal(HOUSE_SLOTS.length, HOUSE_SLOT_COUNT);
  assert.equal(TOWER_SLOTS.length, TOWER_SLOT_COUNT);
  assert.equal(slotsByRole("vacant-record-lot").length, VACANT_LOT_COUNT);
  assert.deepEqual(slotsByRole("landmark").map((l) => l.landmark).sort(), ["clock-tower", "gatehouse", "lighthouse", "notice-board"]);
  assert.deepEqual(HOUSE_SLOTS.map((s) => s.index), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(slotsByRole("water-region").length, 4);
});
