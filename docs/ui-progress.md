# UI polish progress (checkpoint)

Phase: Step 0 complete. STOPPED on a hard blocker before Phase 0.
Rollback tag: `pre-ui-polish` (33f3847).

## Hard blocker
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
