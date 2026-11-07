# UI polish progress (checkpoint)

Phase: Phase 3 (LEAD wiring) in progress. Phases 0-2 committed; dashboard wiring committed.
Rollback tag: `pre-ui-polish` (33f3847).

## Former blocker (resolved 2026-11-06)
The owner supplied both reference components; they are in docs/reference/. The PRD is still absent;
proxies are listed in docs/ui-brief.md section 6.1.

### Original note
The task requires these inputs, and none of them exist in this checkout or on any remote branch
(checked: briefmint/frontend-city, briefmint/fullstack, codex/city-frontend, codex/final-rework,
codex/initial-readme, codex/payment-backend, codex/project-cleanup-readme,
feat/tool-city-workshop-ui, hoplite/oropos-41be4b9c):
- `docs/BriefMint-PRD.md` (other docs say it lives in the parent "Eth Global" directory, outside the repo)
- `docs/reference/cloud-shader.tsx` and its demo (SA-9 copies VERT/FRAG/parseHex/compile verbatim)
- `docs/reference/adjustable-glass-dashboard.tsx`, its demo and screenshot (SA-1 verbatim copy,
  the `.join("\r\n")` fix, and the glass recipe every city HUD element must use)
Next step: commit those files under `docs/` (and the PRD), then resume at Phase 0.

## Step 0 findings
- City route `/` (src/app/page.tsx renders CityScene + CityPanel). Dashboard routes: `/opportunities`,
  `/briefs`, `/briefs/[id]`. Legacy (unchanged): `/jobs`, `/jobs/[jobId]`, `/merchant`.
- Scene: src/components/city/CityScene.tsx (SVG fallback + Pixi engine src/components/city/pixi/city-engine.ts,
  1479 lines: procedural trees, houses, lighthouse, 2 boats, nameplates, pan/zoom, its own Pixi ticker).
  Geometry: src/components/city/iso-layout.ts (30x30 iso grid, TILE_W 40, TILE_H 20, roads at 4/11/18/25,
  6-tile blocks, sand ring 2, key plots per building, plaza block 1,1).
- HUD/right panel: src/components/city/CityPanel.tsx, src/components/hud/HudWindow.tsx; intake
  src/components/briefs/BriefIntakeForm.tsx. Labels: src/components/city/scene-labels.ts.
- Layout src/app/layout.tsx (fontsource Inter + Space Mono), global CSS src/app/globals.css, shell
  src/components/app/AppShell.tsx. Hooks/clients: src/lib/client/{use-briefs,use-session,briefmint-api}.ts,
  src/lib/arkiv/opportunities-independent.ts, src/lib/arkiv/briefmint/read.ts.
- Versions: Next 16.4.5, React 19.3.1, TypeScript 5.9.3, Node 24. No Tailwind, no shadcn components.json,
  no src/components/ui, no src/lib/utils.ts, no clsx/tailwind-merge, no gsap/@gsap/react/lucide-react.
  `@/*` -> `./src/*` exists. Scripts: lint, typecheck, test (test:server vitest + test:ui node), build.
- Google Fonts reachable from the VM (fonts.googleapis.com css2 -> 200).

## Baseline (2026-11-06, before any change)
- `npm run lint` exit 0; `npm run typecheck` exit 0
- `npm test`: vitest 19 files / 182 tests pass; UI smoke 27 pass, 0 fail
- `npm run build`: exit 0 (Vite demo + Next, 31 app routes)

