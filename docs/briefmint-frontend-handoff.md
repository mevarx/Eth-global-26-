> **Current status — 7 November 2026 IST:** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint frontend handoff (Agent B)

**Branch state:** uncommitted working tree in `tool-city/` (no git repo here —
no commit/push is claimed). Base: legacy translation backend + Next.js city UI.

**Contract:** BriefMint-PRD.md §§9–11. Frozen proposal:
`docs/briefmint-contract.md` v0.1-briefmint-proposed — **pending San/backend
confirmation**. Legacy contract v1.0 (`domain.ts`/`api.ts`) preserved untouched.
Old `/api/jobs/*` routes are NOT assumed for BriefMint; the UI targets the
proposed `/api/briefs/*` + `/api/briefmint/config` paths and degrades honestly
to `unavailable` until the backend implements them.

## Exact frontend files changed

**New shared contract (proposed, client-safe):**
- `src/lib/shared/briefmint.ts` — DTOs, namespace, states, allowlist payload
- `src/lib/shared/briefmint-validation.ts` — bounds, canonical hash, approval check, filters
- `src/lib/shared/briefmint-api.ts` — proposed endpoint DTOs + route table

**New Arkiv layer (real SDK, no simulation):**
- `src/lib/arkiv/opportunity-schema.ts` — `tool-city.opportunity.v1` definition
- `src/lib/arkiv/opportunities-read.ts` — server-neutral indexed reads
- `src/lib/arkiv/opportunities-independent.ts` — backend-free reader
- `src/lib/arkiv/opportunities-write.ts` — browser wallet-signed create/update/close + reconcile hook
- `scripts/probe-briefmint-arkiv.ts` — read-only lifecycle probe

**New client layer:**
- `src/lib/client/briefmint-api.ts` — envelope wrapper, 202/404/409/429/503 handling
- `src/lib/client/use-briefs.ts` — React Query hooks, ~2s poll on running/pending only

**New UI (city geometry, SVG, worker animation unchanged):**
- `src/components/briefs/BriefIntakeForm.tsx` — Home private intake
- `src/components/briefs/BriefReview.tsx` — structured review, revisioned drafts, private export
- `src/components/briefs/ReleaseDesk.tsx` — exact public preview + hash-bound approval
- `src/components/briefs/OpportunityBoard.tsx` — indexed discovery, filters, stale/failed/empty states
- `src/components/briefs/OpportunityPublisher.tsx` — prepare → wallet-sign → reconcile (never assumes tx = success)
- `src/components/briefs/OpportunityReader.tsx` — backend-free reader panel
- `src/components/briefs/BriefEvidence.tsx` — requested/reported/independent verification split
- `src/components/briefs/BriefList.tsx` — Archive summaries
- `src/components/city/brief-state-to-scene.ts` — BriefMint worker mapper (legacy mapper kept)
- `src/app/briefs/page.tsx`, `src/app/briefs/[id]/page.tsx`, `src/app/opportunities/page.tsx`

**Rewired (labels/panels only, no visual redesign):**
- `src/app/page.tsx` — BriefMint city: backend list → independent reader fallback, poll running/pending, account-change clears private state
- `src/components/city/CityPanel.tsx` — Home/Studio/Release Desk/Registry/Archive bodies
- `src/components/city/scene-config.ts` — building names/descriptions only (Release Desk, AI Studio, private notes, private briefs); geometry untouched
- `src/components/app/AppShell.tsx` — BriefMint nav (City, My Briefs, Opportunities; legacy routes kept)
- `src/app/layout.tsx` — title/metadata only
- `src/components/wallet/WalletControls.tsx` — project-owner copy, Rabdi default, session sync now clears BriefMint caches too
- `src/lib/client/use-session.ts` — clears `briefmint-briefs`/`briefmint-brief` caches on login/logout/account switch
- `scripts/run-ui-smoke.cjs` — compiles + runs the new briefmint test file
- `tests/ui/briefmint.test.ts` — 7 contract tests (see below)

**Untouched legacy (preserved):** `src/lib/server/*`, `src/app/api/*`,
`src/lib/arkiv/{schema,read,write}.ts`, translation job components, checkout,
merchant settlement paths, contracts, `tests/server/*`.

**Removed from live mode:** nothing deleted, but the live BriefMint paths
contain zero simulated inference completions, zero random transaction hashes,
and zero React-only persistence — every run/publish goes through the API/SDK
or renders an honest unavailable/failed state. Fixtures remain gated behind
`NEXT_PUBLIC_ENABLE_DEV_FIXTURES` and are never live evidence.

## Observed Arkiv transaction/entity evidence

Genuine read-only probe, 6 Nov 2026, public Rabdi RPC
(`npx tsx scripts/probe-briefmint-arkiv.ts`):

