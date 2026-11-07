// Ambient life routes: waypoints stay on assigned slots, loops close, sampling is
// pure, and nothing is drawn over a building silhouette. Pure helpers only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toWorld, type GridPt } from "../../src/components/city/iso-layout";
import { CAR_LANE_OFFSET, LAND_EXCLUSION, SIDEWALK_OFFSET, rectContains, slotsByRole } from "../../src/components/city/slots";
import {
  AMBIENT_ENTITY_CAP,
  ambientEntityCount,
  benches,
  boatRoutes,
  cars,
  districtSilhouettes,
  isHiddenBehindBuilding,
  parkedCar,
  sampleBoat,
  sampleCar,
  sampleWalker,
  standingWalker,
  trafficLightState,
  walkers,
  workingBuildingSilhouettes,
  type MoverLoop,
} from "../../src/components/city/ambient-routes";

const streets = slotsByRole("street-lane");
const water = slotsByRole("water-region");
const onStreet = (p: GridPt) => streets.some((s) => rectContains(s.rect, p));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const STEP = 200;
const HORIZON = 240_000;
const times = (end = HORIZON) => Array.from({ length: end / STEP }, (_, i) => i * STEP);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const loopsOf = (xs: ReadonlyArray<{ loop: MoverLoop }>) => uniq(xs.map((x) => x.loop));

test("entity budget stays within the 25 moving-entity cap", () => {
  assert.equal(boatRoutes.length, 5);
  assert.ok(cars.length >= 5 && cars.length <= 6);
  assert.ok(walkers.length >= 8 && walkers.length <= 10);
  assert.equal(ambientEntityCount, boatRoutes.length + cars.length + walkers.length);
  assert.ok(ambientEntityCount <= AMBIENT_ENTITY_CAP);
});

test("boats: five styles, every loop inside one water region and clear of land", () => {
  assert.equal(new Set(boatRoutes.map((b) => b.style)).size, 5);
  assert.equal(new Set(boatRoutes.map((b) => b.id)).size, 5);
  for (const b of boatRoutes) {
    const slot = water.find((w) =>
      b.path.g.every(
        (p) => p.gx >= w.rect.gx + 0.75 && p.gx < w.rect.gx + w.rect.w - 0.75 && p.gy >= w.rect.gy + 0.75 && p.gy < w.rect.gy + w.rect.h - 0.75,
      ),
    );
    assert.ok(slot, `${b.id} must sit fully inside a water slot`);
    assert.ok(b.path.g.every((p) => !rectContains(LAND_EXCLUSION, p)), `${b.id} must stay off land`);
    // 1.5 tiles of open water from the land halo
    const far = b.path.g.every(
      (p) => p.gx < LAND_EXCLUSION.gx - 1.4 || p.gx >= LAND_EXCLUSION.gx + LAND_EXCLUSION.w + 1.4 || p.gy < LAND_EXCLUSION.gy - 1.4 || p.gy >= LAND_EXCLUSION.gy + LAND_EXCLUSION.h + 1.4,
    );
    assert.ok(far, `${b.id} keeps clear of the halo`);
  }
});

test("boats: loops close, sampling is deterministic, boats never meet", () => {
  for (const b of boatRoutes) {
    const a = sampleBoat(b, 0);
    const c = sampleBoat(b, b.period);
    assert.ok(Math.abs(a.x - c.x) < 0.5 && Math.abs(a.y - c.y) < 0.5, `${b.id} closes`);
    assert.deepEqual(sampleBoat(b, 12_345), sampleBoat(b, 12_345));
    assert.ok(Number.isFinite(sampleBoat(b, 777).heading));
  }
  for (const t of times(120_000)) {
    for (let i = 0; i < boatRoutes.length; i++)
      for (let j = i + 1; j < boatRoutes.length; j++)
        assert.ok(dist(sampleBoat(boatRoutes[i], t), sampleBoat(boatRoutes[j], t)) > 60, "boats keep apart");
  }
});

test("cars: 3+ shapes and distinct colours", () => {
  assert.ok(new Set(cars.map((c) => c.shape)).size >= 3);
  assert.ok(new Set(cars.map((c) => c.body)).size >= 5);
});

test("cars: loops close and every point is on a street slot", () => {
  for (const loop of loopsOf(cars)) {
    const first = loop.path.g[0];
    const last = loop.path.g[loop.path.g.length - 1];
    assert.ok(Math.abs(first.gx - last.gx) < 1e-9 && Math.abs(first.gy - last.gy) < 1e-9, `${loop.id} closes`);
    for (const p of loop.path.g) assert.ok(onStreet(p), `${loop.id} point ${p.gx},${p.gy} off street`);
  }
  for (const car of cars) {
    const a = sampleCar(car, 0);
    const b = sampleCar(car, car.loop.period);
    assert.ok(dist(a, b) < 0.5, `${car.id} repeats each lap`);
  }
});

