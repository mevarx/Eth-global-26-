# Tool City — Common Project Structure and Integration Contract

**Handoff version:** 1.0 · 6 November 2026.  
**Read by:** both coding agents before implementation.  
**Companions:** [Your backend assignment](TOOL-CITY-YOUR-BACKEND-STRUCTURE.md) and [teammate's frontend assignment](TOOL-CITY-TEAMMATE-FRONTEND-STRUCTURE.md).  
**Status:** specification only. Paths, interfaces and commands below describe what to create; they are not an existing scaffold or tested integration.

Official integration references: [Arkiv Mumbai requirements](https://ethglobal.com/events/mumbai/prizes/arkiv), [Whitechain Mumbai requirements](https://ethglobal.com/events/mumbai/prizes/whitechain), [0G Mumbai requirements](https://ethglobal.com/events/mumbai/prizes/0g). Recheck current SDK examples and actual availability during implementation; the shared application contract here must stay coordinated when adapting them.

## 1. Authority and fixed scope

This document is the naming, structure and integration authority for the two agent assignments. Product scope comes from the approved [final brief](TOOL-CITY-FINAL-PROJECT.md); the [build plan](TOOL-CITY-BUILD-PLAN.md) provides rationale and scheduling. Both agents must receive **this common file plus their individual assignment**. Those two files contain the essential implementation instructions; the earlier briefs are supporting context.

Build one city-themed private text-translation service: approximately 100–250 words, English → Hindi, one merchant, one fixed test-USDT price, one normal private inference operation, source-aligned review, editing, export and recovery of paid jobs. Confirm a Hindi reviewer and actual private-model usefulness first.

Arkiv supplies provider-owned public discovery. Whitechain supplies checkout and purchase entitlement. 0G performs the actual translation. The server pays for compute separately. Private routing does not hide the draft from our backend.

Excluded: audio, uploads, SRT, gasless relayers, Storage, iAI login, multi-merchant registration, dynamic pricing, subscriptions, refunds, autonomous spending, game engines and extra languages. Do not introduce these to fill a perceived gap.

## 2. Repository and bootstrap rule

Use **one repository, one Next.js application, one API, one database and one production Node deployment** with persistent disk. Do not independently scaffold two full projects and try to combine them at the end.

**Agent A = you + Codex, backend/payments. Agent B = teammate + OpenCode, frontend/Arkiv.**

1. A creates a `tool-city/` project directory and initializes the application repository **inside that directory**. Check the repository root before using Git; do not accidentally use an enclosing home-directory repository.
2. A creates the shared types/configuration, root scripts and minimal compiling placeholders for B's entry components. Both agree on this contract before parallel implementation.
3. Commit and share that exact bootstrap commit. B clones the same repository and starts from that commit. If working on the same machine, use separate worktrees; never have two agents edit the same checkout.
4. A works on `codex/payment-backend`; B on `codex/city-frontend`. A is the integrator. Do not force-push or overwrite the other branch.
5. A alone owns root dependencies and the lockfile. Use npm and commit one root `package-lock.json`; install exact validated versions once. B requests dependency changes through A. No nested lockfile.

While A bootstraps, B can review current Arkiv documentation and prepare the visual layout. B must not create another Next.js root.

## 3. Canonical structure

Ownership markers: **A** backend/integration, **B** frontend/Arkiv. These are intended paths, not files already created.

```text
tool-city/
├── README.md                                      A, B supplies UI/Arkiv notes
├── package.json                                   A
├── package-lock.json                              A
├── next.config.ts                                 A
├── tsconfig.json                                  A
├── hardhat.config.ts                              A
├── .env.example                                   A
├── .gitignore                                     A
├── config/
│   ├── deployment.json                            A — public network/deployment data
│   └── service-terms.txt                          A — exact immutable terms bytes
├── contracts/
│   ├── ToolCityCheckout.sol                       A
│   └── test/ToolCityCheckout.test.ts               A
├── scripts/
│   ├── deploy-checkout.ts                         A
│   └── verify-deployment.ts                       A
├── src/
│   ├── app/
│   │   ├── layout.tsx                             A — thin integration shell
│   │   ├── globals.css                            B
│   │   ├── page.tsx                               B — city
│   │   ├── jobs/page.tsx                          B — My Jobs
│   │   ├── jobs/[jobId]/page.tsx                  B — reopen/review
│   │   ├── merchant/page.tsx                      B — owner console/settlements
│   │   └── api/                                   A — every route handler
│   │       ├── config/route.ts
│   │       ├── auth/challenge/route.ts
│   │       ├── auth/verify/route.ts
│   │       ├── auth/session/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── jobs/route.ts
│   │       ├── jobs/[jobId]/route.ts
│   │       ├── jobs/[jobId]/verify-payment/route.ts
│   │       ├── jobs/[jobId]/run/route.ts
│   │       ├── jobs/[jobId]/edits/route.ts
│   │       ├── merchant/purchases/route.ts
│   │       └── merchant/purchases.csv/route.ts
│   ├── components/                                B
│   │   ├── app/ClientProviders.tsx
│   │   ├── app/AppShell.tsx
│   │   ├── wallet/WalletControls.tsx
│   │   ├── city/{CityScene,IsoBuilding,Worker,CityPanel}.tsx
│   │   ├── city/{scene-config,job-state-to-scene}.ts
│   │   ├── workshop/{WorkshopCard,WorkshopEditor}.tsx
│   │   ├── checkout/ToolCityPay.tsx
│   │   ├── jobs/{DraftForm,JobList,TranslationReview,JobEvidence}.tsx
│   │   └── merchant/PurchaseTable.tsx
│   └── lib/
│       ├── shared/                                A — client-safe contracts
│       │   ├── domain.ts
│       │   ├── api.ts
│       │   ├── validation.ts
│       │   ├── deployment.ts
│       │   ├── checkout-abi.ts
│       │   └── fixtures.ts                        labelled development data only
│       ├── client/                                B
│       │   ├── api-client.ts
│       │   ├── use-session.ts
│       │   ├── use-job.ts
│       │   ├── wallet-config.ts
│       │   └── exports.ts
│       ├── arkiv/                                 B — server-neutral reads separated
│       │   ├── schema.ts
│       │   ├── read.ts
│       │   └── write.ts
│       └── server/                                A — never imported by browser
│           ├── env.ts
│           ├── auth.ts
│           ├── db.ts
│           ├── jobs.ts
│           ├── payment.ts
│           ├── inference.ts
│           ├── recovery.ts
│           ├── settlements.ts
│           └── migrations/001-initial.sql
├── public/
│   └── city/                                      B — original assets if needed
├── examples/checkout-demo/                         B
│   ├── package.json                               A sets dependencies; B owns UI/scripts
│   ├── index.html
│   ├── vite.config.ts
│   └── src/{main,App}.tsx
├── tests/
│   ├── server/                                    A
│   └── ui/                                        B — focused smoke checks if useful
├── arkiv/                                         B
│   ├── schema.md
│   ├── friction.md
│   ├── reach.md
│   ├── why-arkiv.md
│   └── how-you-use-arkiv.md
├── docs/
│   ├── backend-handoff.md                         A
│   ├── frontend-handoff.md                        B
│   ├── integration-checklist.md                   A, both execute
│   └── demo-script.md                             B
└── WHITECHAIN_FEEDBACK.md                          A
```

Brace groups above mean separate files, not literal filenames. Do not create empty files for appearance; implement modules when needed. A may simplify internal helper files without changing public contracts or crossing ownership boundaries.

Both may import `src/lib/shared/*`. Browser code must never import `server/*`. `arkiv/read.ts` must have no wallet hooks, React dependency, browser globals or secret access, so A can use it server-side. `arkiv/write.ts` receives the connected wallet transport and remains browser-only. Import specific modules rather than a barrel that drags browser writes into the server.

## 4. Shared configuration and ABI

Only A edits the public manifest. It contains `schemaVersion: 1`, application namespace `tool-city.workshop.v1`, source/target languages, Arkiv Rabdi chain/RPC/explorer, and Whitechain chain/RPC/explorer/token plus verified deployment fields.

Whitechain chain ID is **1874**; official token is **`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`**. Arkiv Rabdi chain ID is **7794095**. Revalidate official endpoints and actual token decimals during setup. Initial price is 1 test USDT expressed using those verified decimals.

Use the exact public terms field names in the types below. Before deployment, unknown checkout/merchant/service/terms/amount fields are `null` and `configured=false`; do not put a zero address or made-up working receipt in production config. Purchasing stays disabled until actual contract reads reconcile with configuration.

A derives service ID once from a documented stable identifier and exports it through the manifest. `termsHash` commits to the exact UTF-8 bytes of `config/service-terms.txt`. Freeze those bytes before deployment. B does not independently calculate IDs or copy ABI fragments.

Freeze this intended Solidity interface before B implements checkout:

```solidity
purchase(bytes32 jobId, bytes32 expectedServiceId,
         uint256 expectedAmount, bytes32 expectedTermsHash)
getPurchase(address buyer, bytes32 jobId) // returns the Purchase struct
```

`Purchase` fields: `buyer`, `serviceId`, `merchant`, `amount`, `termsHash`. A zero buyer means absent. Uniqueness key binds buyer + job ID. Token, merchant, service, amount and terms are fixed at deployment. Emit:

```solidity
event PurchaseMade(address indexed buyer, bytes32 indexed jobId,
  bytes32 indexed serviceId, address merchant, uint256 amount,
  bytes32 termsHash);
```

The signature sketches are not complete deployable Solidity. A generates `checkout-abi.ts` from the actual compilation and verifies it matches this interface. Any necessary change must update this common contract, shared types, ABI and B's consumer together before merging.

## 5. Canonical shared types

Implement these names in `domain.ts`; do not create parallel frontend/backend versions. All JSON amounts and block numbers are decimal strings. Dates are UTC ISO strings. Addresses, hashes, random 32-byte job IDs and segment IDs are strings validated at runtime; TypeScript alone is insufficient.

```ts
type Address = `0x${string}`;
type Hex = `0x${string}`;
type JobStatus = 'awaiting_payment' | 'payment_pending' | 'paid'
  | 'running' | 'ready' | 'interrupted' | 'failed';
type SourceSegment = { id: string; text: string };
type TranslationSegment = { id: string; text: string };

type CheckoutTerms = {
  chainId: number; checkoutAddress: Address; tokenAddress: Address;
  tokenDecimals: number; amountAtomic: string; merchantAddress: Address;
  serviceId: Hex; termsHash: Hex;
};
type WorkshopView = {
  entityKey: Hex; ownerAddress: Address; title: string; description: string;
  active: boolean; sourceLang: 'en'; targetLang: 'hi';
  jobType: 'text.translate'; checkoutChainId: number;
  checkoutAddress: Address; serviceId: Hex; termsHash: Hex;
  expiresAtBlock: string | null; fetchedAt: string;
  freshness: 'fresh' | 'stale'; supported: boolean;
};
type PaymentView = {
  txHash: Hex; status: 'submitted' | 'verified';
  blockNumber: string | null; verifiedAt: string | null;
};
type InferenceEvidence = {
  requestId: string | null; modelId: string | null;
  providerId: string | null; routingTier: string | null;
  verificationRequested: boolean; routerTeeVerified: boolean | null;
};
type JobView = {
  id: Hex; buyerAddress: Address; workshopEntityKey: Hex;
  sourceLang: 'en'; targetLang: 'hi'; status: JobStatus;
  sourceSegments: SourceSegment[]; terms: CheckoutTerms;
  payment: PaymentView | null;
  modelSegments: TranslationSegment[] | null;
  editedSegments: TranslationSegment[] | null;
  evidence: InferenceEvidence | null;
  attemptsUsed: number; retryEligible: boolean;
  error: { code: string; message: string } | null;
  createdAt: string; updatedAt: string;
};
type JobSummary = Pick<JobView, 'id' | 'status' | 'createdAt' | 'updatedAt'
  | 'sourceLang' | 'targetLang'>;
type ToolCityPayProps = {
  job: JobView; onJobChange: (job: JobView) => void;
};
type MerchantPurchase = {
  jobId: Hex; buyerAddress: Address; merchantAddress: Address;
  serviceId: Hex; txHash: Hex; blockNumber: string; verifiedAt: string;
  chainId: number; tokenAddress: Address; amountAtomic: string;
};
type PublicConfig = {
  schemaVersion: 1; configured: boolean; appNamespace: string;
  sourceLang: 'en'; targetLang: 'hi'; maxWords: 250; maxChars: 5000;
  arkiv: { chainId: number; rpcUrl: string; explorerUrl: string };
  whitechain: { chainId: number; rpcUrl: string; explorerUrl: string;
    tokenAddress: Address };
  terms: CheckoutTerms | null; serviceTermsText: string;
};
```

`freshness` does not include unavailable because no current record may exist: the query result wraps `WorkshopView[]`, loading/error state and last successful refresh separately. Never invent a record or expiry reason for a failed/missing read. Report expiry as a block when available; do not guess a calendar date from an assumed block time.

Validate/normalize EVM addresses for comparisons rather than comparing mixed-case strings literally. The persisted job ID is exactly 32 random bytes; a segment ID such as `seg_001` is not an EVM identifier.

Keep sensitive raw provider trace material server-side. Null evidence means unavailable/not reported, not success. `routerTeeVerified` is a Router report, not independent verification or translation accuracy.

## 6. Exact HTTP contract

Define generic envelopes in `api.ts`:

```ts
type ApiResult<T> = { ok: true; data: T } | {
  ok: false; error: { code: string; message: string; retryable: boolean }
};
```

Use JSON except merchant CSV. Sessions use cookies, not a buyer address supplied in each request. Protect state-changing endpoints with same-origin/allowed-origin checks; session signatures bind nonce, address, expiry and expected application domain/URI. Auth challenges are not payment authorizations.

| Endpoint | Input | Success `data` |
|---|---|---|
| `GET /api/config` | None | `PublicConfig` |
| `GET /api/auth/challenge?address=...` | Wallet address | `{ challengeId, message, expiresAt }` |
| `POST /api/auth/verify` | `{ challengeId, signature }` | `{ address, expiresAt }`; sets session cookie |
| `GET /api/auth/session` | Cookie | `{ address, expiresAt }`; unauthenticated is 401 |
| `POST /api/auth/logout` | Empty object | `{ loggedOut: true }`; clears cookie |
| `POST /api/jobs` | `{ workshopEntityKey, text }` | `JobView`; status 201 |
| `GET /api/jobs` | Cookie | `{ jobs: JobSummary[] }`, newest first |
| `GET /api/jobs/:jobId` | Cookie | `JobView` |
| `POST /api/jobs/:jobId/verify-payment` | `{ txHash }` | `JobView`; 202 while receipt/confirmations pending, 200 when verified |
| `POST /api/jobs/:jobId/run` | Empty object | `JobView`; 200 completed, 202 if already running |
| `PATCH /api/jobs/:jobId/edits` | `{ segments: TranslationSegment[] }` | `JobView` after saved edits |
| `GET /api/merchant/purchases` | Merchant cookie | `{ purchases: MerchantPurchase[] }` |
| `GET /api/merchant/purchases.csv` | Merchant cookie | CSV download with settlement fields only |

Request DTO types live in `api.ts`, including challenge/session responses. A defines concrete types for abbreviated auth fields above: IDs/messages/signatures are strings and times are UTC ISO strings. Never accept a requested price, buyer, model, retry allowance or `paid` flag as authority.

Error conventions: 400 `BAD_INPUT`; 401 `UNAUTHENTICATED`; 403 `FORBIDDEN` for merchant role; 404 `NOT_FOUND` for nonexistent **or another buyer's** job; 409 `PAYMENT_MISMATCH`, `JOB_NOT_PAID`, `JOB_NOT_READY` or `RETRY_NOT_ALLOWED`; 503 `SERVICE_UNAVAILABLE` or `PROVIDER_UNAVAILABLE`; 502 `PROVIDER_FAILED`; 500 `INTERNAL_ERROR`. Sanitize messages. Pending verification and an already-running job are normal success-envelope states, not fabricated failures. Idempotent verification/reopen returns existing state; a duplicate onchain purchase still reverts.

For a provider error, persist the job/attempt state, return the appropriate error envelope, and let the UI refetch the job. Do not erase the paid entitlement or deliver an unvalidated partial result.

## 7. Cross-boundary invariants

- Text is nonempty after trim, at most 250 whitespace-delimited words and 5,000 characters. Recommend 100–250 words; no 100-word hard minimum. Share this validation. Split on blank paragraphs, assign `seg_001` etc. once on the server, cap at 20 nonempty segments. The model returns corresponding IDs; it cannot replace the saved source.
- After job creation, source and accepted terms are immutable. To change the source, make a new unpaid job. Do not accidentally repurchase a paid job during recovery.
- Before creating a new job, server independently checks current Arkiv listing, owner and configured service. A previously accepted job can still be paid/recovered after catalogue withdrawal; this prototype's withdrawal stops new discovery/quotes, not the immutable contract.
- Normal allowance/approve/purchase uses the actual compiled ABI and contract-reconciled terms. Customer requires native test gas. No injected browser key, relayer or autonomous signer.
- Backend verifies the successful receipt, configured network/token/contract, buyer/job/service/payee/amount/terms, settlement and purchase state. A visible transaction hash is not authentication.
- `run` requires verified entitlement and a durable atomic lock. Maximum two dispatched provider attempts per job: initial + one eligible manual retry. Count dispatch before calling; uncertain attempts count. Only server decides eligibility.
- Use a bounded server-side request in the persistent Node runtime, with a durable lease longer than the request timeout. No detached promise that is lost on request completion. Reconcile expired leases to interrupted state; do not steal active locks during a deployment overlap. No exactly-once provider claim.
- Browser starts `run` only from a deliberate user action; it does not rerun it on mount. Poll `GET job` roughly every two seconds only during active states; payment verification can be retried safely with backoff.
- Only ready jobs accept edited segments. PATCH supplies the complete matching ID set. Keep model output intact. UI shows unsaved edits and exports the saved edited version, or saved model version if unedited.
- Session account change clears private UI/query caches and logs out. Network switching alone does not change the authenticated buyer.
- Merchant endpoints return settlements, never raw buyer drafts, model text or edits. No raw content in public entities, chain events, logs or public evidence.

## 8. Arkiv adapter and city boundaries

B exports these logical functions, implemented against the installed SDK:

```ts
listWorkshops(config: PublicConfig): Promise<WorkshopView[]>;
getWorkshop(config: PublicConfig, key: Hex): Promise<WorkshopView | null>;
```

Successful missing record yields null; failed network/query throws a typed, sanitized error. Translate actual SDK behavior inside the adapter. Both consumers receive the same normalized fields. `supported` is a convenience flag; server must independently compare owner/service/checkout/terms with configured terms.

Public schema fields: `app`, `title`, `description`, `active`, `jobType`, `sourceLang`, `targetLang`, `checkoutChainId`, `checkoutAddress`, `serviceId`, `termsHash`. Owner/expiry come from system fields. `app` equals `tool-city.workshop.v1`. Anyone may use the same tag; never treat it as trusted provenance. Fixed financial terms are not editable listing fields.

`ClientProviders({ children })` is B's wallet/query-provider boundary, imported by A's thin root layout. `ToolCityPay({ job, onJobChange })` accepts a `JobView` and reports updated `JobView`; it handles allowance/approve/purchase and verification, not inference. `jobStateToScene(job)` is a pure B-owned mapper. Local draft/review UI states are distinct from persisted job status.

Five buildings plus one worker: Home, Registry, Treasury, Translation Studio, Archive. SVG and CSS only, original assets. The real saved job drives animation; a timer never sets ready. Keep text/keyboard alternatives, responsive review and reduced motion.

## 9. Environment, demo example and commands

A defines `.env.example` names: `APP_ORIGIN`, `AUTH_ALLOWED_ORIGINS`, `SESSION_SECRET`, `DATABASE_PATH`, `WHITECHAIN_RPC_URL`, `ARKIV_RPC_URL`, `ZERO_G_API_KEY`, `ZERO_G_BASE_URL`, `ZERO_G_MODEL_ID`, `INFERENCE_TIMEOUT_MS`, `PAYMENT_CONFIRMATIONS`, `DEPLOYER_PRIVATE_KEY`, `NEXT_PUBLIC_ENABLE_DEV_FIXTURES`. Document any provider-specific addition before use. Real values stay out of Git. Deployment private key is needed by deployment tooling, not the running web application.

No `NEXT_PUBLIC_` secret. Public network/deployment data comes from the manifest/config endpoint. The fixture flag may affect development rendering only and must be false/absent in production; server authorization never reads it to bypass payment.

Use one root npm workspace for `examples/checkout-demo` if needed. It is a tiny independent Vite/React consumer of shared client-safe components, not another backend. B builds it with base `/checkout-demo/` into generated `public/checkout-demo/`; do not commit generated files. Production main app serves `/checkout-demo/index.html`, so API and cookies share origin. The Vite development server proxies `/api` to Next on port 3000; A explicitly allowlists the local demo origin for authentication. No permissive credentialed CORS.

A establishes these script names in the bootstrap: `dev`, `build`, `start`, `lint`, `typecheck`, `test:server`, `test:contracts`, `contracts:compile`, `contracts:deploy`, `contracts:verify`, `demo:dev`, `demo:build`. Wire `build` to build the example before Next. Scripts must use the installed tools' current supported commands. Run the production app as one Node instance with a persistent SQLite volume, not Edge/serverless ephemeral storage. Document the measured timeout/confirmation settings rather than guessing finality.

## 10. Integration and merge protocol

**M0 — shared base:** A publishes bootstrap commit, frozen DTOs, scripts, example dependency setup and labelled fixture. B confirms it builds. No deployed values are fabricated.

**M1 — adapters and deployment:** B delivers genuine Arkiv read/write integration and neutral read adapter. A delivers compiled ABI and real deployment manifest. Each includes tested commands, actual addresses/queries and remaining blockers in their handoff note.

**M2 — paid slice:** Merge a real listing → authenticated buyer → official-token purchase → server verification → actual private translation → saved review. Use plain screens first. A may use an explicitly test-only injected Arkiv adapter for unit checks while B is unfinished; it must not serve new jobs in live mode.

**M3 — complete experience:** Integrate city, edits/export/archive, merchant CSV and separate checkout example. No fake paid/run success. Stop new features if this breaks the slice.

**M4 — release:** From the combined branch, clean `npm ci`, lint/typecheck, production build, targeted server/contract checks and manual end-to-end/failure checks pass. Confirm persistent restart, wrong-buyer denial, unpaid denial, wrong terms, duplicate purchase, concurrent execution, provider failure/retry, listing withdrawal and actual exports.

Merge small batches during development, not only at completion. A merges B's committed branch and keeps B's owned files authoritative; B merges the updated common base before continuing. Resolve interface conflicts together. No force push or blind directory replacement. Record any contract revision here and bump `Handoff version` before both agents continue.

Each handoff note lists: commit, files changed, commands actually run and results, live vs fixture integrations, deployment/configuration dependencies, known failures and next owner action. Successful combination is something to verify at M2–M4, not guaranteed by matching folder names alone.
