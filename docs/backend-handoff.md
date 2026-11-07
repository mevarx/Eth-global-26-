> **Current status — 7 November 2026 IST:** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# Backend handoff

## Current verification follow-up — 6 November 2026

This update supersedes older local test counts, completion estimates, and app-layout notes below. It records offline verification only.

Current checks pass: `npm run lint`, `npm run typecheck`, `npm test` (**126 server tests and 27 UI tests**), `npm run test:contracts` (**5 simulated-chain tests**), and `npm run build`. `npm run smoke:local` passes with a temporary SQLite database and explicit credential-free environment. It covers the standalone app, the checkout-demo Vite `/api` proxy (including cookie and `Origin` forwarding), private brief operations, approval-gated public export, restart persistence, and fail-closed behavior. The smoke makes no external calls and dispatches no inference. The build has a nonfatal checkout-demo bundle-size warning.

Release gates remain open: a successful authorized 0G inference with cost and quality validation; independent response verification; the real browser wallet journey; owner-authorized Arkiv create/query/update/close/expiry and independent readback; and HTTPS hosting with persistent-volume restart/restore evidence. Asset/dependency license review and submission evidence also remain outstanding. A previous operator-run inference returned HTTP 502 (`PROVIDER_UNAVAILABLE`) and billing is uncertain. No live inference, wallet signing, Arkiv write, or deployment is claimed here.

See [current checkpoint](briefmint/backend-checkpoint.md), [integration contract](briefmint/integration-contract.md), [teammate handoff](briefmint/agent-b-handoff.md) and [local setup/privacy runbook](briefmint/local-integration.md). Historical sections below retain their original counts and context.

## 0G first-request preflight — 6 November 2026

Focused follow-up from `a99a0d2`: hardened the guarded smoke and added [the exact operator setup/runbook](briefmint/0g-preflight.md). A public-only CLI run passed with TeeML `0gm-1.0-35b-a3b`, one catalog provider and zero inference requests. Private routing/fallback policy retained; single POST, redirects rejected, explicit authorization, fresh catalog checks, smoke-only non-thinking JSON/1200-token request and safe latency/provider/billing reporting are tested. Normal backend generation defaults stay unchanged.

91 server tests (17 new injected smoke cases), lint, typecheck and whitespace checks pass. The operator ran one authenticated inference attempt: HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms; billing is uncertain, and the prior diagnostic output did not capture a safe upstream request ID or error subtype. The updated local smoke now captures only allowlisted error metadata on future attempts. No key was accessed by the assistant and no second inference was run. Independent verification remains unavailable, and capacity, actual debit, model quality and successful output remain live gates. Full-PRD completion stays approximately **55%**. `a99a0d2` remains the preserved backend checkpoint; this follow-up is isolated preflight work, not a claim of live integration success.

## BriefMint durable backend checkpoint — 6 November 2026

Resumed and preserved the uncommitted implementation on `codex/payment-backend` from committed foundation `5674d82`. Existing work supplied migration 002, private lifecycle services, quota/runner/compiler, publication service, auth purpose selection, draft handoff and guarded provider smoke. This continuation completed runtime/HTTP routing, migration 003 evidence/identity hardening, original-response persistence, standalone migration packaging, strict auth queries, security fixes, regression tests and the [Agent B handoff](briefmint/agent-b-handoff.md).

All ten shared API operations are installed: config; private list/create/get; run; draft save; approve; publication prepare/reconcile; export. The real compiler is installed but requires operator configuration and explicit finite quota; the production Arkiv reader is deliberately absent pending B's adapter. Neither dependency is faked. Legacy translation/payment tables, immutable quote trigger, payment checks and disabled checkout configuration are preserved. `apps/web` and teammate files are unchanged.

Actual final validation:

