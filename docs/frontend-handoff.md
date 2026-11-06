# Tool City — Frontend handoff (Agent B)

Commit / common contract version:
- Branch: `codex/city-frontend` on the `mevarx/Eth-global-26-` fork, based on
  `feat/tool-city-workshop-ui`.
- Contract: common project structure v1.0 (6 Nov 2026, §§9–10) + frontend/Arkiv
  assignment (§9). `config/deployment.json` is `schemaVersion: 1`,
  `configured: false`.

Files changed:
- Added the complete B-owned browser track: `src/app/{page.tsx,jobs/*,merchant}`,
  `src/components/{app,checkout,city,jobs,merchant,wallet,workshop}/*`,
  `src/lib/{arkiv,client}/*`, `examples/checkout-demo/*`, `tests/ui/*`,
  `scripts/run-ui-smoke.cjs`, `arkiv/*.md`, `public/city/README.md`.
- Merged shared contracts with Agent A's backend implementation:
  `src/lib/shared/{api,domain,deployment,fixtures,validation}.ts`.
- Removed dead code: the entire unused `apps/web` reference app (a copied
  Claude-clan game UI, ~41k lines), its `reference:*` scripts, the unused
  `src/lib/client/exports.ts` barrel, unused envelope helpers, unused
  `useCreateJob`/`useRunJob` hooks, unused `usePublicConfig` context, unused
  `WHITECHAIN_TOKEN`/`AppWagmiConfig` exports, and the unused local
  `getPublicConfig(serviceTermsText)` stub.
- Updated `README.md`, `package.json`, `examples/checkout-demo/package.json`,
  `vite.config.ts`, and `package-lock.json` for the integrated workspace.

Commands run and actual results (Node v24.14.1, npm 11.x):
- `npm install` → 513 packages added; lockfile updated.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → exit 0.
- `npm run test:server` → 2 files, 21 tests, 21 pass.
- `npm run test:ui` → 13 tests, 13 pass.
- `npm run test:contracts` → 5 tests, 5 pass (solc 0.8.30).
- `npm run lint` → exit 0.
- `npm run build` → Vite checkout demo + Next production build pass (14 app
  routes); standalone assets prepared.

Real Arkiv write/query/update/withdrawal evidence:
- NONE. `src/lib/arkiv/{schema,read,write}.ts` implement the SDK 1.0.1 adapter
  and wallet-signed create/update/withdraw paths, but no funded merchant wallet
  has broadcast a Rabdi transaction yet. No explorer link or tx hash is
  fabricated here. The adapter is compile-tested only.

ABI/deployment manifest commit consumed:
- `src/lib/shared/checkout-abi.ts` is Agent A's generated ABI from
  `contracts/ToolCityCheckout.sol`.
- `config/deployment.json` has `terms: null`, `configured: false`; no checkout/
  merchant/service addresses or Whitechain RPC/explorer values are deployed yet.
- Manifest values: Arkiv Rabdi `chainId 7794095`; Whitechain `chainId 1874`;
  official token `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`; Max 250 words /
  5,000 chars; 1 test USDT fixed price.

Live API paths vs development fixtures:
- Backend is implemented on this branch: auth challenge/verify/session/logout,
  jobs create/list/get, verify-payment, run, edits, merchant purchases + CSV.
  It still fails closed until checkout/review is configured and a real Arkiv
  reader is connected (`GET /api/config` reports `configured: false`).
- Fixtures in `src/lib/shared/fixtures.ts` are explicitly labelled
  (`supported: false`, `freshness: "stale"`, fixture-titled) and render only
  behind `NEXT_PUBLIC_ENABLE_DEV_FIXTURES=true`. They are never live evidence.

Wallet/network/browser behavior verified:
- Not executed against a live wallet/network in this handoff. The code paths
  exist for Arkiv Rabdi merchant writes (chain 7794095) and Whitechain buyer
  checkout (chain 1874, official token): account/network checks, exact-amount
  allowance/approve, compiled-ABI `purchase`, 202 retry/backoff verification,
  account-switch cache clear, and deliberate-only `run`. These still need a
  funded-wallet browser run once deployment values are real.

Known failures / limitations:
1. No live Arkiv listing, deployed checkout, official-token purchase or private
   0G request has been exercised; `configured: false` is honest.
2. `tests/ui/smoke.test.ts` covers shared validation/segmentation/address rules,
   fixture labelling, `jobStateToScene`, and the documented export rule. It does
   not cover DOM, wallet flows, polling or API integration.
3. `scripts/run-ui-smoke.cjs` resolves runtime deps from the repo
   `node_modules` via `NODE_PATH`; run it after `npm install`/`npm ci`.
