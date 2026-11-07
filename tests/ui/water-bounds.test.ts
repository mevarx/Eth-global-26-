// water-bounds: land snaps to water, water stays, bounds clamp, deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRID_N, toWorld } from "../../src/components/city/iso-layout";
import {
  WATER_WORLD_BOUNDS,
  clampToBounds,
  isWater,
  nearestWater,
  worldToGrid,
  type WorldBounds,
} from "../../src/components/city/water-bounds";

test("worldToGrid inverts toWorld", () => {
  for (const g of [{ gx: 0, gy: 0 }, { gx: 12.5, gy: 3 }, { gx: -4, gy: 31 }]) {
    const back = worldToGrid(toWorld(g));
    assert.ok(Math.abs(back.gx - g.gx) < 1e-9 && Math.abs(back.gy - g.gy) < 1e-9);
  }
});

test("island centre and shore halo are land; open sea is water", () => {
  assert.equal(isWater(toWorld({ gx: GRID_N / 2, gy: GRID_N / 2 })), false);
  assert.equal(isWater(toWorld({ gx: -2, gy: 10 })), false); // inside the 0.5-tile margin
  assert.equal(isWater(toWorld({ gx: -3, gy: 10 })), true);
  assert.equal(isWater(toWorld({ gx: GRID_N + 3, gy: 10 })), true);
  assert.equal(isWater({ x: 1200, y: 1000 }), true);
});

test("points outside bounds are not water", () => {
  assert.equal(isWater({ x: 1501, y: 300 }), false);
  assert.equal(isWater({ x: 0, y: -801 }), false);
  assert.equal(isWater({ x: NaN, y: 0 }), false);
});

test("land points snap to valid water, nearest side first", () => {
  for (const g of [{ gx: 15, gy: 15 }, { gx: 1, gy: 14 }, { gx: 29, gy: 5 }, { gx: 14, gy: 28 }, { gx: 15, gy: 1 }]) {
    const p = toWorld(g);
    const s = nearestWater(p);
    assert.equal(isWater(s), true, JSON.stringify(g));
  }
  const west = worldToGrid(nearestWater(toWorld({ gx: -1, gy: 14 })));
  assert.ok(Math.abs(west.gx - -2.5) < 1e-6 && Math.abs(west.gy - 14) < 1e-6);
  const south = worldToGrid(nearestWater(toWorld({ gx: 14, gy: GRID_N + 1 })));
  assert.ok(Math.abs(south.gy - (GRID_N + 2.5)) < 1e-6 && Math.abs(south.gx - 14) < 1e-6);
});

test("water points stay exactly where they are", () => {
  for (const p of [{ x: 1000, y: 900 }, { x: -1200, y: 100 }, { x: 0, y: -400 }, { x: 5.25, y: 1300.5 }]) {
    assert.deepEqual(nearestWater(p), p);
  }
});

test("bounds clamp", () => {
  assert.deepEqual(clampToBounds({ x: 9999, y: -9999 }), { x: 1500, y: -800 });
  const out = nearestWater({ x: 9999, y: 9999 });
  assert.deepEqual(out, { x: WATER_WORLD_BOUNDS.maxX, y: WATER_WORLD_BOUNDS.maxY });
  const tight: WorldBounds = { minX: -900, maxX: 900, minY: -100, maxY: 800 };
  for (const p of [{ x: 5000, y: 5000 }, { x: 0, y: 300 }, { x: -2000, y: -2000 }]) {
    const s = nearestWater(p, tight);
    assert.equal(isWater(s, tight), true);
  }
});

test("nearestWater is deterministic, idempotent and tie-stable", () => {
  const centre = toWorld({ gx: GRID_N / 2, gy: GRID_N / 2 });
  const a = nearestWater(centre);
  assert.deepEqual(nearestWater(centre), a);
  assert.deepEqual(nearestWater(a), a);
  assert.equal(isWater(a), true);
  for (let i = 0; i < 200; i++) {
    const p = { x: ((i * 7919) % 3000) - 1500, y: ((i * 104729) % 2200) - 800 };
    const s = nearestWater(p);
    assert.equal(isWater(s), true);
    assert.deepEqual(nearestWater(s), s);
  }
});