## Done
- References saved to docs/reference/ (verbatim; demos included).
- gsap 3.15.1, @gsap/react 2.1.2, lucide-react 1.70.0 added (exact, root lockfile only).
- src/components/ui/{cloud-shader,adjustable-glass-dashboard}.tsx copied (inline styles; \r\n fix).
- Phase 0: src/components/city/slots.ts (+tests), camera-store.ts, ambient-ticker.ts (+tests);
  scripts/run-ui-smoke.cjs now runs every tests/ui/*.test.ts.
- Shared brief for subagents: docs/ui-brief.md.

## Next
Phase 1 subagents, then Phase 2, Phase 3 wiring, Phase 4 audit, Phase 5 review, Phase 6 report.

## Phase 1-2 results (committed, one commit each)
SA-8 tokens/fonts, SA-9 shader+backdrop+contrast (dashboard text glass floor 0.76), SA-6 Opportunities page,
SA-1 glass panel/provider (city floor raised 0.35 -> 0.63 vs white walls), SA-2 labels, SA-3 districts,
SA-4 explainers (owner wording only), SA-5 boats, SA-10 ambient life, SA-11 scenery.
Deviation: Phase 2 started in parallel with Phase 1 (only depended on Phase 0 contracts).

## Phase 3 remaining
City wiring: engine removals (plates/tags, boats, fillers, coastal palms), CityScene overlay stack + camera
store + ticker + labels + glass HUD, page.tsx -> BriefMintGlassPanel. Then smoke test + screenshots.

## Phase 3 checkpoint (2026-11-06)
Committed city wiring in `42f47bb`: `BriefMintGlassPanel` replaces CityPanel; scene overlays are camera-synced;
old Pixi plates/tags, boats, filler houses/towers and coastal tree loop were removed; engine workbench inset
uses the actual HUD panel geometry. Dashboard-only route layouts wire DashboardBackdrop; `/` imports no shader.

## Phase 4 checkpoint
Added `docs/ui-audit.md`. Knip, security/privacy and UI-language searches were run. One unused local in
`tests/ui/label-layout.test.ts` was corrected; display-only USD and “Paid placements” fixture wording removed;
city mobile CSS keeps the world behind glass HUD; dashboard legacy footer is hidden. Remaining audit candidates
and unverified checks are listed in the audit document, not claimed complete.

## Phase 5 / final checkpoint
SA-7 read-only review: pending final check. Final static checks, production build, route smoke, screenshots,
reviewer failures and manually outstanding wallet/device work are to be added here before handoff.

## Final local verification (Phase 4)
- Lint: 0 errors, 2 warnings only in the unrendered copied dashboard reference. Typecheck and strict noUnused check pass.
- Tests: 19 server files / 182 tests; UI smoke 140 tests, all pass.
- Production build compiled, prepared standalone assets; existing demo Vite chunk warning remains.
- Smoke-tested 30 route patterns: all 7 pages 200; API GET 200, expected 405 or config-dependent 503; no 500.
- Screenshots outside Git: current dashboard desktop and mobile city screenshot locations/evidence details are in docs/ui-audit.md. Browser renders the dashboard shader only on dashboard routes; previous DOM probe reported city backdrop canvas 0 and dashboard backdrop 1.
- SA-7 independent review is still running; update this checkpoint with its actual report before final handoff.

## Phase 5 reviewer result / final status
SA-7 completed read-only review. Lint (0 errors, 2 warnings), typecheck, 19 server files/182 tests,
140 UI tests and production build all pass in the review. PASS items: route-specific shader wiring,
contrast helper checks, water snap/source behavior, keyboard/reduced-motion implementation, no CityPanel
imports, and CRLF join fix. PARTIAL: label road avoidance is soft; ambient-v-label overlap, browser interaction,
font fallback and shader failure modes were not exercised. FAIL: Phase3 commit `42f47bb` combines wiring with
scene removals rather than a cleanup-only commit; history was not rewritten due the no-rewrite rule. See
`docs/ui-audit.md` and reviewer lines/paths in this checkpoint for limitations and manual wallet/device steps.
The PRD file and attribution license remain unverified. Dev server stopped after route smoke and screenshots.

## Fix pass 2026-11-07 (tag `pre-fix-pass`)
All seven spec fixes landed in one pass. Per-fix root causes and files: see
`docs/ui-audit.md` and the commit list of the fix-pass branch. Gains:
1+3 scene depth key + building-occlusion mask + label re-anchor + z-index
token scale with inert/focus-trap overlay; 2 glass fixed at Frosted defaults,
Adjust glass removed incl. provider and localStorage; 4+5 PageShell/Block/
BlockGrid system, sticky 480px detail panel, solid-navy nav/filter underlay,
shared SearchField; 6 equal-flex HUD tabs with icon-only fallback under 440px;
7 shared opportunities hook + module cache (N/M semantics, loading-not-0),
publication test clock fixed. Verified: typecheck/lint clean, server tests
182/182, UI tests 167/167, production build clean. Visual browser passes
confirmed the city scene and the Opportunities page; remaining manual checks:
overlay focus walk, zoom 0.75/1/1.5 sweep, 390px phone width.
