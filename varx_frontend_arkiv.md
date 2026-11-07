# Tool City — Teammate's Agent Assignment: City, Frontend and Arkiv

**Assigned to:** your teammate + OpenCode, Agent B.  
**Required companion:** [Common structure and integration contract](docs/briefs/TOOL-CITY-COMMON-STRUCTURE.md), version 1.0.
**Branch:** `codex/city-frontend`.  
**Status:** implementation instructions, not implemented code. Read the common document in full before starting.

## 1. Mission

Build the complete browser journey and a city that explains real work: discover a merchant-owned workshop, prepare a draft, purchase a job, review the translation and recover the saved result. Implement genuine Arkiv ownership and queries. Agent A owns contracts, server, payment verification, 0G and deployment; do not build an alternate backend.

Product scope is one merchant, one fixed-price English → Hindi text-translation service and one small isometric neighbourhood. No voice, Storage, gasless path, extra languages, paid multi-merchant marketplace, dynamic prices or game engine.

## 2. Start from the same project

Wait for A's shared bootstrap commit, then clone that repository and branch from it. If on one machine, use a separate worktree. Do not run a second application generator and later copy its root over A's project.

Before the baseline arrives, you can study current official Arkiv wallet/query examples and define the city layout. After it arrives, run root `npm ci`, confirm the basic app/typecheck builds, and read the actual shared types and configuration. Ask A for dependency changes; do not change root package/lockfile independently or create a nested lockfile.

Use `@/*` for root `src/*` imports. Import shared DTOs, validation, deployment access and ABI; do not make local variants or hardcode deployed contract values.

## 3. What you own

```text
tool-city/
├── src/app/
│   ├── globals.css
│   ├── page.tsx
│   ├── jobs/page.tsx
│   ├── jobs/[jobId]/page.tsx
│   └── merchant/page.tsx
├── src/components/
│   ├── app/{ClientProviders,AppShell}.tsx
│   ├── wallet/WalletControls.tsx
│   ├── city/{CityScene,IsoBuilding,Worker,CityPanel}.tsx
│   ├── city/{scene-config,job-state-to-scene}.ts
│   ├── workshop/{WorkshopCard,WorkshopEditor}.tsx
│   ├── checkout/ToolCityPay.tsx
│   ├── jobs/{DraftForm,JobList,TranslationReview,JobEvidence}.tsx
│   └── merchant/PurchaseTable.tsx
├── src/lib/client/
│   ├── api-client.ts
│   ├── use-session.ts
│   ├── use-job.ts
│   ├── wallet-config.ts
│   └── exports.ts
├── src/lib/arkiv/
│   ├── schema.ts
│   ├── read.ts
│   └── write.ts
├── public/city/
├── examples/checkout-demo/
│   ├── index.html
│   ├── vite.config.ts
│   └── src/{main,App}.tsx
├── tests/ui/                         only useful focused checks
├── arkiv/
│   ├── schema.md
│   ├── friction.md
│   ├── reach.md
│   ├── why-arkiv.md
│   └── how-you-use-arkiv.md
└── docs/
    ├── frontend-handoff.md
    └── demo-script.md
```

Brace groups mean separate files. After A establishes example dependencies, own its UI/build scripts and coordinate any dependency change. Generated `public/checkout-demo/` is build output, not authored source.

**Do not edit:** contracts, root layout, API route handlers, server modules, shared types/ABI/configuration, root dependencies/lockfile or deployment secrets. Root layout already imports your `ClientProviders`; implement that component instead of creating another root shell. Propose interface corrections to A rather than adding a client-specific workaround.

## 4. First priority: Arkiv and plain usable screens

Prove actual Rabdi wallet-signed publication, read, description update and withdrawal. Use the current SDK installed by A; check current official examples rather than copying stale network/API syntax. Merchant signs through the connected wallet's transport. No shared server key that owns every listing.

