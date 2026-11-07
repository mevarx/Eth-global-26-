> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint 0G live probe: operator gate

Part 1 baseline: `3e26a65`. The existing guarded entry point is `scripts/briefmint-live-smoke.ts`; it is improved here rather than replaced. The operator reports that `.env.0g-smoke` is locally configured, ignored and permission-restricted. The assistant has not opened the file, read or printed the key, or made an authenticated request.

## Latest operator-reported live evidence: 6 November 2026

The operator reports one authorized standalone probe completed with HTTP 200 in 9,133 ms, valid structured output, 668 reported total tokens, request ID `077bd220-2efa-4bbd-bb1f-3b3964ff0038`, and returned model `0gm-1.0-35b-a3b`. Its status was `completed_evidence_incomplete`: `routerVerification` and `routingTier` were null. This overcomes the earlier HTTP 502 for this single probe, but it is not a BriefMint app generation and does not prove a debit amount or promotional-credit source. Independent provider-signature/signer/content verification remains unavailable in the implementation. No retry or second paid request is authorized by this update.

The probe uses the same `ZERO_G_API_KEY`, `ZERO_G_MODEL_ID`, `ZERO_G_BASE_URL`, and `INFERENCE_TIMEOUT_MS` names consumed by `src/lib/server/env.ts` and `src/lib/server/brief-inference.ts`. The new `npm run dev:briefmint-0g` launcher passes `.env.0g-smoke` only to the server process; it does not run inference during startup. The API key is not `NEXT_PUBLIC_*`, and `next.config.ts` does not inline environment values. Keep the application quota empty until an operator sets a finite, explicit allowlist and dispatch budget. The `/api/briefs/:id/run` endpoint itself sends a billable request and must not be used without separate authorization.

The current [Router response documentation](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions) documents `x_0g_trace.request_id`, `provider`, and billing, with `tee_verified` when `verify_tee: true`; it does not document a `routingTier` field. The [verification documentation](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution) says absent/null `tee_verified` means verification was not requested. Since this probe did request it, the missing flag remains unexplained and is correctly treated as incomplete, never as verified. For an independent check, the documented `@0gfoundation/0g-compute-ts-sdk` helper `broker.inference.processResponse(providerAddress, chatID)` needs the provider from the trace and `ZG-Res-Key` (or response `id`); it reads chain/provider evidence and does not require another inference. That independent check has not been implemented/run for this response.

For a local server with the configured 0G process environment, from this repository root:

```sh
npm run dev:briefmint-0g -- --hostname 127.0.0.1 --port 3001
```

The app still needs ordinary local `APP_ORIGIN`, `SESSION_SECRET`, `DATABASE_PATH`, and (only when deliberately enabling compilation) finite `BRIEFMINT_*` quota settings from the ignored runtime environment. Starting the process and reading `/api/briefmint/config` are not inference. Do not place a key in `NEXT_PUBLIC_*`, Vite variables, browser storage, client source, logs, screenshots, or Git.

## Safe preflight

Use Node 24 and the repository's installed dependencies:

```sh
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
node --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --preflight
```

This only GETs the public catalog. It does not read `ZERO_G_API_KEY`, send Authorization, open the database, reserve quota or request inference. With no flag, an unknown flag or extra arguments, the probe exits 2 before any network request.

On 6 November 2026 at 09:57:30 UTC / 15:27:30 IST, the public preflight passed: `0gm-1.0-35b-a3b`, TeeML, one catalog provider, OpenAI format and all required structured-output parameters. Catalog GET latency was 2,558 ms, with zero inference requests. The first sandbox attempt could not reach the catalog; the network-approved public GET passed. This establishes catalog compatibility at that time, not key eligibility or currently allocated private capacity. Every later live invocation rechecks the model and refuses an incompatible catalog; it never substitutes a model.

## Private local setup

The operator maintains the already ignored `.env.0g-smoke` locally. No key should be pasted into chat, shell arguments, screenshots or Git. Only these names are needed:

