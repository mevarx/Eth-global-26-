> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint backend checkpoint

**Current release status:** use the Part 3 acceptance matrix at the end of this document. Earlier percentages are historical planning estimates; no new completion percentage is asserted. Passing offline checks does not establish the three external gates or production readiness.

Date: 6 November 2026, IST. Branch: `codex/payment-backend`; foundation `5674d82`, durable backend `a99a0d2`, guarded preflight/diagnostics through `66a0931`, public export/publication checkpoint `847de7e`, and the current uncommitted city/Arkiv integration. The PRD and `src/lib/shared/briefs.ts` remain authoritative.

## What is implemented

The interrupted services were preserved and completed into a runnable backend: EOA authentication, private owner-bound intake, finite promotional/operator quota, atomic lease/attempt reservation, bounded structured private inference, saved revisioned edits, immutable original result/evidence, exact public approval, immutable Arkiv intent preparation, injected independent reconciliation and private recovery/export.

The local completion follow-up adds approved public TXT/JSON exports with no private ID in filename/content, a read-only authenticated publication refresh route, honest stale status for saved observations, and concurrency guards in both refresh/reconcile directions. The current integration installs a real SDK-backed Arkiv schema/reader/writer boundary, injects the reader only when `ARKIV_ACCESS_KEY` is configured, and replaces the merged Vite city's fake paid translation state with typed BriefMint API calls. Browser writes remain a deliberate wallet action over a server-prepared public intent; direct public discovery reads Arkiv without the BriefMint API. These are locally compiled and tested integrations, not live chain evidence.

Migrations 002/003 add briefs, attempts, approval snapshots, publication intents and quota ledger without changing historical jobs/attempts/settlements or their immutability trigger. Migration versions are recorded transactionally and reopening is idempotent; an existing pre-version-table legacy database is tested. Standalone packaging includes SQL files.

Runtime/API changes: `brief-runtime.ts`, `brief-http.ts`, existing `runtime.ts`, auth purpose selection and all routes under `src/app/api/briefs` plus `src/app/api/briefmint/config`. New services: `briefs.ts`, `quota.ts`, `brief-runner.ts`, `brief-inference.ts`, `brief-publication.ts`. The integrated files are `apps/web/src/App.tsx`, `apps/web/src/lib/briefmint-api.ts`, Vite aliases/proxy configuration, and `src/lib/arkiv/briefmint/{schema,read,write}.ts`. New adapter tests validate that SDK-encoded canonical content and indexed fields agree before an Arkiv row reaches BriefMint state.

## Completion estimate for the entire PRD

**Approximately 67%**, up from 57%. This is an engineering estimate of delivered scope, not a percentage of passed end-to-end acceptance tests. It credits the API-wired city and SDK adapters only for local validation, and gives no credit for unperformed live integrations.

| Workstream | Share of full PRD | Credit at this checkpoint | Basis |
|---|---:|---:|---|
| Backend/API/data safety | 40 | 39 | Durable lifecycle, exact export/approval/publication contracts, runtime reader injection and adapter validation are locally proven; explicit external-change resolution remains limited |
| Existing city and frontend integration | 25 | 18 | The merged city calls the typed API, wallet sign-in, persisted polling, exact review/intent handling and direct reader; no browser wallet journey has yet been exercised |
| Real 0G/Arkiv and independent-reader proof | 20 | 0 | No authorized live inference or chain lifecycle evidence |
| Deployment, validation, docs and demo evidence | 15 | 10 | Root and Vite production builds, typechecks, lint, 101 server tests and local runbook pass; HTTPS hosting, browser journey, and submission evidence remain |
| Total | 100 | **67** | Full PRD remains incomplete |

## Verified checks

101 server tests; root/Vite typechecks; root lint; root/Vite production builds; local standalone HTTP smoke including real process restart; Git whitespace checks. Test doubles are explicitly local. One operator-run live provider request returned HTTP 502 with uncertain billing; there is still no successful inference and no second request. The legacy checkout example retains its nonfatal `use client` bundling warning.