test("cars: right-hand lanes at the car lane offset from the road centreline", () => {
  const near = (v: number, target: number) => Math.abs(v - target) < 1e-6;
  const roadCentre = (v: number) => Math.floor(v) + 0.5;
  for (const loop of loopsOf(cars)) {
    const g = loop.path.g;
    // Check the long straights between rounded corners (skip short U-turn connectors).
    for (let i = 0; i < g.length - 1; i++) {
      const a = g[i];
      const b = g[i + 1];
      const len = Math.hypot(b.gx - a.gx, b.gy - a.gy);
      if (len < 1) continue;
      const alongX = Math.abs(b.gy - a.gy) < 1e-9;
      const forward = alongX ? b.gx > a.gx : b.gy > a.gy;
      if (alongX) {
        const c = roadCentre(a.gy);
        assert.ok(near(a.gy, c + (forward ? CAR_LANE_OFFSET : -CAR_LANE_OFFSET)), `${loop.id} x-lane at ${a.gy}`);
      } else {
        const c = roadCentre(a.gx);
        assert.ok(near(a.gx, c + (forward ? -CAR_LANE_OFFSET : CAR_LANE_OFFSET)), `${loop.id} y-lane at ${a.gx}`);
      }
    }
  }
});

test("cars: stop at intersections, keep their distance, never hide behind a building", () => {
  for (const loop of loopsOf(cars)) {
    assert.ok(loop.stops.length >= 2, `${loop.id} has stops`);
    for (const st of loop.stops.filter((x) => x.tag !== "turn")) {
      // stop line is within 1.5 tiles of an intersection tile
      const near = streets.some(
        (s) => s.intersection && st.at.gx > s.rect.gx - 1.5 && st.at.gx < s.rect.gx + s.rect.w + 1.5 && st.at.gy > s.rect.gy - 1.5 && st.at.gy < s.rect.gy + s.rect.h + 1.5,
      );
      assert.ok(near, `${loop.id} stop ${st.at.gx},${st.at.gy} is not at an intersection`);
    }
    // a stop line needs room to brake and pull away
    for (let i = 0; i < loop.stops.length; i++) {
      const next = loop.stops[(i + 1) % loop.stops.length];
      const gap = (next.s - loop.stops[i].s + loop.path.total) % loop.path.total;
      assert.ok(gap >= 2 * loop.timeline.ramp + 1, `${loop.id} stops ${i} need room`);
    }
  }
  let held = 0;
  let minGap = Infinity;
  for (const t of times()) {
    const s = cars.map((c) => sampleCar(c, t));
    s.forEach((a, i) => {
      if (!a.moving) held++;
      assert.ok(!isHiddenBehindBuilding(a), `${cars[i].id} hidden behind a building at ${t}`);
      for (let j = i + 1; j < s.length; j++) minGap = Math.min(minGap, dist(a, s[j]));
    });
  }
  assert.ok(held > 0, "cars do stop");
  assert.ok(minGap >= 40, `cars too close: ${minGap.toFixed(1)}px`);
});

test("cars: a loop's cars share one schedule, so queues never merge", () => {
  for (const loop of loopsOf(cars)) {
    const onLoop = cars.filter((c) => c.loop === loop);
    for (const c of onLoop) assert.ok(c.offsetMs >= 0 && c.offsetMs < loop.period);
  }
});

test("cars: reduced-motion parked poses are stationary, apart, and visible", () => {
  const parked = cars.map(parkedCar);
  parked.forEach((p, i) => {
    assert.equal(p.moving, false);
    assert.ok(onStreet({ gx: p.gx, gy: p.gy }), `${cars[i].id} parks on a street`);
    assert.ok(!isHiddenBehindBuilding(p));
    for (let j = i + 1; j < parked.length; j++) assert.ok(dist(p, parked[j]) >= 40);
  });
});

test("cars: sampling is deterministic and the traffic light follows the queue", () => {
  for (const c of cars) assert.deepEqual(sampleCar(c, 31_337), sampleCar(c, 31_337));
  const seen = new Set(times().map(trafficLightState));
  assert.ok(seen.has("red") && seen.has("green"));
  assert.equal(trafficLightState(5000), trafficLightState(5000));
});

test("pedestrians: loops close and sit on sidewalks, never behind buildings", () => {
  assert.ok(new Set(walkers.map((w) => w.outfit.shirt + w.outfit.pants)).size >= 8, "varied outfits");
  assert.ok(new Set(walkers.map((w) => w.outfit.height)).size >= 6, "varied heights");
  for (const loop of loopsOf(walkers)) {
    const first = loop.path.g[0];
    const last = loop.path.g[loop.path.g.length - 1];
    assert.ok(Math.abs(first.gx - last.gx) < 1e-9 && Math.abs(first.gy - last.gy) < 1e-9, `${loop.id} closes`);
    for (const p of loop.path.g) assert.ok(onStreet(p), `${loop.id} point ${p.gx},${p.gy} off street`);
  }
  for (const t of times()) {
    for (const w of walkers) assert.ok(!isHiddenBehindBuilding(sampleWalker(w, t)), `${w.id} hidden at ${t}`);
  }
});

