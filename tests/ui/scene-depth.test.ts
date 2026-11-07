// Scene depth keys (fix pass 1): one shared depth key for every object, scenery footprints
// never overlap and stay on the island, and rear/front painter behaviour holds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRID_N, toWorld } from "../../src/components/city/iso-layout";
import { KEY_BLOCKS } from "../../src/components/city/iso-layout";
import {
  buildingOccluders,
  depthKey,
  isRearObject,
  keyBuildingFootprint,
  keyBuildingFrontDepth,
  rectInsideIsland,
  sortSceneObjects,
  type GroundObject,
} from "../../src/components/city/scene-depth";
import { sceneryDrawSlots, SCENERY_ART_HEIGHT } from "../../src/components/city/scenery-plan";
import { BUILDING_IDS, type BuildingId } from "../../src/components/city/scene-config";
import { rectsOverlap, slotsByRole, SLOTS } from "../../src/components/city/slots";
import type { GridPt } from "../../src/components/city/iso-layout";

test("every ground object footprint stays inside the island", () => {
  const rects = [
    ...slotsByRole("working-building").map((s) => s.rect),
    ...slotsByRole("scenery-block").map((s) => s.rect),
    ...slotsByRole("landmark").map((s) => s.rect),
    ...slotsByRole("record-plot").map((s) => s.rect),
    ...slotsByRole("vacant-record-lot").map((s) => s.rect),
  ];
  assert.ok(rects.length > 30);
  for (const r of rects) assert.ok(rectInsideIsland(r), `outside island: ${JSON.stringify(r)}`);
});

test("ground-level feet never overlap: scenery, landmarks and building footprints are disjoint", () => {
  const rects = [
    ...slotsByRole("working-building").map((s) => ({ id: s.id, rect: s.rect })),
    ...slotsByRole("scenery-block").map((s) => ({ id: s.id, rect: s.rect })),
    ...slotsByRole("landmark").map((s) => ({ id: s.id, rect: s.rect })),
  ];
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      assert.ok(!rectsOverlap(rects[i].rect, rects[j].rect), `${rects[i].id} overlaps ${rects[j].id}`);
  // the reported bug: the court and garden strips must sit beside, never on, the Archive
  const court = SLOTS.find((s) => s.role === "scenery-block" && s.scenery === "court")!.rect;
  const garden = SLOTS.find((s) => s.role === "scenery-block" && s.scenery === "garden")!.rect;
  const archive = keyBuildingFootprint("archive");
  assert.ok(!rectsOverlap(court, archive) && !rectsOverlap(garden, archive));
});

test("the shared depth key orders scene objects by front-corner ground position, then height", () => {
  const mk = (id: string, rect: GroundObject["rect"], heightPx?: number): GroundObject => ({ id, rect, heightPx });
  const rearScenery = mk("scenery-court", { gx: 19, gy: 2, w: 6, h: 2 }, SCENERY_ART_HEIGHT.court);
  const frontBuilding = mk("building", keyBuildingFootprint("archive"));
  // a building in front is drawn after the scenery behind it
  assert.ok(depthKey(frontBuilding.rect) > depthKey(rearScenery.rect));
  assert.deepEqual(
    sortSceneObjects([frontBuilding, rearScenery]).map((o) => o.id),
    ["scenery-court", "building"],
  );
  // equal ground depth, different heights: the flatter prop paints first
  const flat = mk("flat", { gx: 10, gy: 10, w: 2, h: 2 }, 0);
  const tall = mk("tall", { gx: 10, gy: 12, w: 2, h: 0 }, 40); // same front sum (gx+w)+(gy+h)
  assert.equal(depthKey(tall.rect), depthKey(flat.rect));
  assert.equal(sortSceneObjects([tall, flat])[0].id, "flat");
});

