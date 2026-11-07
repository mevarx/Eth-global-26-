import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CITY_MIN_GLASS_OPACITY_FOR,
  DASHBOARD_MIN_TEXT_GLASS_OPACITY,
  DASHBOARD_SKY,
  GLASS_PANEL_HEX,
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  composite,
  contrastRatio,
  hexToRgb,
  minGlassOpacity,
  relativeLuminance,
} from "../../src/lib/ui/contrast";

test("hexToRgb parses 3 and 6 digit hex and rejects junk", () => {
  assert.deepEqual(hexToRgb("#fff"), [255, 255, 255]);
  assert.deepEqual(hexToRgb("#0b1b2e"), [11, 27, 46]);
  assert.throws(() => hexToRgb("nope"));
});

test("WCAG reference values", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.ok(Math.abs(contrastRatio("#777777", "#ffffff") - 4.48) < 0.01);
});

test("composite blends and clamps alpha", () => {
  assert.deepEqual(composite("#000000", "#ffffff", 0), [255, 255, 255]);
  assert.deepEqual(composite("#000000", "#ffffff", 1), [0, 0, 0]);
  assert.deepEqual(composite("#000000", "#ffffff", 0.5), [127.5, 127.5, 127.5]);
  assert.deepEqual(composite("#000000", "#ffffff", 3), [0, 0, 0]);
});

test("minGlassOpacity returns the smallest passing 0.01 step", () => {
  const input = {
    panel: GLASS_PANEL_HEX,
    backdrop: DASHBOARD_SKY.cloud,
    text: TEXT_PRIMARY_HEX,
    target: 7,
  };
  const min = minGlassOpacity(input);
  assert.ok(min !== null);
  const at = (a: number) =>
    contrastRatio(input.text, composite(input.panel, input.backdrop, a));
  assert.ok(at(min) >= 7);
  assert.ok(at(Math.round((min - 0.01) * 100) / 100) < 7);
});

test("minGlassOpacity is null when the target is unreachable", () => {
  assert.equal(
    minGlassOpacity({ panel: "#ffffff", backdrop: "#ffffff", text: "#ffffff", target: 4.5 }),
    null,
  );
});

test("dashboard floor passes both text roles on the brightest cloud pixel", () => {
  const floor = DASHBOARD_MIN_TEXT_GLASS_OPACITY;
  assert.ok(floor > 0 && floor <= 1);
  const surface = composite(GLASS_PANEL_HEX, DASHBOARD_SKY.cloud, floor);
  assert.ok(contrastRatio(TEXT_PRIMARY_HEX, surface) >= 7);
  assert.ok(contrastRatio(TEXT_SECONDARY_HEX, surface) >= 4.5);
  const below = composite(GLASS_PANEL_HEX, DASHBOARD_SKY.cloud, floor - 0.01);
  assert.ok(
    contrastRatio(TEXT_PRIMARY_HEX, below) < 7 ||
      contrastRatio(TEXT_SECONDARY_HEX, below) < 4.5,
  );
});

test("city helper returns a passing, minimal floor", () => {
  for (const scene of ["#ffffff", "#ead7a4"]) {
    const floor = CITY_MIN_GLASS_OPACITY_FOR(TEXT_PRIMARY_HEX, scene);
    const ok = (a: number) =>
      contrastRatio(TEXT_PRIMARY_HEX, composite(GLASS_PANEL_HEX, scene, a)) >= 4.5;
    assert.ok(ok(floor));
    assert.ok(!ok(floor - 0.01));
  }
});

test("scrim stays light", () => {
  assert.ok(DASHBOARD_SKY.scrimAlpha <= 0.2);
});