- `npm run test:server`: **74 tests passed** across six files (33 pre-existing foundation/legacy tests, 41 new execution/HTTP/publication tests).
- `npm run test:contracts`: **5 tests passed**, local Hardhat execution, no deployment.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Build lists every BriefMint route and copies SQL migrations into standalone runtime. The existing checkout-example Vite build emits a nonfatal `use client` directive warning.
- `npm run smoke:local`: passed against the real standalone server and temporary SQLite: legacy auth/list/checkout denial; BriefMint chain/query policy, safe readiness, private create/list/get/export and unavailable compilation with zero attempts consumed. No external integration called.
- Initial local smoke was blocked by sandbox loopback `EPERM`; initial Solidity run timed out acquiring the compiler-cache mutex. Both were rerun with approved local runtime/cache access and passed. The operator-only authenticated provider smoke was **not run**.
- `git diff --check`: passed before commit; intended files reviewed, no real environment/credentials staged.

Publication safety limits are deliberate and visible: unknown/reverted transactions remain pending until exact intent binding can be proven; no cancellation/replacement endpoint; external changes block automatic overwrite pending explicit resolution; no expiry extension or reopening closed records. New prepare requires current approval; old legitimately broadcast intents may still reconcile after edits. Settled/submitted/uncertain intents cannot be prepared for signing again. Last confirmed state survives uncertain updates/RPC failures. Original provider bytes/evidence are retained privately and immutable after success, but independent signature verification remains unavailable.

Remaining live work: operator-funded model/credit/latency validation, independent response verification, B's real neutral Arkiv reader/browser writer/indexed filters, user-selected existing publisher account, actual chain lifecycle/expiry, connected city/session/account-switch tests, independent public reader and persistent HTTPS deployment/demo evidence. No credentials, paid inference, chain writes, contract deployment, push or merge performed. [Detailed completion estimate and next actions](briefmint/backend-checkpoint.md).

## BriefMint foundation — 6 November 2026

The user-approved BriefMint PRD now governs the new product. The sections below this update describe the preserved **legacy translation backend**, not BriefMint requirements. No Whitechain checkout/funding is required for BriefMint.

Starting HEAD `4f2f4d17c92ea7b3996ffefe7c5ae5e4e406b307`, branch `codex/payment-backend`, clean before work. Added `src/lib/shared/briefs.ts` (strict request/response DTOs, public projection/canonical SHA-256, approval checks, independent states and neutral Arkiv interfaces), `tests/server/briefs-contract.test.ts`, and [the frozen integration contract](briefmint/integration-contract.md). No legacy runtime/schema or `apps/web` edits. Frontend reference inspected at `cb0db61d3515ee0621547f7832e9826f4be08f2e` through Git objects, not merged.

Actual checks: `npm run test:server` passed **33 tests** (21 existing, 12 new); `npm run lint` passed; `npm run typecheck` passed. Initial typecheck found a test-only excess-property typing error in a deliberate hostile-input test; fixed and all checks rerun successfully. Independent read-only review prompted approved-payload snapshots, intent hash checking, source-reference checks and publication-state consistency validation. No production build or Solidity rerun was needed for this shared-contract-only change; no live dependency checks were performed.

Auth chain selection (BriefMint 7794095, legacy default 1874), single-origin Vite/Next hosting, browser-sign/server-reconcile ownership and exact Agent A/B files are **specified**, not activated. Next A task: additive migrations plus owner-bound brief CRUD/approval routes and purpose-selected auth. Next B task: shared DTO consumer and neutral Arkiv adapters. Real 0G, Arkiv lifecycle, quota/model measurements and integrated frontend/hosting remain live gates. Prepared-but-uncertain broadcast recovery must remain conservative; do not create duplicate intents to evade it. No credentials accessed, transactions, deployment, push or merge performed.

## Legacy backend handoff (preserved)

**Status:** implementation and reported code checks pass on this branch. All live readiness gates remain pending, and the work remains on the branch until those checks are satisfied. This does not claim a genuine deployment or paid translation.

## Contract

