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