4. The generated `public/checkout-demo/` output is gitignored and not committed.

What Agent A must merge or do next:
1. Deploy the checkout contract, fill `config/deployment.json` with verified
   addresses/RPC/explorer/terms, and reconcile terms before enabling purchases.
2. Publish a real Arkiv workshop from the merchant wallet and record actual
   entity key, tx hashes, update and withdrawal evidence.
3. Configure 0G private inference and run a real paid translation end to end.
4. Replace every FIXTURE slot in `docs/demo-script.md` with live evidence and
   have both teammates sign the both-parties review note before submission.

## BriefMint city polish (2D animation pass)

- Labels: Creator's Home → **Planning Desk**; Treasury id keeps the **Release Desk** label
  with a neutral document-and-check emblem (the gold finial was removed); AI Studio,
  Registry Hall and Archive are unchanged. Building ids and positions are unchanged.
- `src/components/city/city-state.ts` is a pure, serializable mapping
  (`deriveCityState`, `cityInputFromBrief`) for execution × review × publication ×
  freshness → worker location/pose/carry, per-building visuals and the status line.
  `briefStateToScene` now delegates to it and adds `scene.city`. "Live" requires
  entity key + expiry block + observation; stale/unavailable reads never render as
  closed/expired. Tests live in `tests/ui/briefmint.test.ts` (all 1,440 input combinations).
- `walk-path.ts` (pure) routes the worker along the two street centrelines only.
  `Worker.tsx` animates via requestAnimationFrame writing the SVG transform attribute;
  it never sets React or brief state. It jumps (no travel) on first render, on a
  different brief id, and under reduced motion.
- `city.css` animates only transform, opacity and stroke-dashoffset. The scene root's
  `data-anim` (`on` / `paused` when hidden or off-screen / `off` for reduced motion)
  switches every animation.
- Dev-only state previews: `npm run dev`, then open `/?cityFixture`. The selector and
  status text are labelled DEV FIXTURE and are compiled out of production builds.
- Not done: `src/app/page.tsx` never sets `reopened`, so the worker never goes to the
  Archive yet. Worker at Archive needs a page-level flag (outside the city files).

### Emulator-style city (PixiJS, full screen)

- `/` is a full-screen game view: `src/components/city/pixi/city-engine.ts` draws an isometric
  tile island (grass checkerboard, road grid, sand coast, sea, filler towers/houses, lighthouse,
  boats) with drag-to-pan, wheel/pinch zoom and +/−/reset buttons. Fonts: Space Mono + Inter
  (`@fontsource`), no network font requests. Dark HUD theme only (the light/dark toggle is gone).
- `src/components/city/iso-layout.ts` (pure, tested) owns the grid, plots and street-only worker
  routes (`isoRoute`: along the current road, at most two turns). `iso-buildings.ts` gives the key
  building geometry to both the engine and the HTML hit layer.
- HUD windows (`src/components/hud/HudWindow.tsx`) float over the map: City scan (top-left),
  Next step with the aria-live status and the existing next-action handler (bottom-left), and the
  BriefMint console (right) holding wallet, nav, building tabs and the existing `CityPanel`.
- The engine only reads `CityState`. Camera moves write a CSS transform onto the hit layer; no
  React state per frame. Fixture previews never get green/live colouring on tags or chips.
- Narrow screens: the map becomes a 62vh viewport and the windows stack below it.

## UI polish handoff — 2026-11-06
The presentation pass added the dashboard-only cloud backdrop, design tokens/next-font setup, glass HUD and Adjust glass control, Opportunities cards/filters, and deterministic city overlays for record plots, landmarks, scenery, boats and ambient routes. Phase commits and evidence are recorded in `docs/ui-progress.md` and `docs/ui-audit.md`. Added exact packages: gsap 3.15.1, @gsap/react 2.1.2, lucide-react 1.70.0. The VM has no wallet and the BriefMint session/brief APIs report unavailable; real wallet and Arkiv lifecycle behavior was not tested. Headless screenshots are saved outside Git at `/tmp/shots/` (desktop/mobile); the mobile city screenshot was refreshed after the responsive overlay adjustment.

Independent reviewer (SA-7) reran lint, typecheck, server/UI tests and build successfully. Browser/wallet/device interactions remain manual; see `docs/ui-audit.md`. Reviewer noted soft road avoidance, no explicit ambient-entity/label overlap verification, a retained legacy `job-state-to-scene.ts` candidate, and one mixed Phase3 wiring/removal commit. The PRD and source licenses still require human confirmation.