Implement `schema.ts` with the exact fields and namespace from the common contract. System owner supplies ownership; system expiry supplies expiration information when available. Only description/title/active status are edited in this MVP. Checkout address, service, language pair and terms reference must match configured service; there is no editable financial price.

Deliver a truly server-neutral `read.ts` exporting the common `listWorkshops(config)` and `getWorkshop(config,key)` signatures. No React hooks, wallet state, browser globals, server secrets or imports from `write.ts`. A needs this module to validate new jobs. Normalize the actual SDK's missing-record/error behavior as specified; do not guess its API from the signature sketch.

In the browser:

- Load real query results and reconcile owner, chain, checkout, service and terms with configured values.
- Show owner/entity key, last successful refresh and fresh/stale state. Refresh after writes and on focus.
- Keep loading, failed query and empty catalogue distinct. Failed refresh does not prove withdrawal or expiry.
- Show withdrawal via an explicit owner-signed `active=false` update. Existing paid jobs remain accessible.
- Wrong-wallet ownership demonstration may fail before broadcast; do not fabricate an explorer link for that failure.
- An arbitrary wallet can use our schema tag. Only the supported, correctly owned service can be purchased.

Build basic working draft, checkout and review screens now. Use A's labelled shared fixture only while waiting on APIs; detailed scene art follows the real paid slice.

## 5. Page and component contracts

| Entry | Responsibility |
|---|---|
| `ClientProviders({children})` | Shared browser wallet/query providers; used by main app and checkout example |
| `AppShell` | Header, wallet controls, My Jobs/Merchant navigation and layout |
| `/` | Real workshop discovery, city and selected-building panel |
| `/jobs` | Authenticated buyer's summaries from `GET /api/jobs` |
| `/jobs/[jobId]` | Authorized job status, source-aligned review, editing/export and evidence |
| `/merchant` | Merchant wallet publication/update/withdrawal and authenticated settlement table/CSV |
| `ToolCityPay({job,onJobChange})` | Wallet allowance/approve/purchase plus server verification; no model call |
| `JobEvidence` | Actual listing/payment/request references and accurately labelled reported verification |

All API calls use the common envelope via `api-client.ts`. Handle 202 pending separately from completed states. Handle 401 by asking for login, 404 without revealing whether another buyer owns the job, and sanitized service/provider errors without pretending success.

Wallet flow: fetch public config → connect → request signed login challenge → verify session. Use actual supported network configurations from the manifest. A buyer pays on Whitechain; merchant writes listings on Arkiv. Switching networks alone does not log out. Switching accounts clears prior buyer's private state and ends the old session.

Do not collect API keys or private keys in the product UI. The backend already owns private inference credentials. Current job IDs/transaction hashes are not access credentials.

## 6. Checkout sequence: align with A exactly

1. Create the job through the server with `{ workshopEntityKey, text }`; preserve its random ID and returned immutable terms.
2. Ensure wallet account matches the authenticated buyer; switch to configured Whitechain network.
3. Read actual allowance. If insufficient, approve only the required official-token amount and wait for the approval receipt.
4. Call the compiled ABI's `purchase` with job ID, expected service, amount and terms hash. Do not send a plain transfer or create another contract interface.
5. Submit the actual purchase hash to the server's verification endpoint. While pending, display confirmation status and retry verification with backoff. A browser receipt alone does not mark the job paid.
6. Call `onJobChange` with the server-returned job. Once verified, show a deliberate Start translation action owned by the job screen. The checkout component itself does not execute inference.
7. On refresh, read the saved job and transaction reference. Never start another purchase automatically.

For `run`, trigger only from the Start/eligible Retry action, then poll the job while active. Reopening a ready job simply loads the saved result. A declined signature or failed transaction is recoverable UI state, not a paid job.

The separate `examples/checkout-demo` is a small independent React consumer importing the same client-safe `ClientProviders` and `ToolCityPay`. Create/select a genuine job before embedding checkout; never use an invented paid fixture as live evidence. Keep embedding code compact. It uses the same backend, and its Vite build goes into `/checkout-demo/` as defined in the common contract. Coordinate scripts/dependencies with A; no second production server.

