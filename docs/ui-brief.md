# BriefMint UI polish: shared subagent brief

Every subagent reads this file completely before working. Sections 1–5 are the owner's
verbatim rules; section 6 is the LEAD's architecture contract; section 7 lists every
workstream so you know who owns what.

## 1. PROJECT
You are working on Tool City / BriefMint (ETHGlobal Mumbai) in this repository, a running Next.js app, on a VM. Product spec: docs/BriefMint-PRD.md (NOT PRESENT in this checkout; see 6.1). BriefMint turns a community lead's PRIVATE notes into a structured work brief, lets the owner approve exactly what becomes public, and publishes an opportunity to Arkiv with wallet ownership. There is no payment: advertised budgets are UNFUNDED and BriefMint never holds or moves funds.

## 2. TASK
A UI refinement, readability pass, visual enrichment and full code audit. Everything already working (wallet login, brief intake, compile, approve, publish, Arkiv reads, animations, worker movement) must keep working. This task changes presentation and adds presentation-only components. It must NOT change API routes, server code, shared DTOs/types, validation, contracts, migrations, or the legacy translation/payment code (Jobs and Merchant legacy pages stay as they are).

## 3. SCOPE RULES (read twice)
- The CLOUD SHADER appears ONLY on full-page dashboard routes (Opportunities, My Briefs, any other non-city page). It must NOT appear on the city page, behind the HUD, behind the Expand overlay, or anywhere in the scene.
- The CITY PAGE keeps the animated scene as its backdrop. Every HUD element on it is GLASSMORPHISM using the reference glass component's recipe and Adjust-glass controls.

## 4. VM RULES
- Never run transactions, signing, deployments, or anything with real funds or keys. Never print, log or commit secrets or access keys. There is no wallet: for visual checks use NEXT_PUBLIC_ENABLE_DEV_FIXTURES mode (visibly labelled FIXTURE DATA). Do not claim wallet flows were verified.
- Screenshots (if a headless browser exists outside the repo) go OUTSIDE git (e.g. /tmp/shots). Never change package.json or the lockfile.
- Do not push, merge, create or switch branches, or rewrite history.

## 5. GLOBAL RULES (every agent)
- Truthfulness (PRD BM-15): no fake data on the live path; no random or timer-generated state. Counts, houses, towers, cards and charts come only from persisted records or real reads. Empty means empty. A failed read is "unavailable", never "empty" or "expired". "Live" means reconciled on Arkiv; a transaction hash alone is not live. No progress bars or percentages for AI compilation. Unknown verification stays "unknown". Ambient life (boats, people, cars, scenery) is decoration: it never represents data, never affects state, and is visually distinct from the worker (only the worker carries a parcel and a highlight marker).
- Privacy: no private notes, model output or evidence inside the scene, labels, tooltips or explainers. Public title and summary only, only to the signed-in owner.
- No payment or finance wording or imagery anywhere (USDT, coin, receipt, paid, balance, savings, cash flow, USD totals, armored trucks, money symbols). No "sample data" footers on the live path. (Exception: the verbatim reference copy src/components/ui/adjustable-glass-dashboard.tsx, which is never rendered.)
- Fixtures only behind NEXT_PUBLIC_ENABLE_DEV_FIXTURES (`fixturesEnabled()` in src/lib/shared/fixtures.ts), with a FIXTURE DATA label.
- Accessibility: keyboard-focusable controls with visible focus and accessible names; aria-live text for real state; prefers-reduced-motion respected (no travel, loops, parallax or shader animation; instant or opacity-only changes; vehicles and pedestrians shown parked/standing, boats still); nothing flashing more than 3 times per second.
- Performance: animate only transform, opacity and stroke-dashoffset; no per-frame React state (refs and direct transforms); ONE shared ambient ticker (src/components/city/ambient-ticker.ts, requestAnimationFrame, paused when the tab is hidden or the scene is off-screen); at most 25 simultaneously moving ambient entities; clean up all listeners, timers, rAF handles and WebGL contexts on unmount.
- Dependencies: gsap 3.15.1, @gsap/react 2.1.2 and lucide-react 1.70.0 are installed (exact). Do NOT install anything else (no Tailwind, shadcn, clsx, tailwind-merge, three.js). Fonts use next/font (built in).
- Original artwork only, except the two reference components copied from docs/reference/. Colors only through the design tokens (SA-8, CSS variables `--bm-*`); no hard-coded hex values in components after cleanup. Inside SVG use `fill="var(--bm-…)"` or token constants.
- If a decision is ambiguous choose the simpler option and note it.
- Each subagent may create or edit ONLY its listed files. Nobody edits the scene root (CityScene.tsx, pixi/city-engine.ts), HUD root (CityPanel.tsx, HudWindow.tsx), layout, page files or another agent's files; write a short WIRING NOTE (file plus exact change) in your report instead. Only LEAD wires.
- Each subagent ends with a report of at most 12 lines: files, wiring notes, what it could not do, what to verify by eye.

