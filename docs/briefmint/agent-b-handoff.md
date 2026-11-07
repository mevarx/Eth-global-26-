> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint Agent B handoff

The backend slice and the first city/Arkiv integration are implemented on `codex/payment-backend`; the current checkpoint is recorded in [backend-checkpoint.md](backend-checkpoint.md). Import the canonical DTOs in `src/lib/shared/briefs.ts`. This remains not evidence of live 0G/Arkiv or a browser wallet journey.

## API reference

Every endpoint returns the shared `{ok:true,data}` or `{ok:false,error:{code,message,retryable}}` envelope and `Cache-Control: no-store`. Requests reject unknown fields; private endpoints are owner-bound to the server-authenticated session. IDs and hashes below are placeholders, not usable identifiers.

| Key | Method / path | Request | Success response |
|---|---|---|---|
| `config` | `GET /api/briefmint/config` | No query | `BriefmintConfig` |
| `list` | `GET /api/briefs` | Optional `beforeId` | `{briefs: BriefSummary[], nextBeforeId: string \| null}` |
| `create` | `POST /api/briefs` | `{notes, publicParameters}` | `BriefView` (201) |
| `get` | `GET /api/briefs/:id` | No query | `BriefView` |
| `run` | `POST /api/briefs/:id/run` | `{}` | `BriefView` (200 ready / 202 running) |
| `saveDraft` | `PUT /api/briefs/:id/draft` | `{expectedRevision, draft}` | `BriefView` |
| `approve` | `POST /api/briefs/:id/approve` | `{expectedRevision, publicPayloadHash}` | `BriefView` |
| `prepare` | `POST /api/briefs/:id/publication/prepare` | `{intentId, expectedRevision, publicPayloadHash, operation}` | `PublicationIntent` |
| `reconcile` | `POST /api/briefs/:id/publication/reconcile` | `{intentId, transactionHash, entityKey}` | `BriefView` (200 settled / 202 unresolved) |
| `refresh` | `POST /api/briefs/:id/publication/refresh` | `{}` | `BriefView`; read-only chain observation, never publishes or compiles |
| `export` | `GET /api/briefs/:id/export?format=txt\|json[&audience=private\|public]` | Required format; audience defaults to `private` | `{filename, mediaType, content}` |

For `audience=public`, the server requires approval for the current brief revision and exports only its approved public payload. A historical deadline is allowed for export. Filenames are `brief-public-r<revision>.json` or `brief-public-r<revision>.txt`; neither filename nor content includes a private brief ID. Content excludes source text, source references and private evidence. Public export does not publish or refresh chain state. Private exports retain the existing owner check and include private recovery content.

`refresh` only observes the chain through the configured reader. It does not sign, submit, compile, or change approval. If the reader is unavailable or the observation fails, freshness remains unavailable/stale as appropriate and the last confirmed publication is preserved; an unavailable read is never treated as absence or expiry. Saved reads, edits, exports and repeated settled reconciliation report historical observations as `stale`; only a new successful chain observation returns `fresh`. Pending intent state survives refresh. A newly observed external change blocks overwrite and is not attributed to the last application-confirmed transaction.

Types are owned by `src/lib/shared/briefs.ts`; use `BriefApiRequest<K>` / `BriefApiResponse<K>` rather than redefining DTOs. Never send owner, model, quota, paid-state, or evidence claims from the caller. Publication writes are wallet-signed in the browser; `prepare` is not a write.

## Clearly fake examples

Harmless synthetic intake (never use private or real customer notes in a smoke check):

```http
POST /api/briefs
Content-Type: application/json

{"notes":"Synthetic demo: draft a short checklist for labeling three sample folders.","publicParameters":{"title":"Synthetic folder checklist","summary":"A harmless sample brief for interface wiring.","category":"writing","language":"en","budgetUsdCents":null,"deadline":"2026-11-07T00:00:00.000Z","contactUrl":null}}
```

Illustrative draft creation response; every identifier, address, timestamp and content string is synthetic. Generate a deadline within the next seven days when trying the request; the dated example assumes a 6 November 2026 intake. There is no inference evidence before compilation.

