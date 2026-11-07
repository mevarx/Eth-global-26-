// Nameplate layout: five building labels never overlap, stay above their roof, inside the viewport and clear of HUD panels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { worldToScreen, type Camera } from "../../src/components/city/camera-store";
import {
  BUILDING_ARIA,
  buildingBodies,
  buildingLabelSpecs,
  estimateLabelSize,
  fitZoomFor,
  labelAnchorsForBuildings,
  labelFontPx,
  layoutLabels,
  type LabelSpec,
  type Rect,
} from "../../src/components/city/label-layout";
import { sceneryLabelSpecs } from "../../src/components/city/scenery-plan";

const overlap = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;

/** Mirrors CityEngine.fit() with a zoom factor relative to the fit zoom. */
function cameraAt(w: number, h: number, reserve: number, factor: number): Camera {
  const fit = fitZoomFor(w, h, reserve);
  const z = fit * factor;
  return { z, x: (w - reserve) / 2, y: h / 2 - 250 * z };
}

const SCENARIOS = [
  { name: "desktop 1440x900", w: 1440, h: 900, reserve: 436, avoid: [{ x: 1004, y: 0, w: 436, h: 900 }, { x: 0, y: 0, w: 300, h: 340 }] },
  { name: "mobile 390x844", w: 390, h: 844, reserve: 0, avoid: [{ x: 0, y: 0, w: 390, h: 56 }] },
];
const ZOOMS = [0.75, 1, 1.5];

function sizedSpecs(zoom: number): LabelSpec[] {
  const px = labelFontPx(zoom);
  return buildingLabelSpecs(zoom).map((s) => ({ ...s, ...estimateLabelSize(s.text, s.kind, px, s.id === "registry") }));
}

for (const sc of SCENARIOS) {
  for (const f of ZOOMS) {
    test(`${sc.name} at ${f}x fit: building labels are disjoint, above roof, in viewport, clear of HUD`, () => {
      const cam = cameraAt(sc.w, sc.h, sc.reserve, f);
      const specs = sizedSpecs(cam.z);
      const out = layoutLabels(specs, cam, { w: sc.w, h: sc.h }, sc.avoid);
      const rects = out.map((p, i) => ({ id: p.id, x: p.x, y: p.y, w: specs[i].width, h: specs[i].height }));
      assert.equal(out.length, 5);
      assert.ok(out.every((p) => !p.hidden), "building labels are never hidden");
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= sc.w && r.y + r.h <= sc.h, `${r.id} inside viewport`);
        for (const a of sc.avoid) assert.ok(!overlap(r, a), `${r.id} clear of HUD`);
        for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(r, rects[j]), `${r.id} overlaps ${rects[j].id}`);
        const anchor = worldToScreen(cam, specs[i].anchor);
        const visible = anchor.x > 0 && anchor.x < sc.w && anchor.y > r.h + 8 && anchor.y < sc.h;
        const hud = sc.avoid.some((a) => anchor.x >= a.x && anchor.x <= a.x + a.w && anchor.y >= a.y && anchor.y <= a.y + a.h);
        if (visible && !hud) assert.ok(r.y + r.h <= anchor.y, `${r.id} sits above its roof apex`);
      }
    });
  }
}

test("desktop labels stay off the other buildings' bodies at default zoom", () => {
  const cam = cameraAt(1440, 900, 436, 1.08);
  const specs = sizedSpecs(cam.z);
  const out = layoutLabels(specs, cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid);
  for (const [i, p] of out.entries()) {
    for (const b of buildingBodies()) {
      if (b.id === p.id) continue;
      const p0 = worldToScreen(cam, { x: b.rect.x, y: b.rect.y });
      const body = { x: p0.x, y: p0.y, w: b.rect.w * cam.z, h: b.rect.h * cam.z };
      assert.ok(!overlap({ x: p.x, y: p.y, w: specs[i].width, h: specs[i].height }, body), `${p.id} covers ${b.id}`);
    }
  }
});

test("layout is deterministic and does not mutate its inputs", () => {
  const cam = cameraAt(1440, 900, 436, 1);
  const specs = sizedSpecs(cam.z);
  const before = JSON.stringify(specs);
  const a = layoutLabels(specs, cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid);
  const b = layoutLabels(specs.slice(), cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(specs), before);
});

test("pin runs from the plate to the roof anchor", () => {
  const cam = cameraAt(1440, 900, 436, 1);
  const specs = sizedSpecs(cam.z);
  const out = layoutLabels(specs, cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid);
  for (const [i, p] of out.entries()) {
    const a = worldToScreen(cam, specs[i].anchor);
    assert.deepEqual(p.pinTo, a);
    assert.ok(p.pinFrom.y <= p.pinTo.y);
    assert.ok(p.pinFrom.x >= p.x && p.pinFrom.x <= p.x + specs[i].width);
  }
});