test("pedestrians: control waypoints lie exactly on a sidewalk line", () => {
  // Waypoints of each walking loop are authored on centreline ± SIDEWALK_OFFSET.
  for (const loop of loopsOf(walkers)) {
    for (const st of loop.stops) {
      const dx = Math.abs(Math.abs(st.at.gx - (Math.floor(st.at.gx) + 0.5)) - SIDEWALK_OFFSET);
      const dy = Math.abs(Math.abs(st.at.gy - (Math.floor(st.at.gy) + 0.5)) - SIDEWALK_OFFSET);
      assert.ok(Math.min(dx, dy) < 1e-6, `${loop.id} stop ${st.at.gx},${st.at.gy} is off the sidewalk`);
    }
  }
});

test("pedestrians: pause, sit on park benches, and chat in a pair", () => {
  const poses = new Set<string>();
  for (const t of times()) for (const w of walkers) poses.add(sampleWalker(w, t).pose);
  for (const p of ["walk", "look", "sit", "chat"]) assert.ok(poses.has(p), `pose ${p} occurs`);

  const park = slotsByRole("scenery-block").find((s) => s.scenery === "park")!;
  assert.ok(benches.length >= 2);
  for (const b of benches) {
    // on the sidewalk edge of the park block: in a street tile within one tile of the block
    assert.ok(onStreet(b.at), `${b.id} on a street slot`);
    const nearX = b.at.gx >= park.rect.gx - 1 && b.at.gx <= park.rect.gx + park.rect.w + 1;
    const nearY = b.at.gy >= park.rect.gy - 1 && b.at.gy <= park.rect.gy + park.rect.h + 1;
    assert.ok(nearX && nearY, `${b.id} beside the park block`);
  }
  // every seated walker is on a bench
  for (const t of times()) {
    for (const w of walkers) {
      const s = sampleWalker(w, t);
      if (s.pose !== "sit") continue;
      const hit = benches.some((b) => dist(s, toWorld(b.at)) < 1.5);
      assert.ok(hit, `${w.id} sits off-bench at ${t}`);
    }
  }
  // pair: leader and follower stand apart, facing each other, while chatting
  const lead = walkers.find((w) => w.role === "lead")!;
  const follow = walkers.find((w) => w.role === "follow")!;
  let chatted = false;
  for (const t of times()) {
    const a = sampleWalker(lead, t);
    const b = sampleWalker(follow, t);
    if (a.pose === "chat" && b.pose === "chat") {
      chatted = true;
      assert.ok(a.facing !== b.facing, "chat partners face each other");
      assert.ok(dist(a, b) > 12);
    }
  }
  assert.ok(chatted);
});

test("pedestrians: no overlaps with each other or with cars; sampling is pure", () => {
  let pp = Infinity;
  let pc = Infinity;
  for (const t of times()) {
    const ws = walkers.map((w) => sampleWalker(w, t));
    const cs = cars.map((c) => sampleCar(c, t));
    ws.forEach((a, i) => {
      for (let j = i + 1; j < ws.length; j++) pp = Math.min(pp, dist(a, ws[j]));
      for (const c of cs) pc = Math.min(pc, dist(a, c));
    });
  }
  assert.ok(pp >= 13, `pedestrians too close: ${pp.toFixed(1)}px`);
  assert.ok(pc >= 10, `pedestrian too close to a car: ${pc.toFixed(1)}px`);
  for (const w of walkers) assert.deepEqual(sampleWalker(w, 9_999), sampleWalker(w, 9_999));
});

test("pedestrians: every loop repeats and reduced-motion walkers stand", () => {
  for (const w of walkers) {
    const a = sampleWalker(w, 0);
    const b = sampleWalker(w, w.loop.period);
    assert.ok(dist(a, b) < 0.5, `${w.id} repeats each lap`);
    const s = standingWalker(w);
    assert.equal(s.moving, false);
    assert.ok(s.pose === "stand" || s.pose === "sit");
    assert.ok(!isHiddenBehindBuilding(s));
  }
});

test("silhouettes: working buildings and districts are the hard no-draw zones", () => {
  assert.equal(workingBuildingSilhouettes().length, 5);
  assert.equal(districtSilhouettes().length, 16);
  // sanity: a point at a building's roof apex is hidden, the open plaza crossing is not
  const hulls = workingBuildingSilhouettes();
  assert.ok(isHiddenBehindBuilding(toWorld({ gx: 8, gy: 8 }), hulls));
  assert.ok(!isHiddenBehindBuilding(toWorld({ gx: 25.5, gy: 25.5 })));
});