- Shared contract: `docs/briefs/TOOL-CITY-COMMON-STRUCTURE.md`, version 1.0 (6 November 2026).
- Backend assignment: `docs/briefs/san-backend-original.md`.
- Repository: one Next.js application, one API and one persistent SQLite database. The backend owns trusted job, auth, checkout verification, inference, recovery and settlement paths. Browser code must not import `src/lib/server/*`.
- Public API payloads and job states follow the shared contract. Buyer identity comes from the signed session; requested price, buyer, model, retry allowance and paid state are never trusted from the browser.
- Keep source text and translations private. Merchant reporting is limited to verified app settlement fields.

## Environment configuration

The agreed variable names are listed below. This is a names-only inventory; no local environment file or secret values were inspected or recorded. Required-at-runtime status should be documented against the implemented deployment mode.

| Variable | Purpose |
|---|---|
| `APP_ORIGIN` | Canonical application origin for auth-domain checks |
| `AUTH_ALLOWED_ORIGINS` | Explicit allowed origins for state-changing requests |
| `SESSION_SECRET` | Server-only session signing/hash secret |
| `DATABASE_PATH` | Persistent SQLite database location |
| `WHITECHAIN_RPC_URL` | Whitechain RPC for checkout verification |
| `ARKIV_RPC_URL` | Arkiv RPC for server-side listing checks |
| `ZERO_G_API_KEY` | Server-only 0G provider credential |
| `ZERO_G_BASE_URL` | Configured 0G API endpoint |
| `ZERO_G_MODEL_ID` | Configured model identifier |
| `INFERENCE_TIMEOUT_MS` | Bounded provider request timeout |
| `PAYMENT_CONFIRMATIONS` | Receipt confirmation policy |
| `DEPLOYER_PRIVATE_KEY` | Deployment tooling only; not needed by the running web service |
| `NEXT_PUBLIC_ENABLE_DEV_FIXTURES` | Development rendering fixtures only; must not bypass server authorization and must be false/absent in production |

Never put secrets in `NEXT_PUBLIC_*` variables, manifests, browser bundles, logs or committed files. Any provider-specific variable added during implementation should be listed here by name and its purpose, without a value.

## Integration and deployment status

Implemented backend behavior reported by the backend coordinator:

- Server modules and the agreed API endpoints are written. SQLite persistence is used for jobs and immutable source, accepted terms and model result.
- Auth uses nonce/session and origin checks. Expired challenge/session rows are pruned; challenge issuance is bounded to five outstanding challenges per address and 10,000 globally.
- Request bodies are limited to 32 KiB while streaming.
- Inference requests set `X-0G-Provider-Trust-Mode: private`, `X-0G-Provider-Allow-Fallbacks: false` and `verify_tee: true`. `x_0g_trace` is parsed; missing verification evidence remains null, and a reported false verification is rejected.
- The Arkiv reader fails closed when no neutral reader is supplied. The runtime integration still needs the teammate's reader wired through `runtime.ts` after merge.
- Public config remains `configured: false`. Public config can be read without a session; when `SESSION_SECRET` is missing, protected APIs return 503. Fixtures cannot bypass payment authorization.
- A review found that nonretryable provider failures could incorrectly expose retry eligibility. This was fixed: retry now requires both remaining attempt budget and a retryable failure, with a test covering the behavior.
- A follow-up security review reported no additional concrete findings.

Checks reported as passing on this branch:

| Command | Result |
|---|---|
| Node version | `v24.21.0` |
| `npm run test:server` | 21/21 across two files: 18 backend lifecycle/auth/payment tests and 3 root public-config tests |
| `npm run typecheck` | passed |
| `npx eslint src/lib/server src/app/api tests/server` | passed |
| `npm run test:contracts` | 5/5 passed; contract worker reports actual contract compilation and ABI |
| Root compile, lint and typecheck | reported passing |
| `npm run build` | passed, including independent example and standalone public/static asset preparation |
| `npm run smoke:local` | passed against the actual standalone HTTP server: home/example, unconfigured public config, signed ephemeral test-wallet login, protected job list and fail-closed new job creation |

Standalone inspection found the SQLite migration in bundled output, and the HTTP smoke created its temporary SQLite database successfully. The smoke used an ephemeral unfunded identity, cleaned up its database/process and called no external provider. Passing code checks do not establish live sponsor operation or readiness to move this branch to `MAIN`.