## 6. LEAD architecture contract (binding for all subagents)
6.1 PRD: docs/BriefMint-PRD.md is not in the repository. Use as the authoritative proxies:
`src/lib/shared/briefmint.ts` (BriefView, statuses, OpportunityView), `src/components/city/city-state.ts`
(implements PRD §5 worker mapping, §10 state model, BM-15), `docs/briefmint/integration-contract.md`,
`docs/briefmint-contract.md`, `docs/briefmint/backend-checkpoint.md` (BM acceptance matrix). Never invent product claims.

6.2 Do NOT commit. The LEAD commits each subagent's files. Do not run `npm run build` or the dev server
(LEAD does). You may run `npx tsc --noEmit`, `npx eslint <your files>`, `npm run test:ui`; ignore errors in
files other agents are editing concurrently, but your own files must be clean.

6.3 Tests: pure-helper tests go in `tests/ui/<name>.test.ts` using `node:test` + `node:assert/strict`
with RELATIVE imports (`../../src/...`). Every `tests/ui/*.test.ts` runs via `npm run test:ui`
(tsc to CommonJS, strict). Test files must be `.ts` and import only pure `.ts` modules (no .tsx, no CSS, no DOM).

6.4 Scene renderer: the city is drawn by PixiJS (`src/components/city/pixi/city-engine.ts`, LEAD-only).
World coordinates: `toWorld({gx, gy})` in `src/components/city/iso-layout.ts` → `{ x: (gx-gy)*20, y: (gx+gy)*10 }`.
Grid 30×30, roads on lines 4/11/18/25 (tiles 2..27), 6×6 blocks, sand ring of 2 tiles, lighthouse at grid (0.9, 22.5).
Building geometry: `src/components/city/scene-config.ts`, `iso-geometry.ts`, `iso-buildings.ts`, engine `buildKeyBuilding`.
Building ids → names: home = Planning Desk, studio = AI Studio, treasury = Release Desk, registry = Registry Hall, archive = Archive.

6.5 Overlay layers: all NEW scene content is DOM/SVG overlays ABOVE the Pixi canvas, camera-synced.
- Camera: `src/components/city/camera-store.ts` (`CameraStore` with get/set/subscribe, `worldToScreen`,
  `screenToWorld`, `worldTransform`). screen px are relative to the scene host's top-left corner.
- WORLD-SPACE layers (scenery, districts, ambient life, boats, landmarks) export a component that renders an
  SVG `<g>` drawn in WORLD pixels. LEAD places all of them inside ONE `<svg overflow="visible">` within a div whose
  CSS transform = worldTransform(camera) (transform-origin 0 0), in this order: water and boats, scenery, district
  layer, street entities, landmarks; working buildings and the worker stay in Pixi. The svg root has
  pointer-events none; interactive children set `pointer-events: auto` (style or attribute).
- SCREEN-SPACE layers (BuildingLabels and other labels) render absolutely positioned HTML in a top layer and
  subscribe to the CameraStore, writing `style.transform` directly (no React state per camera move).
- The engine binds `pointerdown`/`wheel` on the scene host element and `pointermove/up` on window. Any interactive
  overlay element (boats while dragging, labels, plots) must `stopPropagation()` on `pointerdown` (and `wheel` if relevant)
  so the map does not pan/zoom; clicks must not bubble into building selection.
- Overlays render only when the Pixi engine is running (CameraStore has a camera). The SVG fallback scene gets none.
- Because overlays sit above the canvas, never place an entity where it would visually cover a working building:
  street entities use lanes whose screen position is not behind a working building's silhouette (test it).

6.6 SLOT PLAN: `src/components/city/slots.ts` (read it). `SLOTS` assigns every tile: working-building blocks
(5), record plots (`HOUSE_SLOTS` 8 lots in block (1,2) for brief houses, `TOWER_SLOTS` 8 lots in block (2,1)
for opportunity towers, filled in `index` order), 2 vacant record lots, landmarks (lighthouse on sand — existing in
Pixi; gatehouse, clock-tower, notice-board on the west strip), scenery blocks (`plaza` existing in Pixi — do not draw;
`park` block (2,2); strip scenery solar/garden/court/bus-station/playground/amphitheater/market/wind/grove; four
corner groves; a shoreline `dock` on east sand), street lanes (segments + intersections; `CAR_LANE_OFFSET`,
`SIDEWALK_OFFSET` from road centrelines), and 4 water regions (`LAND_EXCLUSION` is land + shallow halo). Place
nothing outside your slots.

6.7 Ambient ticker: `src/components/city/ambient-ticker.ts` — `createAmbientTicker()`; subscribers get accumulated
visible time in ms; `stepClock` is pure. Positions must be pure functions of that time (no Math.random, no Date.now).
The LEAD creates one ticker in the scene and passes it as a prop (`ticker: AmbientTicker`).

6.8 Glass: the city HUD uses the reference `.gw-glass` recipe driven by `--gw-blur`, `--gw-opacity`,
`--gw-saturation`, `--gw-tint`, `--gw-edge` (SA-1 `glass-context.tsx`). Dashboard routes use the same settings
plus `DashboardBackdrop` (SA-9). Minimum text-panel opacity on dashboard routes comes from SA-9 `contrast.ts`.