The HTTP smoke verifies actual compiled route availability, authentication/query policy, private persistence, safe configuration, default private export, rejection of unapproved public export, owner-authenticated publication refresh, and fail-closed compilation. It restarts the real standalone Node process with the same temporary SQLite and session secret and proves the brief/session survive with zero dispatched attempts. It intentionally clears provider/quota environment variables so it cannot dispatch external inference. It does not test the absent Vite app or a production host.

## Remaining limitations

- Arkiv's named schema, reader and writer are installed, but are deliberately inert without `ARKIV_ACCESS_KEY`; reads and receipt reconciliation have no live Rabdi evidence. A browser writer requires the owner to configure a public endpoint key and explicitly sign.
- No assistant credential access or further inference. One operator-run request failed with HTTP 502 after 1,827 ms; actual debit is unknown. Private model availability, usable structured output, promotional-credit eligibility, successful latency/token cost and independent registered-signer verification are unproven. Unknown verification stays unavailable; see [the preflight record](0g-preflight.md).
- Original response bytes are stored privately for future verification. This does not establish a signature's validity or semantic correctness of generated text.
- Unknown broadcasts/reverted receipts conservatively remain pending because the current receipt DTO cannot prove a failed transaction attempted that exact intent. Re-prepare is blocked after uncertainty/submission, revision changes or settlement. There is no safe cancellation/replacement operation yet.
- External chain changes are detected and block overwrite; explicit resolution is not implemented. Expiry extension and reopening closed records are not supported. A proved expiry can be observed during publication preparation or explicit read-only refresh; there is no autonomous chain watcher. Historical reads are stale until a new successful observation, and unavailable reads preserve previous evidence.
- Direct public-reader code, indexed discovery and city integration are built but unproven against live Rabdi. Real browser writes, account-switching exercise, native expiry evidence, HTTPS persistent hosting, intended-user trial and submission artifacts remain unfinished.

## Exact next task

Run the Vite/Next cookie journey in a browser using [the local integration runbook](local-integration.md), then, only after separate authorization, resolve the 0G 502 and execute harmless 0G plus owner-signed Arkiv lifecycle gates. Record actual evidence and SDK/network compatibility before declaring the full PRD complete. None of these unproven steps can be completed by another backend unit test.

The user still controls account selection and live authorization. No push, merge, deployment or broadcast is part of this checkpoint.

## Part 1: backend core and guarded live-probe readiness

6 November 2026, IST. Implementation commit: `1ebeeab`, based on clean `3e26a65` on `codex/payment-backend`. This note supersedes earlier descriptions of the city integration as uncommitted/absent; the history above is retained. Overall PRD estimate remains **67%**: this part closes safety/readiness defects without claiming new live or browser evidence.

Confirmed fixes: challenge redemption checks the current signed domain/URI after an origin change; provider credential echoes (including escaped strings/property names) cannot enter evidence/original storage; an explicitly mismatched returned model is rejected; HTTPS/timeout/output limits fail before dispatch when invalid. The real public config route now probes the configured Arkiv reader, with a five-second readiness deadline, instead of permanently reporting false. No frontend/shared DTO, migration or legacy payment code was changed.

The existing one-request smoke now preserves sanitized response identifiers on structured-response failure, reads bounded response bodies once to avoid clone-cancellation stalls, and explicitly reports promotional debit as `not_measured` with credit source `unverified`. [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md) is the current operator command/interpretation contract. The public-only catalog preflight passed at 09:57:30 UTC / 15:27:30 IST: pinned `0gm-1.0-35b-a3b`, TeeML, one provider, 2,558 ms, **zero inference requests**. No key values or populated env file were accessed.