test("small labels never overlap and are hidden instead of colliding; building labels win", () => {
  const cam = cameraAt(1440, 900, 436, 1);
  const buildings = sizedSpecs(cam.z);
  const anchor = buildings[0].anchor;
  const small: LabelSpec[] = Array.from({ length: 120 }, (_, k) => ({
    id: `plot-${k}`,
    text: `PLOT ${k}`,
    kind: "plot" as const,
    anchor: { x: anchor.x, y: anchor.y + 30 },
    width: 60,
    height: 22,
    priority: 10,
  }));
  const specs = [...small, ...buildings];
  const out = layoutLabels(specs, cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid);
  const shown = out.map((p, i) => ({ p, s: specs[i] })).filter((x) => !x.p.hidden);
  assert.ok(out.filter((_p, i) => specs[i].kind === "building").every((placement) => !placement.hidden));
  for (let i = 0; i < shown.length; i++)
    for (let j = i + 1; j < shown.length; j++)
      assert.ok(
        !overlap({ x: shown[i].p.x, y: shown[i].p.y, w: shown[i].s.width, h: shown[i].s.height }, { x: shown[j].p.x, y: shown[j].p.y, w: shown[j].s.width, h: shown[j].s.height }),
        `${shown[i].s.id} overlaps ${shown[j].s.id}`,
      );
  assert.ok(out.some((p, i) => specs[i].kind === "plot" && p.hidden), "crowded small labels are hidden");
});

test("minZoom hides small kinds only", () => {
  const cam = cameraAt(1440, 900, 436, 0.8);
  const specs: LabelSpec[] = [
    ...sizedSpecs(cam.z),
    { id: "lm", text: "LIGHTHOUSE", kind: "landmark", anchor: { x: -300, y: 300 }, width: 90, height: 22, priority: 20 },
  ];
  const out = layoutLabels(specs, cam, { w: 1440, h: 900 }, [], { minZoom: { landmark: 5 } });
  assert.ok(out.find((p) => p.id === "lm")!.hidden);
  assert.ok(out.filter((p) => p.id !== "lm").every((p) => !p.hidden));
});

test("labelFontPx is clamped to 12..16 and anchors/aria cover the five buildings", () => {
  for (const z of [0.1, 0.3, 0.8, 1.5, 4, 10]) {
    const px = labelFontPx(z);
    assert.ok(px >= 12 && px <= 16);
    assert.ok(labelFontPx(z, "plot") >= 12 && labelFontPx(z, "plot") <= 14);
  }
  assert.equal(labelFontPx(0.01), 12);
  assert.equal(labelFontPx(100), 16);
  const anchors = labelAnchorsForBuildings();
  assert.deepEqual(anchors.map((a) => a.id).sort(), Object.keys(BUILDING_ARIA).sort());
  for (const a of anchors) assert.ok(Number.isFinite(a.anchor.x) && Number.isFinite(a.anchor.y));
});

/** Mirrors CityScene.buildAllLabelSpecs (buildings first, then landmark plates, then scenery). */
function allSpecs(zoom: number): LabelSpec[] {
  const building = (kind: "landmark" | "scenery", specs: Array<{ id: string; text: string; anchor: { x: number; y: number } }>) =>
    specs.map(
      (i): LabelSpec => ({
        id: i.id,
        text: i.text,
        kind,
        anchor: i.anchor,
        ...estimateLabelSize(i.text, kind, labelFontPx(zoom, kind)),
        priority: kind === "landmark" ? 60 : 30,
      }),
    );
  return [...buildingLabelSpecs(zoom), ...building("scenery", sceneryLabelSpecs())];
}

test("scenery plates collapse below zoom 0.9 (CityScene option) and never touch a building plate", () => {
  // the shipped CityScene configuration
  const opts = { minZoom: { scenery: 0.9 } as const };
  const low = cameraAt(1440, 900, 436, 0.78);
  const outLow = layoutLabels(allSpecs(low.z), low, { w: 1440, h: 900 }, SCENARIOS[0].avoid, opts);
  const sceneryLow = outLow.filter((_p, i) => allSpecs(low.z)[i].kind === "scenery");
  assert.ok(sceneryLow.length > 0, "scenery specs exist");
  assert.ok(sceneryLow.every((p) => p.hidden), "scenery labels hidden below zoom 0.9");

  const high = cameraAt(1440, 900, 436, 1.25); // z above the 0.9 threshold at which plates return
  const specsHigh = allSpecs(high.z);
  const outHigh = layoutLabels(specsHigh, high, { w: 1440, h: 900 }, SCENARIOS[0].avoid, opts);
  const visiblePlates = outHigh
    .map((p, i) => ({ p, s: specsHigh[i] }))
    .filter((x) => !x.p.hidden)
    .map((x) => ({ id: x.p.id, x: x.p.x, y: x.p.y, w: x.s.width, h: x.s.height, kind: x.s.kind }));
  for (let i = 0; i < visiblePlates.length; i++) {
    if (visiblePlates[i].kind !== "scenery") continue;
    for (let j = 0; j < visiblePlates.length; j++) {
      if (visiblePlates[j].kind !== "building") continue;
      assert.ok(!overlap(visiblePlates[i], visiblePlates[j]), `${visiblePlates[i].id} must not touch ${visiblePlates[j].id}`);
    }
  }
});

test("every placed plate stays within one building height of its object anchor", () => {
  const cam = cameraAt(1440, 900, 436, 1);
  const specs = allSpecs(cam.z);
  const opts = { minZoom: { scenery: 0.9 } as const };
  const out = layoutLabels(specs, cam, { w: 1440, h: 900 }, SCENARIOS[0].avoid, opts);
  const walls = buildingBodies().map((b) => b.rect.h);
  const oneBuildingHeight = Math.max(...walls);
  for (const [i, p] of out.entries()) {
    if (p.hidden) continue;
    const anchor = worldToScreen(cam, specs[i].anchor);
    const plateCenterY = p.y + specs[i].height / 2;
    assert.ok(
      Math.abs(plateCenterY - anchor.y) <= oneBuildingHeight + specs[i].height,
      `${specs[i].id} plate anchored within one building height of its object`,
    );
  }
});
