// Scenery plan: every drawable scenery slot has a renderer kind, plates become label specs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS } from "../../src/components/city/slots";
import { toWorld } from "../../src/components/city/iso-layout";
import { SCENERY_RENDERABLE_KINDS, animPose, sceneryDrawSlots, sceneryLabelSpecs } from "../../src/components/city/scenery-plan";

test("every non-existing scenery slot has a renderable kind", () => {
  const scenery = SLOTS.filter((s) => s.role === "scenery-block");
  const drawn = sceneryDrawSlots();
  assert.equal(drawn.length, scenery.filter((s) => !s.existing).length);
  for (const s of drawn) assert.ok((SCENERY_RENDERABLE_KINDS as readonly string[]).includes(s.scenery), `${s.id}: ${s.scenery}`);
  for (const k of SCENERY_RENDERABLE_KINDS) assert.ok(drawn.some((s) => s.scenery === k), `unused kind ${k}`);
  assert.ok(!drawn.some((s) => s.scenery === "plaza"));
});

test("label specs cover plated slots with anchors on their ground", () => {
  const specs = sceneryLabelSpecs();
  const plated = sceneryDrawSlots().filter((s) => s.plate);
  assert.deepEqual(specs.map((s) => s.text).sort(), plated.map((s) => s.plate).sort());
  for (const spec of specs) {
    const slot = plated.find((s) => s.id === spec.id)!;
    const r = slot.rect;
    const xs = [toWorld({ gx: r.gx, gy: r.gy }).x, toWorld({ gx: r.gx + r.w, gy: r.gy }).x, toWorld({ gx: r.gx, gy: r.gy + r.h }).x, toWorld({ gx: r.gx + r.w, gy: r.gy + r.h }).x];
    assert.ok(spec.anchor.x >= Math.min(...xs) && spec.anchor.x <= Math.max(...xs));
  }
});

test("animation poses are pure and finite", () => {
  for (const kind of ["spin", "ripple", "flag", "sway", "glint"] as const) {
    const a = animPose(kind, 4000, 0.2, 5, 1234);
    assert.deepEqual(a, animPose(kind, 4000, 0.2, 5, 1234));
    if (a.opacity !== undefined) assert.ok(a.opacity >= 0 && a.opacity <= 1);
  }
});