Targeted verification: **67 passed across six BriefMint test files** (`brief-auth-security`, `brief-execution`, `brief-http`, `brief-readiness`, `brief-smoke`, `briefs-contract`); **4 legacy auth/HTTP tests passed**, 14 unrelated legacy cases intentionally skipped by the name filter. Typecheck, ESLint on changed TypeScript files and `git diff --check` passed. All provider/chain behavior in tests is synthetic. Full server/contract/build/browser verification is deferred to Part 3 as requested.

| Acceptance | Part 1 status |
|---|---|
| BM-01 | Locally verified challenge/signature, distinct nonce, replay/expiry, concurrent redemption, current domain/URI, chain-purpose policy, session owner, secure cookies and origin checks. Legacy default remains isolated; BriefMint challenge uses 7794095. |
| BM-02 / BM-03 | Owner intake and strict bounds verified; quota/lease reservation is atomic. Per-wallet allowance counts **new briefs started** in a window; every retry/uncertain attempt counts against global dispatch allowance. No payment entitlement is introduced. |
| BM-04 / BM-05 | Private-only request contract, weaker/failed/mismatched response rejection, structured/source validation and honest evidence locally verified. **Live acceptance blocked**: no successful private completion or independent signature/content verification. |
| BM-06 | Concurrent claims, single active local lease, bounded attempts, timeout accounting/late-response rejection and expired-lease recovery locally verified. Provider work may continue remotely after timeout; local lease limits do not prove remote cancellation or exactly-once execution. |
| BM-07 / BM-08 | Immutable input/original output, revision checks, approval invalidation, canonical allowlist/hash and racing edit/export checks verified. Hostile notes remain private structurally; semantic owner review remains necessary. |
| BM-13 / BM-16 | Owner-scoped recovery/archive, restart persistence, no regeneration on read, labelled private export and approved public-only export locally verified. Production host/browser recovery remains a later gate. |

Historical 0G blocker: the first operator POST returned HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms, with unknown debit and no preserved upstream identifiers. The operator later reported one successful standalone response (HTTP 200, 9,133 ms, valid structure, 668 reported tokens, request/model identifiers) but `routerVerification` and `routingTier` were null. This proves one response was generated, not the app workflow, continuing capacity, actual debit, promotional-credit source or independent verification. A new potentially billable request needs new explicit user authorization. No wallet signature, Arkiv write, deployment or push occurred. **READY FOR PART 2.**

## Part 2: Arkiv lifecycle, independent reader and Agent B boundary

6 November 2026, IST. Implementation commit **`42258e1`**, based on clean Part 1 `d90cb1e`. Backend code now distinguishes prepared/unknown/submitted/reverted pending outcomes, with historical state defaulting to unknown. Null/null reconciliation atomically arms one wallet attempt; competing/repeated arms and re-preparing uncertain intents return 409. Known-hash reconciliation remains recoverable across disk restart and preserves newer private edits and the last confirmed entity. Unbound reverted receipts remain locked, not silently cancelled; rejection before arming retains the prepared intent, and there is no safe cancellation/replacement endpoint after uncertainty.

Reader/schema fixes verify actual chain, transaction/receipt hashes, engine destination and create/patch event emitter; budget-present filtering, exact deadline postcheck, native expiry blocks and continuation offsets are tested with SDK doubles. Unindexed title storage now uses UTF-8 bytes, supporting permitted multibyte titles; old `str`-title records need an explicit compatibility strategy before reuse. Canonical approved public bytes, namespace and hashes are unchanged. Entity GET observations are upper bounds rather than atomic snapshots; query pages use SDK-reported blocks, and pagination can shift between requests.

The executable `scripts/briefmint-arkiv-reader.ts` reads without API, SQLite, cookies or wallet; its CLI help ran locally and its offline tests cover filters, validated public-only output, empty/absent vs errors and separate block observations. No live discovery was performed. **63 tests passed across five targeted files** (`brief-publication`, `briefs-contract`, `arkiv-adapter`, `arkiv-reader-cli`, `brief-http`); root/Vite typechecks, changed-file ESLint and whitespace checks passed. Full project tests/builds remain Part 3. No frontend/browser writer file, credential value, signature, chain mutation, push, merge or deployment was accessed/performed.