Live/deployment items remain **pending evidence**:

- Whitechain live deployment and explorer source verification, followed by real official-token settlement. Local compilation/tests and the generated ABI exist; the public deployment manifest remains unconfigured.
- Arkiv server-side listing adapter available and independently checked by job creation.
- 0G private routing and verification metadata confirmed against an actual configured service; Hindi usefulness reviewed with a qualified reviewer.
- Persistent Node deployment and SQLite volume configured; restart recovery demonstrated.
- Paid end-to-end path completed with a real test purchase, server verification, translation and saved-result reopen.
- Deployment location, block, contract and token details recorded in public config and evidence. No address, transaction receipt, success response or sponsor endorsement should be filled in from a fixture.

## Provider references and live gates

Implementation was aligned to the 0G Router documentation for [routing](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/routing), [chat completions](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions) and [verifiable execution](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution). Documentation alignment and request construction are not evidence of a successful live request.

No live readiness gate has passed. No provider keys, deployed contract, funds, paid inference or Hindi reviewer results are available yet. Keep this work on its branch until the user's required readiness checks are complete. Do not label gates complete based on code checks or fixtures. Keep test doubles, development fixtures and live sponsor evidence clearly distinguished.

## Known limitations and configured defaults

- Runtime dependency audit (`npm audit --omit=dev`) reports zero vulnerabilities at this snapshot. Full development-tool audit still reports legacy Zod 3 and minimatch advisories through Hardhat/lint dependencies; no unsafe forced major toolchain downgrade/override was used. These development-only findings need review before release and do not justify a main promotion.
- Verified payment state is cached; later chain reorganizations are not tracked.
- Router verification is reported provider evidence and is not independently checked by the application.
- Wallet authentication supports EOA signatures only; EIP-1271 contract-wallet signatures are not supported.
- The application backend receives plaintext drafts and translations to perform the service; private routing does not hide content from the backend.
- Current configured defaults are a 60-second inference timeout, a 30-second lease grace period and three payment confirmations. These are configuration defaults, not values measured from provider latency or demonstrated network finality.

## Known gates and next actions

1. Keep the branch out of `MAIN` until all user-required readiness checks are complete.
2. Frontend/Arkiv owner: merge and pass the neutral Arkiv reader through `runtime.ts`; job creation must continue failing closed until it is available.
3. Validate current network/token/provider prerequisites and report any unavailable dependency without substituting a fake success.
4. Obtain authorized provider configuration and a Hindi reviewer, then record actual private inference evidence and review findings.
5. Deploy and verify the real checkout only after terms and configuration are frozen; record remaining limitations and evidence.

## Coordination and branch publishing

The root used a dedicated GPT-6.1 Sol high coordinator, GPT-6.1 Terra high contract worker and GPT-6 Luna medium documentation worker. The root reviewed/integrated the changes and performed broad build/runtime checks. The complete staged assignment and prerequisite instructions are in `docs/san-backend-payments.md` and `docs/SETUP-LIVE-INTEGRATIONS.md`.

Branch is `codex/payment-backend`. Main has not been changed. The local repository now scopes HTTPS credentials by repository path to avoid reusing a different cached GitHub login. Do not place a PAT in any document or remote URL. Remote publishing status must be recorded from the actual push result.

Actual local commits: `8e5a2a2` (staged plan/setup) and `d5abe3c` (tested backend foundation). Push was attempted and failed because the noninteractive environment could not read the password for the repository-scoped login. No remote push is claimed. Follow the Terminal command in the setup guide to publish the branch interactively; no token needs to enter chat. Clean `npm ci` completed, and the final root lint/typecheck plus 21 server tests and 5 contract tests passed after that clean install.

## BriefMint Part 1 follow-up — 6 November 2026

