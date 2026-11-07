// Dashboard page system regression guards (FIX 4/FIX 5).
// The page-system pieces are CSS/DOM structure, so these checks pin the
// invariants the fixes establish by asserting them against the source files —
// no rendering, no network, no wallet. Fixture data is never invented here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...segments: string[]) => readFileSync(join("src", ...segments), "utf8");

const systemCss = () => read("components", "dashboard", "system.css");
const block = () => read("components", "dashboard", "Block.tsx");
const searchField = () => read("components", "dashboard", "SearchField.tsx");
const card = () => read("components", "opportunities", "OpportunityCard.tsx");
const board = () => read("components", "briefs", "OpportunityBoard.tsx");
const detail = () => read("components", "opportunities", "OpportunityDetailPanel.tsx");
const states = () => read("components", "opportunities", "OpportunityStates.tsx");
const oppCss = () => read("components", "opportunities", "opportunities.css");
const oppPage = () => read("app", "opportunities", "page.tsx");
const briefsPage = () => read("app", "briefs", "page.tsx");
const tokensCss = () => read("styles", "briefmint-tokens.css");

test("PageShell: one width and rhythm on every dashboard route", () => {
  const css = systemCss();
  assert.match(css, /--bm-page\b|\.bm-page/, "PageShell class present");
  const page = css.match(/\.bm-page\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(page, /max-width:\s*1200px/);
  assert.match(page, /padding:[^;]*24px/);
  assert.match(page, /gap:\s*16px/);
  const usage = [oppPage(), briefsPage()];
  for (const page of usage) assert.match(page, /PageShell/);
  // The measured sticky-offset var falls back to the seeded token.
  assert.match(css, /--opp-nav-h,\s*var\(--nav-height\)/);
  assert.match(tokensCss(), /--nav-height:\s*64px/);
});

test("Block: one glass card, 20px pad, 16px radius, sentence-case single title", () => {
  const css = systemCss();
  const blockRule = css.match(/\.bm-block\.bm-block\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(blockRule, /padding:\s*20px/);
  assert.match(blockRule, /border-radius:\s*16px/);
  assert.match(blockRule, /display:\s*grid/);
  const title = css.match(/\.bm-block__title\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(title, /text-transform:\s*none/);
  assert.match(title, /letter-spacing:\s*normal/);
  assert.match(title, /--bm-font-heading/);
  assert.doesNotMatch(title, /uppercase/i);
  // Block renders exactly one title row (h2) and an optional action area.
  const component = block();
  assert.match(component, /bm-block__title/);
  assert.match(component, /bm-block__action/);
});

test("BlockGrid: equal size per row, no masonry quirks", () => {
  const grid = systemCss().match(/\.bm-blockgrid\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(grid, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(300px,\s*1fr\)\)/);
  assert.match(grid, /align-items:\s*stretch/);
  assert.match(grid, /gap:\s*16px/);
});

test("SearchField: icon inside the field, 40px left padding, one shared component", () => {
  const cmp = searchField();
  assert.match(cmp, /bm-searchfield__icon/);
  assert.match(cmp, /placeholder/);
  const css = systemCss();
  const icon = css.match(/\.bm-searchfield__icon\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(icon, /position:\s*absolute/);
  const pad = css.match(/input\.bm-searchfield__input\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(pad, /padding-left:\s*40px/);
  // The dashboard filter bar and the HUD Opportunities tab both render it
  // via the same filter bar component (only one search input in source).
  assert.doesNotMatch(read("components", "opportunities", "OpportunityFilters.tsx"), /opp-search\b(?!-inner)/);
  assert.match(read("components", "opportunities", "OpportunityFilters.tsx"), /SearchField/);
});

test("Sticky bars: solid navy underlay ~0.92 alpha + blur that nothing scrolls through", () => {
  const css = systemCss();
  const topbar = css.match(/\.bm-dashboard \.topbar\.topbar\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(topbar, /backdrop-filter/);
  assert.match(topbar, /92%,\s*transparent/);
  assert.match(topbar, /var\(--nav-height\)/);
  const sticky = css.match(/\.bm-block--sticky\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(sticky, /backdrop-filter/);
  assert.match(sticky, /top:\s*var\(--opp-nav-h,\s*var\(--nav-height\)\)/);
  assert.match(sticky, /z-index:\s*var\(--z-labels\)/);
  // In-page anchors keep clear of the sticky bars.
  const anchor = css.match(/\.bm-page \[id\]\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(anchor, /scroll-margin-top/);
});

test("Cards: summary-only, clamped, selected = amber outline only", () => {
  const cardCss = oppCss();
  const title = cardCss.match(/\.opp-card__title--clamp\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(title, /-webkit-line-clamp:\s*2/);
  const summary = cardCss.match(/\.opp-card__summary--clamp\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(summary, /-webkit-line-clamp:\s*2/);
  const selected = cardCss.match(/\.opp-card--selected\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(selected, /outline:\s*2px solid var\(--bm-accent\)/);
  // No in-place expansion: the card footer only toggles the detail panel.
  const src = card();
  assert.match(src, /View details/);
  assert.doesNotMatch(src, /opp-card--expanded/);
  assert.match(src, /shortKey|formatBudget/);
});

test("Detail panel: separate blocks, sheet with focus trap and Escape", () => {
  const component = detail();
  assert.match(component, /"Summary"/);
  assert.match(component, /"Key facts"/);
  assert.match(component, /"Deliverables"/);
  assert.match(component, /"Acceptance criteria"/);
  assert.match(component, /"Exclusions"/);
  assert.match(component, /"Open questions"/);
  assert.match(component, /"Record notice"/);
  assert.match(component, /"Technical details"/);
  assert.match(component, /"Record notice"/);
  // Record notice keeps the honest namespace wording verbatim.
  assert.match(component, /Anyone may reuse the namespace tag; only the actual owner address can mutate this record\. Content renders as untrusted text\./);
  // Sheet behaviour below 1100px, sticky 480px column at >=1100px.
  const css = oppCss();
  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(css, /480px/);
  assert.match(css, /opp-detail-scrim/);
  assert.match(css, /opp-detail-sheet/);
  // Focus trap + Escape live in the component logic.
  assert.match(component, /"Escape"/);
  assert.match(component, /Tab/);
  assert.match(component, /overflow\s*=\s*"hidden"/);
});

test("Board: measured filter height drives the sticky detail offset", () => {
  const component = board();
  assert.match(component, /--opp-filter-h/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /BlockGrid/);
  assert.match(component, /OpportunityDetailPanel/);
  const css = oppCss();
  const detailSticky = css.match(/\.opp-detail \{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(detailSticky, /var\(--opp-filter-h/);
});

test("States are distinct Blocks: loading, failed, empty, stale", () => {
  const src = states();
  for (const name of ["LoadingPanel", "FailedPanel", "StaleBanner", "EmptyPanel"]) {
    assert.match(src, new RegExp(`export function ${name}`));
  }
  assert.match(src, /tone="danger"/);
  assert.match(src, /tone="warn"/);
  assert.match(src, /tone="info"/);
  // A failed read never claims the catalogue is empty.
  assert.match(src, /failed read, not an empty catalogue/);
});

test("Header block carries fixture label, freshness chip and Last refreshed right-aligned", () => {
  const page = oppPage();
  assert.match(page, /FIXTURE DATA/);
  assert.match(page, /FreshnessChip/);
  assert.match(page, /formatRefresh\(lastRefreshedAt\)/);
  assert.match(page, /bm-block__action/);
  // Truthfulness: fixtures only when the dev flag is on.
  assert.match(page, /devFixturesEnabled/);
});