```dotenv
ZERO_G_API_KEY=
ZERO_G_MODEL_ID=0gm-1.0-35b-a3b
ZERO_G_BASE_URL=https://router-api.0g.ai/v1
INFERENCE_TIMEOUT_MS=180000
```

Check file existence/ignore status and restrict its permissions without printing its contents:

```sh
test -f .env.0g-smoke
git check-ignore -- .env.0g-smoke
chmod 600 .env.0g-smoke
```

No session secret, wallet, Whitechain configuration or Arkiv setup is required by the isolated probe. Missing/malformed credentials fail locally before catalog or inference. The assistant does not need access to the populated file.

## Single command after new explicit authorization

Do not execute this as part of preflight. The flag is required on every intentional potentially billable request:

```sh
env -u ZERO_G_API_KEY -u ZERO_G_MODEL_ID -u ZERO_G_BASE_URL -u INFERENCE_TIMEOUT_MS node --env-file=.env.0g-smoke --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --authorize-paid-inference
```

Clearing these exported names prevents stale shell values from overriding the explicitly selected env file. The command uses the fixed harmless folder-checklist fixture, one private inference POST, no redirects, no automatic retries, `verify_tee: true`, private trust mode, fallbacks disabled, JSON mode, thinking disabled and 1,200 requested output tokens. Default inference timeout is 180 seconds; permitted range is 1–180 seconds. Catalog and body sizes are bounded. A timeout or validation failure can still incur a charge. No subsequent inference is triggered to repair output.

## How to interpret the result

- `completed`: structured BriefMint/source validation passed and the returned request/provider/model identifiers plus Router verification are present. This is not independent signature verification.
- `completed_evidence_incomplete`: structure passed but reported evidence is absent/incomplete; nonzero exit, no retry.
- `failed`: configuration/catalog/inference/validation failed. Inspect only the sanitized phase/code, actual HTTP status, latency, attempted request count and allowlisted upstream identifiers. Success-body identifiers are retained when later structure/model validation fails. Provider error messages, response text, prompts, Authorization and credentials are never logged. Credential echoes are rejected before evidence or original bytes reach storage.
- `routerReportedBillingNeurons` and reported token counts come from the response. `creditSource: unverified` and `promotionalCreditDebit.status: not_measured` mean the probe did not inspect an account balance or prove which pool paid. Do not translate Router cost into a claimed promotional debit. The operator must separately compare the intended pool's before/after usage and transaction timestamps before recording that claim; unknown debit stays unknown. Token limits and dispatch counts do not prove a currency cap.

The earlier operator request returned HTTP 502 / `PROVIDER_UNAVAILABLE` after 1,827 ms. That failure was followed by the single successful operator-reported response above. `mayHaveBeenBilled=true` means uncertainty; it is not a measured debit. The successful request establishes one valid structured response from that run, not ongoing capacity, actual debit, credit source, or independent verification. Check the operator's usage history before any future separately authorized request. The new diagnostics cannot recover identifiers omitted from the historical 502 response.

## Verification boundary

The probe asks the Router to verify the provider's TEE signature and records its boolean. It reports `independentResponseVerification: unavailable` because this implementation does not retrieve a provider signature, resolve the chain-registered signer, verify it and compare signed text with the original response. It does not perform gateway/hardware attestation either. It does not label these capabilities unsupported by 0G: the [official verification procedure](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution) documents an SDK route and manual chain/signature/content checks. Their availability for this exact provider and response is unproven until actual evidence exists. A Router flag alone cannot establish independent verification or semantic quality.

The configured private trust mode and disabled fallback policy follow the [Router privacy contract](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy). The local backend still receives source notes. Original provider bytes are retained privately only by the application runner; this standalone probe holds them in memory and logs metadata only. It creates no jobs, briefs, quota entries, sessions, paid checkouts, Arkiv entities or Whitechain state.

Full cross-project checks and browser integration evidence are reserved for Part 3. The older [preflight history](0g-preflight.md) preserves the first-request record.