Implementation commit `1ebeeab` on `codex/payment-backend` hardens current-origin challenge binding, credential/model/endpoint validation, public reader readiness and the existing guarded single-inference probe. The detailed acceptance matrix and preserved history are in [backend-checkpoint.md](briefmint/backend-checkpoint.md); the operator command is in [0G_LIVE_PROBE.md](briefmint/0G_LIVE_PROBE.md).

Checks actually run: 67 targeted BriefMint tests across six files, four selected legacy auth/HTTP tests (14 unrelated cases skipped), root TypeScript check, ESLint for changed TypeScript, and Git whitespace checks; all passed. Public-only 0G catalog CLI passed with zero inference at 09:57:30 UTC / 15:27:30 IST. Test provider/chain responses are local doubles. Full suite/build/browser checks remain Part 3. No credential values or frontend files were accessed or modified; no authenticated inference, chain writes, deployment, push or merge occurred. The historical HTTP 502, unmeasured debit and absent independent response verification remain unresolved; overall PRD estimate stays 67%.

## BriefMint Part 2 follow-up — 6 November 2026

Implementation commit `42258e1` adds explicit pending outcomes and exclusive arming, hardens SDK reads/receipts/schema/filters and supplies the standalone public reader. The checkpoint, [Agent B handoff](briefmint/AGENT_B_FRONTEND_HANDOFF.md) and [future live probe](briefmint/ARKIV_LIVE_PROBE.md) state compatibility, recovery and live limits. Verified 63 tests in five targeted files; root and Vite typechecks, changed-file ESLint, Git whitespace and executable reader help passed. All chain/record data tested was synthetic; no live reader query, wallet action, Arkiv write, credential access, frontend change, deployment or push occurred. Overall PRD estimate is 68%; Agent B signing guards/persistence and actual lifecycle/independent-reader evidence remain required. Full project verification is reserved for Part 3.

## BriefMint Part 3 final verification — 6 November 2026

Code/runbook commit `c814af7`: adds 3 MOCK vertical-slice cases, isolates the process smoke environment, verifies the actual Vite API proxy and standalone restart, and narrowly guards invalid/new public previews in `apps/web/src/App.tsx` (documented ownership exception, no teammate conflict). Node v24.21.0; full server suite **126 passed / 12 files**, root lint/typecheck/build passed, Vite typecheck/build passed, and **5 simulated-chain Solidity tests passed**. Solidity's first sandbox invocation timed out on a compiler-cache lock; approved retry passed with dotenv/deployer loading disabled. Local `npm run smoke:local` passed with zero external calls/dispatches. Only Vite checks repeated after the late preview guard. Existing legacy `use client` and smoke Vite `envFile` deprecation warnings were nonfatal; Vite has no configured lint command. Git whitespace passed. No live sponsor/browser/host evidence, credentials, remote push/merge or deployment.

The complete [BM acceptance matrix](briefmint/backend-checkpoint.md) supersedes historical percentage estimates. [LIVE_VALIDATION_AND_SUBMISSION.md](briefmint/LIVE_VALIDATION_AND_SUBMISSION.md), [DEMO_NOTES.md](briefmint/DEMO_NOTES.md) and the final [Agent B handoff](briefmint/AGENT_B_FRONTEND_HANDOFF.md) contain exact commands, consent gates and remaining code/manual work. The three external gates remain successful authorized private 0G inference (prior 502 unresolved), real browser wallet/signature behavior after B fixes, and real Arkiv lifecycle/native-expiry/independent-reader evidence. Production/retention/attribution/submission limitations are explicit; full PRD completion is not claimed.

## Amber Harbor frontend checkpoint — 7 November 2026 IST

User-authorized UI refinement: expandable task workbench, responsive camera reservation, task-first narrow layouts, readable controls, explicit opportunity focus/selection and BriefMint-only navigation cleanup. Building names stay above roofs in both renderers. No backend/DTO/auth policy, inference, Arkiv write, credentials or existing SQLite data changed. 182 server tests and 27 UI tests, lint/typecheck/build passed. Live wallet/generation/publication were not rerun; prior sponsor evidence and limitations remain unchanged. See [UI brief](briefmint/AMBER_HARBOR.md).