- `legacy workshop namespace (tool-city.workshop.v1): query ok, first page entities=0`
- `briefmint opportunity namespace (tool-city.opportunity.v1): query ok, first page entities=0`
- `probe: all reads ok (no writes attempted)`

No entity key, transaction hash, or explorer link is reported because none
exists yet: **zero records in both namespaces**, and no write was attempted.
Publication requires the existing project-owner wallet signature in the
browser; its private key was never requested or handled. The next evidence
step is a wallet-signed lifecycle (create → read/filter → update → close →
native expiry of a short-lived demo) once San confirms the account role.

## Tests

- `npm run typecheck` → pass
- `npm run lint` → pass (0 errors)
- `npm run test:ui` → 20/20 pass (13 legacy + 7 new briefmint: bounds, params, hash/approval, allowlist, filter, scene map)
- `npm run test:server` → 21/21 pass (legacy untouched)
- `npm run build` → pass (routes: `/`, `/briefs`, `/briefs/[id]`, `/opportunities`, legacy `/jobs`, `/merchant`, all API routes)
- `npx tsx scripts/probe-briefmint-arkiv.ts` → both namespaces query ok, 0 entities each

## Integration handoff — what San/backend must do next

1. Confirm or revise `docs/briefmint-contract.md` (DTO names, route paths, quota policy, auth-chain rule). Bump to v0.2+ jointly on change.
2. Implement the proposed BriefMint API (config, briefs CRUD/run/draft/approve/prepare/reconcile/export, optional opportunities convenience) with idempotent migrations for `briefs`, `brief_attempts`, `brief_approvals`, `brief_publications`, quota ledger — preserving `jobs`/`attempts`/`settlements` and the legacy trigger.
3. Add the brief compiler (private 0G path, schema validation, durable leases, bounded attempts) without routing through legacy payment checks.
4. Name the existing project-owner wallet for publication before any live write.
5. Run the funded-wallet browser lifecycle and record real entity key / tx hashes / expiry evidence here; replace the zero-record probe above.
6. Coordinate the frontend/backend merge only after (1)–(3) agree — no independent merges per the pivot instructions.

## Known limitations (honest)

- BriefMint mutations render `unavailable (503)` until the backend lands; discovery falls back to the independent reader (currently 0 records).
- No live 0G compilation, approval, publication, or expiry has been exercised end to end.
- Opportunity text search is client-side post-filter; indexed filters (category/status/budget) are server-side.
- `details` JSON is bounded at 8 KiB; `title` at 100 UTF-8 bytes (chain `str` ≤ 128 bytes).

---

# Full-stack merge entry — briefmint/fullstack (Agent B)

Merged `upstream/codex/payment-backend` (teammate backend, canonical contract
v1.2) with this branch's Next-hosted HUD city. Merge commit keeps `apps/web`
deleted and README resolved to canonical text without Vite-only instructions.

## Frontend adaptations to the canonical contract

- Shared: `briefmint.ts` is now a re-export adapter over `briefs.ts`
  (`OpportunityView` projection, `toOpportunityView`, filter types, address
  aliases only). `briefmint-validation.ts` keeps UI-only helpers (counters,
  ids, client text filter); canonical validation/hash/projection come from
  `briefs.ts`. Async Web-Crypto SHA-256 replaces the sync keccak stub.
- Client: `briefmint-api.ts` validates every response against the `briefApi`
  registry (zod `safeParse`); new `refresh` + content-Blob export; prepare
  carries `{intentId, expectedRevision, publicPayloadHash, operation}`;
  reconcile carries `{intentId, transactionHash, entityKey}` with 202 backoff.
- Arkiv: frontend reads/writes go through canonical
  `src/lib/arkiv/briefmint/*`; independent reader takes an explicit access key
  and no backend session. Publisher prepares intents, signs with the browser
  wallet, persists non-sensitive intent/tx identifiers locally, and reconciles
  before reporting success.
- Components/pages rewired to `BriefView` shapes (review.approval,
  publication confirmed/pending, canonical evidence, BriefSummary list).
  Session/login untouched (existing sessions remain valid for briefs).

## Verification after adaptation

- `npm run typecheck` — pass
- `npm run lint` — pass (0 errors)
- `npm run test:ui` — 27/27 pass (13 legacy + canonical contract/city tests)
- `npm run test:server` — 126/126 pass (teammate suite, untouched)
- `npm run build` — pass (`/api/briefs/*`, `/api/briefmint/config`, legacy
  routes, `/`, `/briefs`, `/opportunities` all emitted)
- Live gates unchanged and still open: authorized 0G inference, Arkiv
  create/query/patch/expiry, wallet journey, hosting (see backend-checkpoint).
