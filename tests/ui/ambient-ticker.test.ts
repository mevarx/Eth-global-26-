import { test } from "node:test";
import assert from "node:assert/strict";
import { stepClock } from "../../src/components/city/ambient-ticker";
import { screenToWorld, worldToScreen } from "../../src/components/city/camera-store";

test("clock accumulates only while running and never jumps on resume", () => {
  let s = { elapsed: 0, last: null as number | null };
  s = stepClock(s, 1000, true);
  s = stepClock(s, 1016, true);
  assert.equal(s.elapsed, 16);
  s = stepClock(s, 5000, false); // paused (hidden)
  s = stepClock(s, 60000, true); // resume: first frame only re-anchors
  s = stepClock(s, 60016, true);
  assert.equal(s.elapsed, 32);
});

test("clock clamps long frames", () => {
  const s = stepClock({ elapsed: 0, last: 0 }, 5000, true);
  assert.equal(s.elapsed, 100);
});

test("camera conversions round-trip", () => {
  const c = { x: 120, y: -40, z: 1.5 };
  const p = { x: 33, y: 77 };
  const back = screenToWorld(c, worldToScreen(c, p));
  assert.ok(Math.abs(back.x - p.x) < 1e-9 && Math.abs(back.y - p.y) < 1e-9);
});
