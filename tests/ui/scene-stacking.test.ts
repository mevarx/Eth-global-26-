// FIX 3 static stacking assertions (fix pass): labels/scene/HUD/scrim/overlay/toasts share the
// seeded z-token scale, the selected label carries no z hack, and the HUD panel dispatches the
// scene-inert signal while its overlay is open. jsdom is not part of the UI test runner, so this
// test reads the shipped sources (programmatic CSS, no build step involved).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** UI smoke tests run with cwd = repo root (scripts/run-ui-smoke.cjs). */
const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const tokensSrc = src("src/styles/briefmint-tokens.css");
const Z = (name: string): number => {
  const m = tokensSrc.match(new RegExp(`--z-${name}\\s*:\\s*(\\d+)`));
  assert.ok(m, `--z-${name} token exists`);
  return Number(m[1]);
};
const scene = Z("scene");
const labels = Z("labels");
const hud = Z("hud");
const scrim = Z("scrim");
const overlay = Z("overlay");
const toasts = Z("toasts");

test("seeded scale keeps the fixed order scene < labels < hud < scrim < overlay < toasts", () => {
  assert.ok(scene < labels && labels < hud && hud < scrim && scrim < overlay && overlay < toasts);
});

test("city.css puts the scene world and HUD on the shared tokens", () => {
  const css = src("src/components/city/city.css");
  assert.ok(getComputedStyleValue(css, ".game-world", "z-index") === "var(--z-scene)", ".game-world uses --z-scene");
  assert.ok(getComputedStyleValue(css, ".hud-layer", "z-index") === "var(--z-hud)", ".hud-layer uses --z-hud");
});

test("the label layer is var(--z-labels) and no nameplate is raised above the HUD", () => {
  const tsx = src("src/components/city/BuildingLabels.tsx");
  assert.match(tsx, /\.bm-labels\{[^}]*z-index:\s*var\(--z-labels\)/, ".bm-labels uses --z-labels");
  assert.doesNotMatch(tsx, /\.bm-nameplate\[[^\]]*\]\{[^}]*z-index:\s*\d/, "no hard-coded z-index on nameplate states");
});

test("panel overlay, scrim and toast use the shared scrim/overlay/toast tokens", () => {
  const tsx = src("src/components/hud/BriefMintGlassPanel.tsx");
  assert.match(tsx, /\.bmg-shell\[data-mode="overlay"\]\s*\{[^}]*z-index:\s*var\(--z-overlay\)/);
  assert.match(tsx, /\.bmg-scrim\s*\{[^}]*z-index:\s*var\(--z-scrim\)/);
  assert.match(tsx, /\.bmg-toast\s*\{[^}]*z-index:\s*var\(--z-toasts\)/);
});

test("the overlay keeps the scene inert: signal exists on both sides of the contract", () => {
  const panel = src("src/components/hud/BriefMintGlassPanel.tsx");
  const signal = src("src/components/hud/overlay-signal.ts");
  const city = src("src/components/city/CityScene.tsx");
  assert.match(panel, /dispatchCityOverlay\(mode === "overlay"\)/, "panel reports its overlay mode");
  assert.match(signal, /CITY_OVERLAY_EVENT/);
  assert.match(city, /onCityOverlay/, "city scene consumes the overlay signal");
  assert.match(city, /setAttribute\("inert"/, "scene nodes get inert while the overlay is open");
  assert.match(city, /setAttribute\("aria-hidden"/, "scene nodes get aria-hidden while the overlay is open");
});

test("escape closes the overlay and focus is trapped (panel contract present)", () => {
  const panel = src("src/components/hud/BriefMintGlassPanel.tsx");
  assert.match(panel, /e\.key === "Escape"/);
  assert.match(panel, /e\.key !== "Tab"\) return;/, "Tab is handled for the focus trap");
  assert.match(panel, /toggle\.current\?\.focus\(\)/, "focus returns to the Expand button");
});

function getComputedStyleValue(css: string, selector: string, prop: string): string | null {
  const rule = css.match(new RegExp(`${selector} \\{([^}]*)\\}`));
  if (!rule) return null;
  const m = rule[1].match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : null;
}