Acceptance status: **BM-09/BM-11** backend intent/receipt/readback/update/close locally verified; **BM-10/BM-12** indexed discovery/native expiry code locally verified but live network behavior unproven; **BM-14** standalone reader implemented/offline verified with no real record proof; **BM-15** existing city wiring retained, with required mutation-epoch, durable-identifier and prepare/atomic-arm signing changes explicitly assigned to B. [AGENT_B_FRONTEND_HANDOFF.md](AGENT_B_FRONTEND_HANDOFF.md) contains exact routes, contracts, commands and a forwardable message; [ARKIV_LIVE_PROBE.md](ARKIV_LIVE_PROBE.md) contains the later human-authorized lifecycle/independence procedure. Live create/query/update/close/native expiry and stopped-backend independent reading still need real owner/entity/transaction evidence. Overall estimate **68%** (one point for the runnable reader/runbooks; zero new live-proof credit). **READY FOR PART 3**, with B integration and all live gates explicitly outstanding.

## Part 3: final offline verification and human last mile

6 November 2026, IST. Code/runbook commit **`c814af7`**, following `03bbaa8` and the Part 1/2 implementation commits. Initial tree was clean with no teammate changes. The final pass adds [the MOCK vertical-slice test](../../tests/server/brief-vertical-slice.test.ts) and strengthens [the local process smoke](../../scripts/smoke-production.ts) with an explicit environment allowlist and the actual Vite proxy configuration (only isolated ports/target overridden, env-file loading disabled). It proves Cookie/Set-Cookie/Origin forwarding and standalone process restart using a disposable SQLite database. It sends zero external inference/chain requests. Loopback HTTP and a Secure cookie attribute do not establish browser wallet behavior or real TLS.

One indispensable frontend adapter exception: `apps/web/src/App.tsx` now returns no public preview for a new/non-ready or invalid unsaved draft instead of throwing during render. It was a small isolated guard with no overlapping teammate change; wallet/session/publication behavior was not rewritten. The bounded independent review found no new blockers in the changed code. B's substantive signing/session/discovery work remains incomplete.

### Final commands and actual results

Runtime: **Node v24.21.0**. Checks below used the committed lockfiles/existing installation; no fresh dependency installation or live deployment was claimed.

| Command | Result / evidence boundary |
|---|---|
| `npm run test:server` | **126 passed / 12 files**. Includes 3 MOCK vertical-slice cases covering test EOA session, actual private inference adapter over fake HTTP, quota, immutable original/edit/approval, intent/arm/readback/discovery fixtures, update/close, private export and SQLite/session reopen; 502/invalid reply, stale approval, wrong owner and uncertain/empty/error paths. No sponsor service called. |
| `npm run lint` | Passed root project's configured scope. |
| `npm run typecheck` | Passed. |
| `DOTENV_CONFIG_PATH=/dev/null DEPLOYER_PRIVATE_KEY= npm run test:contracts` | **5 passed** on the local simulated chain. Dotenv/deployer credential loading disabled. Initial sandbox invocation timed out on the external compiler-cache lock; approved retry passed, with no contracts needing compilation. No live Whitechain action. |
| `npm run build` | Passed checkout-example build, Next production build and standalone asset/migration packaging. Existing checkout-example `use client` warning remains nonfatal. |
| `npm run reference:typecheck` | Passed; repeated only after the narrow preview guard. |
| `npm run reference:build` | Passed; repeated only after that same frontend fix. |
| `npm run smoke:local` | Passed with approved local loopback access: actual standalone and Vite processes, auth/cookie/proxy/origin policy, private persistence/exports, fail-closed provider/quota, and real process restart. **Zero inference dispatches** and no external integration called. Vite emits a nonfatal `envFile` deprecation warning; the tested option still disables env-file loading in installed Vite 8.3.6. |
| `git diff --check` | Passed. |