6.9 Existing data/handlers for the HUD live in `src/app/page.tsx` (HomePage) and `src/components/city/CityPanel.tsx`,
`src/components/briefs/*` (BriefIntakeForm, BriefList, BriefReview, ReleaseDesk, OpportunityPublisher,
OpportunityBoard, OpportunityReader, BriefEvidence), hooks `src/lib/client/use-briefs.ts`, `use-session.ts`,
`briefmint-api.ts`, Arkiv reads `src/lib/arkiv/opportunities-independent.ts`. REUSE these components and handlers
by passing them in as props/render slots; never reimplement business logic.

## 7. WORKSTREAMS (owner's text, abbreviated only where noted)
See the owner's original message for full text; each subagent receives its own workstream verbatim in its prompt.
- Phase 1: SA-8 design system; SA-9 cloud shader backdrop; SA-1 glass dashboard + city HUD; SA-6 Opportunities page.
- Phase 2: SA-2 nameplates; SA-3 living districts; SA-4 explainer landmarks; SA-5 draggable boats; SA-10 ambient life; SA-11 scenery.
- Phase 3 LEAD wiring; Phase 4 SA-12 audit; Phase 5 SA-7 review (read-only); Phase 6 LEAD report.

## 8. Token and class contract (SA-8 implements; everyone else may rely on these names now)
CSS custom properties (defined on `:root` in `src/styles/briefmint-tokens.css`):
- Colors: `--bm-bg-0 #060f1a`, `--bm-bg-1 #0b1b2e`, `--bm-bg-2 #10263d`, `--bm-line`, `--bm-text-primary`, `--bm-text-secondary`,
  `--bm-text-muted`, `--bm-accent` (amber), `--bm-on-accent`, `--bm-teal`, `--bm-success`, `--bm-warning`, `--bm-danger`, `--bm-info`.
- Fonts (set from next/font variables): `--bm-font-body` (Inter), `--bm-font-heading` (Space Grotesk), `--bm-font-mono` (JetBrains Mono).
- Type: `--bm-text-xs 12px` (minimum anywhere), `--bm-text-sm 13px`, `--bm-text-md 15px`, `--bm-text-lg 17px`, `--bm-text-page 32px`, `--bm-leading 1.55`.
- Spacing `--bm-space-1..6` = 4, 8, 12, 16, 24, 32px; radii `--bm-radius-sm 8px`, `--bm-radius-md 12px`, `--bm-radius-lg 16px`; `--bm-touch 40px`.
- Focus: `--bm-focus-ring` (2px amber), offset 2px.
- Glass defaults: `--bm-glass-blur`, `--bm-glass-opacity`, `--bm-glass-saturation`, `--bm-glass-tint`, `--bm-glass-edge`,
  `--bm-glass-surface`, `--bm-glass-highlight`, `--bm-glass-shadow`, `--bm-glass-min-text-opacity` (dashboard, from SA-9; city 0.35 floor from SA-1).
- Dashboard sky: `--bm-sky-top #1f5fa8`, `--bm-sky-bottom #7ec0ee`, `--bm-cloud #f4f7fb`, `--bm-scrim`.
- Scene palette for overlay SVG art: `--bm-scene-*` (SA-8 defines a small set: grass, sand, water, roof, wall, wood, foliage, etc.).
Classes (in `src/styles/briefmint-tokens.css` / `typography.css`):
- `.bm-glass` — the reference `.gw-glass` recipe (backdrop blur+saturate from `--gw-*` vars falling back to `--bm-glass-*`,
  inset top highlight × edge, inset 1px border highlight, soft outer shadow, tint overlay via ::before, solid fallback under
  `@supports not (backdrop-filter: blur(1px))`). `.bm-glass--text` adds a thin solid-navy underlay so text stays readable.
- `.bm-btn`, `.bm-btn--primary` (amber, text `--bm-on-accent`), `.bm-btn--ghost`, `.bm-chip` (+ `--ok|--warn|--danger|--info|--muted`),
  `.bm-input`, `.bm-card`, `.bm-tag` (ALL CAPS 12px, letter-spacing ≥0.06em), `.bm-mono`, `.bm-num` (tabular), `.bm-title-page`,
  `.bm-title-panel`, `.bm-secondary`, `.bm-muted`, `.bm-sr-only`, `.bm-measure` (~70ch).

## 9. Shared component contract
`src/components/opportunities/OpportunityCard.tsx` (SA-6), props-only, default export:
`{ opportunity: OpportunityView; freshness: "fresh" | "stale" | "unavailable"; lastRefreshedAt?: number | null;
   selected?: boolean; onSelect?: (o: OpportunityView) => void; compact?: boolean }`.
Also a named export `StatusChip` in `src/components/opportunities/StatusChip.tsx` (SA-6):
`{ tone: "ok" | "warn" | "danger" | "info" | "muted"; icon?: ReactNode; children: ReactNode }` (text + icon, never color alone).
