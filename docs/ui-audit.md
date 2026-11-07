# BriefMint presentation audit

Date: 2026-11-06. Scope: presentation surfaces added or rewired for the UI polish; API routes, server code, shared DTOs/validation, contracts, migrations, and legacy Jobs/Merchant pages were not edited.

## Deletions and replacements (evidence)
- `src/components/city/CityPanel.tsx` (144 lines) was removed in commit `42f47bb`: `src/app/page.tsx` now renders the props-only `BriefMintGlassPanel`, passing the existing brief, Arkiv, intake, compile, publish, evidence and reader handlers/components. `rg 'CityPanel' src` showed no remaining imports.
- `src/components/city/pixi/city-engine.ts` lost 174 lines in `42f47bb`: old Pixi plate/tag fields and draw methods (`plate*`, `tag*`, `drawPlate`, `drawTag`, `TAG_COLORS`); two boats and their update loop; `buildFillers`, `addTower`, `addHouse`; and the coastal tree loop. These are replaced by `BuildingLabels`, `AmbientWater`, `DistrictLayer`, `Scenery` and `Landmarks`. The five working buildings, worker, lighthouse, plaza, keyed trees, fountain, birds, quest marker, selection and camera remain.
- Overall `42f47bb` diff: 381 insertions, 484 deletions across the five wiring files. Other feature commits add source and tests; no public asset, API, server, shared-contract, contract, migration, or legacy-page files were deleted.

## Checks and searches
- Baseline (before edits): lint, typecheck, server/UI tests and build passed; 19 server test files / 182 tests, UI smoke 27 passing.
- `npx knip --no-progress` reported 28 unused files, 3 unused dependencies, 138 unused exports, 37 unused exported types and 5 duplicate exports. This is a candidate list, not deletion authority: it includes the required `docs/reference/` copies, test roots compiled dynamically by `scripts/run-ui-smoke.cjs`, generated/legacy contract files, and exports whose Next/dynamic/runtime use Knip does not resolve. No such files were deleted based on Knip alone.
- Dependency candidates for the package owner: `@fontsource-variable/inter` and `@fontsource/space-mono` are no longer imported after `next/font`; `@openzeppelin/contracts` is reported unused by Knip. They were not removed because package changes are limited to the three requested exact additions and package ownership is external. Added versions: gsap 3.15.1, @gsap/react 2.1.2, lucide-react 1.70.0.
- Targeted source searches over city/HUD/opportunities found no `dangerouslySetInnerHTML`, `debugger`, or `console.log`. Boat position and glass settings localStorage reads/writes are inside try/catch (`DraggableBoat.tsx`, `glass-context.tsx`). Do not store or log the independent-reader access key. Browser calls to `/api/auth/session` and `/api/briefs` return 503 with no local backend configuration; this is unavailable, not empty. Public Rabdi emitted its no-access-key/rate-limit warning. No wallet, signing, transaction, or live Arkiv write was attempted.
- New ambient routes are fixed/deterministic; the shared ticker pauses on hidden/off-screen/reduced motion and caps frame deltas. No per-frame React state is used in the new layers.
- City glass minimum is 0.63, calculated against white (worst-case city wall/foam); dashboard text panels use 0.76 against the shader's cloud color. Contrast helper unit tests cover these values.
- Presentation still has audit candidates: `src/components/hud/HudWindow.tsx` and its `.hud-window*` global CSS selectors have no importer after `CityPanel.tsx` was replaced; `src/app/globals.css` also retains some old `.hud-panel` styling. Preserve pending a separate cleanup batch with history/selector review. Knip's broad export/file findings also remain for the owning package/backend reviewer.

## Limits / follow-up
- The PRD file remains absent from this checkout; docs/ui-brief.md section 6.1 lists the repository proxy contracts used. A full PRD acceptance audit therefore cannot be claimed.
- No test exercised a real wallet or live Arkiv lifecycle. No real device check, 10-navigation WebGL leak test, forced context-loss/no-WebGL fallback, shader frame-time benchmark, exhaustive all-route browser-console audit, or complete no-sub-12px scan of legacy styling was performed.
- The verbatim reference dashboard copy intentionally retains its demo-only CSS and two ESLint warnings; it is not rendered. The original source and syntax fix are preserved.
- Screenshot evidence is outside Git under `/tmp/shots/` and `/tmp/verify/`; see final handoff for checked viewports and current limitations.