Vite lint was skipped because `apps/web/package.json` defines no lint command. Real browser extension tests, live 0G/Arkiv, HTTPS hosting/persistent-volume restart, intended-user trial, third-party asset/license review and submission/video completion were not performed. Other than the documented compiler-cache retry and the narrow Vite recheck, the complete project verification sweep was run once after the implementation fixes.

### BM-01 through BM-16 acceptance matrix

“Offline tested” identifies implemented code exercised by local tests, not fulfilled live acceptance. Commands above are the executed evidence; paths below identify the focused source/tests.

| BM | Current status | Evidence / remaining gate |
|---|---|---|
| BM-01 wallet identity | **Offline tested; browser incomplete** | `auth.ts`, `brief-auth-security.test.ts`, `backend.test.ts`, `brief-http.test.ts`; real proxy/session smoke passed. B must guard/serialize account changes and in-flight login/mutations; real wallet login remains unverified. |
| BM-02 private intake | **Implemented/tested offline** | Strict DTOs and owner-bound `BriefService`; `brief-http.test.ts` plus vertical-slice create/ownership cases. |
| BM-03 quota | **Implemented/tested offline** | `quota.ts`/`brief-runner.ts`, `brief-execution.test.ts`; actual usage/credit pool/dollar limits remain unmeasured. No checkout requirement. |
| BM-04 private compilation | **Offline tested; live blocked** | Real adapter with MOCK responses in execution/smoke/vertical-slice tests. Historical operator HTTP 502 remains unresolved; no successful authorized private completion. |
| BM-05 evidence | **Metadata handling offline tested; one operator-reported live result incomplete; independent verification incomplete** | `brief-inference.ts`, `brief-smoke.test.ts`; provider-reported/requested policy and unavailable independent verification remain distinct. The successful standalone result lacked Router verification/routing metadata; app/probe do not implement chain-signer/signature/content verification. Debit and credit source remain unmeasured. |
| BM-06 durable execution | **Implemented/tested offline** | Atomic quota/lease, concurrent claims, bounded retries/uncertainty and recovery in `brief-execution.test.ts`; no claim of remote cancellation or exactly-once provider execution. |
| BM-07 saved editing | **Implemented/tested offline** | Immutable input/model/evidence, revision CAS and persistence in execution/HTTP/vertical-slice tests. |
| BM-08 exact approval | **Implemented/tested offline** | Allowlist/canonical SHA-256/revision checks, hostile-note structural isolation and edit/export races in contract/HTTP tests. Human semantic review remains essential. |
| BM-09 owner publication | **Backend offline tested; browser incomplete/live unverified** | Prepared public-only intent, exclusive arm, actual SDK receipt/readback validation; publication/adapter/vertical-slice tests. B must wire prepare/arm/durable IDs before authorized wallet tests. |
| BM-10 discovery | **Read adapter offline tested; UI controls incomplete/live unverified** | Indexed namespace/version/category/language/status/budget/deadline predicates and empty-vs-error behavior in adapter/reader/vertical-slice tests. B filter/detail/continuation controls and real indexed query evidence remain. |
| BM-11 update/close | **Backend offline tested; live unverified** | Owner/base/hash checks, closed-content rule, last-confirmed preservation and old-intent/new-private-revision tests. No live owner mutation. Unknown/reverted locks lack safe cancellation/replacement. |
| BM-12 native expiry | **Offline tested; live unverified** | Publication/adapter tests use expiry and independently observed blocks. No real short-lived entity or actual expiry evidence; deadline filter is not native expiry. |
| BM-13 private recovery | **Implemented/tested offline; production host unverified** | Owner-scoped archive/exports, disk reopen and actual standalone process/session restart. Reads do not regenerate. Host persistent-volume/restart proof remains. |
| BM-14 independent reader | **Executable/offline tested; live unverified** | `scripts/briefmint-arkiv-reader.ts`, `arkiv-reader-cli.test.ts`; no API/SQLite/session dependency, no real record discovered with API stopped. |
| BM-15 truthful city | **Partially implemented; B work incomplete** | Real API calls retained and invalid preview crash guarded; Vite build/typecheck and HTTP proxy pass. Browser signing state, mutation/connection races, durable IDs, public filters/details and accessibility/manual wallet journey remain B-owned. |
| BM-16 exports | **Implemented/tested offline** | HTTP/contract/vertical-slice tests: owner-only labelled private recovery and current-approved public projection only; no internal/private IDs/source/evidence in public export. |