## 7. City implementation

Use React + SVG + CSS transitions, with original geometry. Five buildings plus one worker are the six functional objects:

| Building/object | Selected panel | Real input |
|---|---|---|
| Registry Hall | Workshop/owner/entity/freshness | Actual Arkiv query |
| Creator's Home | Draft or source/result review | Local draft, then authorized saved job |
| Treasury | Fixed checkout and receipt | Contract-reconciled terms and verified job payment |
| Translation Studio | Processing, retry and reported evidence | Backend job/attempt state |
| Archive | My Jobs and saved result access | Authenticated API |
| Document worker | Current job details | Pure mapping from that same job state |

Visual target: warm paving, muted green terrain, terracotta roofs, a teal Studio, readable nameplates and one detail panel. Render back-to-front. Use one reusable roof/two-walls building component with variations. Streets have fixed waypoints; no game engine, free roaming, pathfinding or complex sprite pipeline.

`scene-config.ts` owns positions, streets and waypoints. `job-state-to-scene.ts` is pure: awaiting payment → Treasury; payment pending → wait; verified paid/running → Studio; ready → Home with saved parcel; interrupted/failed paid job → visibly unresolved. Reopen does not replay payment or claim a new inference.

Animation may take a short time to reach a destination, but it never changes server status or delays access to an already saved result. Use keyboard-accessible building navigation, HTML panels, responsive layout and reduced motion. On small screens place the panel below the city; allow review to expand for readable editing.

Use development preview controls only behind the labelled fixture switch. Remove/disable them in production. Production state must come from the real normalized listing and job responses.

## 8. Review, exports and merchant view

Render the original source and corresponding translated segment by stable ID. Never use model-generated source restatements. Keep edits locally with an unsaved indicator; Save sends the complete segment set to A. Exports use the latest successfully saved edited version, falling back to saved model output if unedited. Do not label edited text as untouched model output.

TXT contains clean translation. JSON may include source/result segments and buyer-visible receipt/evidence with honest labels. Export only data already authorized for this buyer; never add private tokens or raw trace payloads.

My Jobs uses summaries and fetches authorized detail on open. Show paid/unresolved status and server-provided retry eligibility. No automatic repurchase button for recovery.

Merchant table consumes verified settlement endpoints, with CSV download from the server. It must not display buyer drafts or translations. Explain that the view covers verified app purchases, not an exhaustive chain index. Do not add an analytics dashboard.

## 9. Verification and handoff

Validate meaningful browser paths: correct account/network, wallet rejection, fresh/failed Arkiv reads, owner and wrong-wallet updates, withdrawal, pending payment, saved result, edit/save/export, reopen, interrupted paid job and account switching. Test wide/narrow layouts, keyboard navigation and reduced motion. Use a few focused checks rather than tests that only duplicate component markup.

Run root lint/typecheck/build against A's common base and report actual results. If backend is still absent, say which paths used fixtures. A successful fixture demonstration is not a sponsor integration.

Own `/arkiv/` criterion documents, actual writer address/runnable query, original-asset attribution and non-builder feedback. `reach.md` discusses who tried/would use the product and actual evidence, not invented users. Prepare a roughly 2:40 demo script showing both parties and real evidence; both teammates review before submission.

Update `docs/frontend-handoff.md` with:

```text
Commit / common contract version:
Files changed:
Commands run and actual results:
Real Arkiv write/query/update/withdrawal evidence:
ABI/deployment manifest commit consumed:
Live API paths vs development fixtures:
Wallet/network/browser behavior verified:
Known failures / limitations:
What Agent A must merge or do next:
```

Deliver small commits at M1, M2 and M3. Pull merged shared-contract updates before continuing. You are done when the **combined app** uses genuine listing/payment/inference data, renders truthful city states, reviews/exports/reopens paid jobs and runs the tiny checkout example. A polished city with fixture results alone is not completion.