## Final local checks (after presentation cleanup)
- `npm run lint`: exit 0, 0 errors, 2 warnings confined to the unrendered reference copy (`adjustable-glass-dashboard.tsx`: reference `useEffect` dependency and `<img>` use).
- `npm run typecheck`: exit 0. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: exit 0 after removing one unused callback parameter from `tests/ui/label-layout.test.ts`.
- `npm test`: 19 server test files / 182 tests pass; UI smoke 140 tests pass, 0 fail.
- `npm run build`: Next compiled successfully and standalone output prepared. Existing Vite checkout-demo chunk-size warning (>500 kB) remains.
- Route smoke: 30 page/API route patterns. All 7 page routes returned 200. No API route returned 500; GET-only method mismatches returned 405, and configuration-dependent APIs returned 503 as expected without backend environment/wallet configuration. Config routes returned 200.
- Headless screens outside Git: `/tmp/shots/opportunities-1440x900.png` and `/tmp/shots/briefs-1440x900.png` refreshed after final budget/title/footer cleanup; `/tmp/shots/city-390x844-final.png` refreshed after the responsive HUD change; `/tmp/shots/city-1440x900.png` is from the earlier visual pass. Earlier 390px dashboard images predate the final removal of the display-only currency label and should not be treated as final evidence.

## SA-7 independent review (read-only, 2026-11-06)
- Reviewer reran lint (exit 0, 0 errors / 2 reference-copy warnings), typecheck (0), server tests (19 files / 182), UI tests (140), and production build (0). No dev server was running during checks.
- Reviewer confirmed the panel deletion did not break imports/tests, water snapping and pointer propagation are covered by source/tests, shader route scope and contrast helpers are covered, keyboard/reduced-motion code exists, and the reference `.join("\\r\\n")` fix is present.
- **Open visual/interaction checks:** no live pan/drag, keyboard walkthrough, glass preset walkthrough, forced font fallback, WebGL context-loss/no-WebGL fallback, 10-navigation GL leak test, shader frame-time or real hardware/device check. Road avoidance in label placement is soft and there is no explicit ambient-entity/label overlap guarantee.
- **Audit cleanup candidate:** `src/components/city/job-state-to-scene.ts` is not imported by the production path but is retained and tested because the requested audit explicitly requires its pure helper test and the legacy Jobs path must remain unchanged; it contains legacy payment terminology. Remove only with the frontend/backend owner’s approval and a scope decision.
- **Commit review failure:** `42f47bb` combines Phase 3 scene wiring with removals of replaced Pixi scene elements. This was necessary to avoid rendering duplicate plates/boats/fillers; history was not rewritten because the task forbids it. It is not a cleanup-only commit.
- PRD remains absent, so the reviewer used the repository proxy docs. The 21st.dev/Aceternity license is not verified; attribution requests confirmation before public submission.

## FIX 2 — Adjust glass removal (2026-11-07)
- Removed entirely: the `Adjust glass` button, its portalled popover (sliders, presets, tint picker, reset), the `GlassProvider` context/state and the `briefmint.glass.v1` localStorage persistence. Any leftover viewer-preset localStorage key is simply ignored (nothing reads it).
- Files deleted: `src/components/hud/glass-context.tsx`, `src/components/ui/adjustable-glass-dashboard.tsx` (not imported anywhere in `src/`; the verbatim reference copy remains under `docs/reference/` only for history).
- Glass look is now FIXED at the reference "Frosted" preset through `--bm-glass-*` tokens in `src/styles/briefmint-tokens.css` (updated `--bm-glass-opacity` 0.3 -> 0.7, the former Frosted default; stays above the 0.55 text-readability floor). The `.bm-glass`/`.hu-*` recipes bind directly to `--bm-glass-*`; no `--gw-*` runtime writer exists anymore.
- Wrappers replaced by plain elements: `src/components/app/DashboardFrame.tsx` (`div.bm-dashboard`), `src/components/city/CityScene.tsx` (`div.hud-layer`).
- `src/components/hud/briefmint-panel-data.ts` keeps only the contrast mirrors (BRIGHTEST_SCENE_HEX, CITY_MIN_TEXT_GLASS_OPACITY, GLASS_UNDERLAY/TINT/WELL alphas) and dropped GlassSettings/GLASS_DEFAULTS/glassCssVars/glassPresets/minOpacityForScope/normalizeGlass/parseStoredGlass; the settings-only tests in `tests/ui/briefmint-panel-data.test.ts` were removed.
- End-of-pass search over `src/` for `Adjust glass`, `GlassProvider`, `adjustable-glass`, `useGlass`, `glass-context`, `briefmint.glass`: 0 occurrences.