### Critical external gates and release blockers

1. **BriefMint app-level 0G generation**: one standalone smoke response succeeded per operator report, but the actual owner-authenticated `/api/briefs/:id/run` path has not been live exercised. The output's Router verification/routing fields were absent, independent verification remains unavailable, and debit/credit source are unknown. Any live app generation is a separate potentially billable request and needs explicit authorization.
2. **Real browser wallet/signature journey**: B must first finish the documented code changes. Account/chain changes, reload, rejection, two-tab arming, saved private state and mutation races need actual browser verification. No live signature is authorized by this checkpoint.
3. **Real Arkiv lifecycle and independence**: owner-authorized create/query/update/close/native expiry plus the independent live reader with API stopped need entity/transaction/owner/block evidence. No live record was published or read in this final pass. Pre-live `str`-title entity compatibility is explicitly unresolved if such old records exist.

Production HTTPS/one-process/persistent SQLite evidence, asset attribution/license checks, intended-user feedback, actual URLs, video under three minutes and ETHGlobal submission remain human/operator work. The final runbook is [LIVE_VALIDATION_AND_SUBMISSION.md](LIVE_VALIDATION_AND_SUBMISSION.md); [DEMO_NOTES.md](DEMO_NOTES.md) contains synthetic input and truthful claims. [AGENT_B_FRONTEND_HANDOFF.md](AGENT_B_FRONTEND_HANDOFF.md) contains the single forwardable message; [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md) and [ARKIV_LIVE_PROBE.md](ARKIV_LIVE_PROBE.md) retain the precise consent gates. No new percentage, full-PRD completion, production readiness, push, merge, deployment, live inference or live wallet/Arkiv action is claimed.

### Local integration follow-up: 6 November 2026

On local branch `codex/briefmint-integration-fixes` based on `codex/initial-readme` (`2fff1eb`), the current tree also adds client/server `x-briefmint-owner` binding for every private BriefMint route, wallet/session equality gating, cross-tab cookie mutation coordination with fail-closed logout retry, account-scoped query keys, exact approved-payload/publication-intent comparisons, pre-signing arm, append-only transaction-hash recovery, and paginated public reader results. This is a local integration branch; it has not been pushed. The required header is documented in [AGENT_B_FRONTEND_HANDOFF.md](AGENT_B_FRONTEND_HANDOFF.md). The server rejects absent/mismatched owner headers with `409 SESSION_OWNER_MISMATCH` before parsing a private body or running handlers.

Combined local verification passed: `npm test` (**144 server tests across 16 files; 27 UI smoke cases**), `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`. `npm run smoke:local` passed with disposable credentials and zero inference dispatches. The Vite checkout example reports its existing nonfatal >500 kB chunk warning. Tests are offline; no real browser two-tab, wallet, 0G app generation, Arkiv, or hosting action was performed. A tab interruption after SDK broadcast but before it returns a transaction hash can leave an armed publication locked without a locally stored hash; manual/chain-assisted resolution remains necessary. A real browser run is required to validate Web Locks, session-cookie transitions, and the UI retry behavior.