```json
{"ok":true,"data":{"schemaVersion":1,"kind":"brief.compile.v1","id":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","ownerAddress":"0x1111111111111111111111111111111111111111","inputSegments":[{"id":"seg_001","text":"Synthetic demo: draft a short checklist for labeling three sample folders."}],"publicParameters":{"title":"Synthetic folder checklist","summary":"A harmless sample brief for interface wiring.","category":"writing","language":"en","budgetUsdCents":null,"deadline":"2026-11-07T00:00:00.000Z","contactUrl":null},"executionStatus":"draft","attemptsUsed":0,"retryEligible":false,"immutableModelResult":null,"editedDraft":null,"draftRevision":1,"evidence":null,"error":null,"review":{"status":"unreviewed","approval":null},"publication":{"status":"unpublished","freshness":"unavailable","confirmed":null,"pending":null},"createdAt":"2026-11-06T00:00:00.000Z","updatedAt":"2026-11-06T00:00:00.000Z"}}
```

For safe error handling, an illustrative response is `{"ok":false,"error":{"code":"PROVIDER_UNAVAILABLE","message":"Compilation is temporarily unavailable.","retryable":true}}`. Never show raw provider/RPC diagnostics or private source text in error UI or logs.

## Implementation and live evidence status

- **Implemented in the shared foundation:** strict schemas and inferred API request/response types, canonical public projection/hash and semantic validation helpers, the integration contract, and contract tests. These tests establish local contract behavior only.
- **Implemented and locally tested:** auth purpose routing, additive persistence/migrations, owner-bound services, all API routes, finite quota/lease/retry runner, private compiler, revision-bound approval, immutable intents, injected server reconciliation, SDK-backed Arkiv schema/reader/writer, and Vite typed API/session/wallet wiring. Original provider response bytes are retained privately in attempt storage. Runtime reader injection occurs only when `ARKIV_ACCESS_KEY` is configured.
- **Still a live proof gate:** successful authorized private inference with verified router and independent response evidence; Arkiv schema/index/expiry behavior and read/write flow on Rabdi; full browser login-to-publication flow and restart recovery. A local double or provider readiness response is not proof of any live gate.
- One operator-authorized 0G smoke attempt returned HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms. Billing was uncertain (`mayHaveBeenBilled=true`), not confirmed. There has been no successful inference and no second attempt. Follow [the 0G preflight record](0g-preflight.md); do not rerun without separate explicit authorization.
- No deployment or live Arkiv lifecycle is claimed. The unauthenticated public catalog preflight passed, but it is not inference evidence.

## Exact Agent B integration steps

The local checkout now includes `apps/web` and `src/lib/arkiv/briefmint/{schema,read,write}.ts`; future work should keep browser/Arkiv and backend areas coordinated through the shared contract. The local setup and evidence checklist are in [local-integration.md](local-integration.md). Start Vite on `http://127.0.0.1:5173`; Next listens on `127.0.0.1:4100`; set both `APP_ORIGIN` and `AUTH_ALLOWED_ORIGINS` to the browser origin. Proxy `/api` unchanged and use relative fetch with `credentials: 'same-origin'`. Do not mix localhost and `127.0.0.1`. Production is one HTTPS origin routing `/api/*` to persistent Node 24 Next and other paths to built Vite assets. No deployment is performed here.

1. GET `/api/auth/challenge?address=...&purpose=briefmint`, sign its exact message, POST verify `{challengeId,signature}`. Chain is 7794095. Clear private caches/logout on account change. Login authorizes no payment or Arkiv write.
2. Create private intake; explicitly run compilation. First successful compilation increments revision 1 to 2. Poll only persisted active states; reopening never calls run. Show model suggestions and source references privately; missing information lives in `openQuestions`.
3. Save the complete candidate with expected revision. A 409 requires reload; save increments revision and invalidates approval. Preview `projectPublicOpportunity(saved.editedDraft, saved.draftRevision)` and compute `hashPublicOpportunity`. Require human review before POST approve. Allowlisting cannot detect a private fact inside approved text.
4. Generate one random 32-byte lowercase intent ID for an explicit create/update/close. Prepare and pass ONLY the returned intent to the wallet writer, never `BriefView`. Validate the intent hash, recheck wallet account/network and display exact public fields before signing. Reconcile actual returned transaction/entity hints.
5. Display last `publication.confirmed` separately from `publication.pending`. An older broadcast intent can confirm after a private edit; it must not overwrite that newer draft. Close requires a saved/approved closed candidate with otherwise identical public content and a newer revision. Reopening closed records and changing deadline/expiry are currently rejected.
6. Map Home to intake, Studio to actual execution, Release Desk to review/approval, Registry to actual pending/confirmed publication and Archive to saved private GET/export. Replace timer results, fake hashes and verification flags in the live UI. Budgets are owner-declared and unfunded.