test("drawn scenery uses the shared key: water-side slots first, front blocks last", () => {
  const drawn = sceneryDrawSlots();
  const sums = drawn.map((s) => depthKey(s.rect));
  assert.deepEqual([...sums].sort((a, b) => a - b), sums, "scenery draw order is sorted by depthKey");
  assert.ok(drawn.every((s) => (SCENERY_ART_HEIGHT as Record<string, number>)[s.scenery] > 0));
});

test("rear/front classification: scenery behind a tall building rides in the occlusion mask", () => {
  // directly behind buildings: masked
  for (const kind of ["court", "garden", "solar"] as const) {
    const slot = SLOTS.find((s) => s.role === "scenery-block" && s.scenery === kind)!;
    assert.ok(isRearObject(slot.rect), `${kind} is rear`);
  }
  const gatehouse = SLOTS.find((s) => s.role === "landmark" && s.landmark === "gatehouse")!;
  assert.ok(isRearObject(gatehouse.rect), "gatehouse is rear");
  // in front of everything: unmasked
  for (const kind of ["market", "park", "dock", "bus-station"] as const) {
    const slot = SLOTS.find((s) => s.role === "scenery-block" && s.scenery === kind)!;
    assert.ok(!isRearObject(slot.rect), `${kind} is front`);
  }
  // every rear slot is strictly behind the building that will occlude it, and vice versa
  const inFront = [...slotsByRole("scenery-block"), ...slotsByRole("landmark")];
  for (const s of inFront) {
    const depth = depthKey(s.rect);
    assert.equal(
      (Object.keys(KEY_BLOCKS) as BuildingId[]).some((id) => keyBuildingFrontDepth(id) > depth),
      isRearObject(s.rect),
      `${s.id} rear iff a key building stands in front`,
    );
  }
});

test("the building occluders cover their own front base corner; every rear slot has one", () => {
  const occluders = buildingOccluders();
  assert.deepEqual(
    occluders.map((o) => o.id).sort(),
    [...BUILDING_IDS].sort(),
  );
  for (const o of occluders) {
    const f = keyBuildingFootprint(o.id);
    const frontCorner: GridPt = { gx: f.gx + f.w, gy: f.gy + f.h };
    assert.ok(pointInsideAnyPoly(o, toWorld(frontCorner)), `${o.id}: front corner inside the occluder union`);
  }
  for (const rear of slotsByRole("scenery-block").filter((s) => isRearObject(s.rect))) {
    const front = (Object.keys(KEY_BLOCKS) as BuildingId[]).find((id) => keyBuildingFrontDepth(id) > depthKey(rear.rect));
    assert.ok(front, `${rear.id} should have a key building in front`);
  }
});

function pointInsideAnyPoly(o: { polys: string[] }, p: { x: number; y: number }): boolean {
  return o.polys.some((poly) => pointInsidePoly(parsePoly(poly), p));
}

function parsePoly(poly: string): Array<{ x: number; y: number }> {
  return poly.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
}

function pointInsidePoly(poly: Array<{ x: number; y: number }>, p: { x: number; y: number }): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

test("sortSceneObjects keeps front scenery unmasked and puts the deepest object last", () => {
  const objects: GroundObject[] = [
    ...slotsByRole("scenery-block").map((s) => ({ id: s.id, rect: s.rect })),
    ...BUILDING_IDS.map((id) => ({ id: `building-${id}`, rect: keyBuildingFootprint(id) })),
  ];
  const ordered = sortSceneObjects(objects);
  assert.equal(depthKey(ordered[ordered.length - 1].rect), Math.max(...objects.map((o) => depthKey(o.rect))));
});

test("island helper rejects out-of-plan rects", () => {
  assert.ok(rectInsideIsland({ gx: 0, gy: 0, w: GRID_N, h: GRID_N }));
  assert.ok(!rectInsideIsland({ gx: -1, gy: 0, w: 2, h: 2 }));
  assert.ok(!rectInsideIsland({ gx: 0, gy: 0, w: GRID_N + 1, h: 2 }));
});