Use a dedicated shared-source alias; Vite's existing `@` points to its own `src`. Validate responses via `briefApi[K].response`; do not redefine DTOs or import server implementation into browser code.

## Arkiv adapter and remaining operations

`BriefmintArkivReader` and `BriefmintArkivWriter` are now implemented with SDK 1.0.1 schema-based operations. They validate namespace/version, system ownership/key/expiry, canonical content and matching indexed attributes; public queries execute category/language/status/budget/deadline filters on Arkiv. Failed RPC remains distinct from successful absence. The independent reader uses its own endpoint configuration without BriefMint's private API. This is local code evidence only.

Server injection additionally requires `currentBlock(): Promise<{number:string,timestamp:string,blockTimeSeconds:number}>`: decimal block, decimal Unix seconds and a measured positive network timing parameter. Optional async `readiness()` returns boolean. `transaction()` returns receipt-derived signer/chain/affected entities/block, never guessed data and filters receipt logs to the Arkiv engine address. `runtime.ts` wires the reader into `createBriefRuntime(db,env,{reader})` when `ARKIV_ACCESS_KEY` is non-empty; otherwise production/local configuration honestly reports Arkiv unavailable.

- The compiler uses private-only routing, no fallbacks and bounded output. Independent response verification remains unavailable; Router verification is reported evidence. Original provider bytes are private and immutable after success.
- Configure all quota fields explicitly: `BRIEFMINT_ALLOWED_WALLETS`, `BRIEFMINT_COMPILATIONS_PER_WALLET`, `BRIEFMINT_GLOBAL_DISPATCH_LIMIT`, `BRIEFMINT_QUOTA_WINDOW_ID`, `BRIEFMINT_QUOTA_WINDOW_END`. Empty/missing policy disables compilation. Max attempts is 2 and global active count is 1. Do not rotate window IDs to evade a budget. Counts are not a verified dollar cap.
- Readiness failures consume no attempt; dispatched timeouts/failures consume allowance. Refetch after failure for saved retry eligibility.
- Unknown broadcast and reverted receipts conservatively stay pending; the current DTO cannot prove a reverted transaction attempted this exact intent. No cancellation/replacement endpoint exists. Re-prepare is blocked after submission/uncertainty or changed approval; settled IDs cannot authorize signing again. Resolve failed-intent binding before releasing locks.
- External owner changes block automatic overwrite; explicit resolution is not implemented. Deadline/expiry extension is also not implemented.
- Real 0G credit eligibility, model quality/latency, signature verification, Arkiv schema/index/size/expiry, owner selection, connected Vite cookies/account switching, hosting and evidence remain live gates. Do not access Apple Notes or put keys in chat, browser bundles or public records.

## 0G operator status

Use [0g-preflight.md](0g-preflight.md) as the single source for current 0G setup and commands. Its public-only `--preflight` command does not read credentials. Its live command requires a separately authorized potentially billable inference and has already been run once, with an uncertain-billing 502 failure. The old smoke instructions that required `SESSION_SECRET` are obsolete; the isolated current smoke does not require it. No successful completion or independent response verification is established.

Do not run a second inference without separate explicit authorization. Do not use real private notes for smoke input.

## Owner-facing privacy and retention copy

Before an owner enters notes, the interface should state: “Your source notes and private draft are stored in BriefMint’s backend so you can compile, edit, and recover them. The backend processes your notes through the configured private inference route. Private routing does not hide notes from the application backend. Storage uses access-controlled SQLite; this demo does not promise application-level encryption or deletion from host backups. Only fields you review and approve are eligible for public export or publication. Public copies may persist after a record is closed or expires.”

Do not promise a retention duration, backup erasure, zero-knowledge storage, or confidentiality from the operator unless an implemented policy and evidence support it. Public export must follow the current-revision approval rule described above.
