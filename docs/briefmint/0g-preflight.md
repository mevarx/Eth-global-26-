> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# 0G first-request preflight

Current operator-reported evidence and runtime command: [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md). The history below preserves the earlier preflight and HTTP 502 attempt; a later single standalone request succeeded with incomplete Router verification metadata.

Base backend checkpoint: `a99a0d2`. Scope: necessary smoke safety, compatibility and reporting fixes only. No frontend, private database, payment, Whitechain or Arkiv changes in that preflight checkpoint. No API key accessed by the assistant. The operator's one failed authenticated attempt is recorded below. Full-PRD completion at preflight was approximately **55%**; see [the current backend checkpoint](backend-checkpoint.md) for later local implementation progress. Catalog inspection or the failed request earns no live-inference completion credit.

## Current readiness

The actual unauthenticated `--preflight` CLI passed on 6 November 2026 at 07:49 UTC / 13:19 IST. The [public Router catalog](https://router-api.0g.ai/v1/models) reported `0gm-1.0-35b-a3b`, type chatbot, TeeML, one provider, OpenAI format, and support for max_tokens, response_format and chat_template_kwargs. The public GET took 2,203 ms in that run; **inferenceRequests was 0**. This proves catalog compatibility, not allocated capacity, key eligibility, credit coverage, successful output or model identity by independent verification. The live command rechecks the catalog immediately before dispatch and refuses incompatible/missing entries.

| Requirement | Local preflight finding |
|---|---|
| Private policy | Existing `X-0G-Provider-Trust-Mode: private` retained |
| Fallbacks | `X-0G-Provider-Allow-Fallbacks: false`; no model substitution |
| Model | Pinned catalog-checked `0gm-1.0-35b-a3b`; unavailable/incompatible catalog blocks POST |
| Input | Fixed harmless synthetic folder-labeling checklist; no CLI/env private notes |
| Metadata | Actual returned request ID, model/provider, routing tier, Router flag and response reference; missing values stay null |
| Shape | Strict BriefMint model/source-reference validation; no partial result success |
| Measurement | End-to-end local completion/validation latency, HTTP status, reported token counts and Router-reported neuron billing when present |
| Verification | Requests `verify_tee: true`; independent response verification explicitly remains unavailable |
| Logs | Only allowlisted metadata/status; no raw model text, prompts, keys, Authorization or exception diagnostics; credential echoes checked before JSON escaping |
| Request boundary | At most one client inference POST per invocation; no redirects, retries, loops, failover or follow-up inference |
| State | No job, quota ledger, session, database, wallet, Arkiv or Whitechain imports/writes in smoke |

Catalog GET is unauthenticated and bounded to 15 seconds/2 MB. Completion uses the existing private provider adapter with smoke-only requested max_tokens=1200, JSON object mode and thinking disabled. These options are accepted only after the catalog advertises them. Backend defaults remain unchanged: its normal token limit is still 3000, and smoke options do not alter saved briefs or service quota policy. Redirects are now rejected by the provider adapter.

The catalog describes thinking as enabled by default and warns that long non-streaming responses may take minutes. The smoke requests thinking disabled and uses a default 180-second timeout, within the backend's existing supported maximum. A timeout/invalid result may still be billed. A requested token limit and client timeout are **not an independently enforced dollar cap**. Do not automatically rerun after an uncertain outcome.

## Defects fixed

- The old standalone script depended on unrelated SESSION_SECRET/application settings and did not automatically load `.env.local`. The smoke now reads only explicitly supplied inference environment variables; no session secret, database or key lookup service is needed.
- The old script did not measure latency or report provider/routing/reference/token/billing fields. These are now allowlisted in one JSON report, with unknowns preserved.
- Model existence/private compatibility were assumed. Public-catalog preflight now checks the exact pinned model on every run; `--preflight` does not even read ZERO_G_API_KEY.
- Redirect behavior was implicit. Both catalog and inference now reject redirects, preventing a client POST being followed to another endpoint.
- Long default thinking could consume the first test's time/token allowance. Smoke-only parameters request non-thinking JSON with a smaller output limit after capability checks.
- Adversarial metadata could echo a credential. Raw report values are checked before JSON serialization; local tests cover ordinary and escaped-character key echoes. Raw errors/content are never logged.

## Exact safe setup: no inference

Run locally from Terminal. Node must be 24.x; existing dependencies are already installed at the validated checkpoint.

```sh
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
node --version
node --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --preflight
```

This command only GETs the public catalog. It sends no Authorization and does not inspect the API key. The `react-server` condition is needed by the existing `server-only` import; `tsx` resolves the TypeScript imports without a separate build.

When the operator chooses to configure credentials privately, create/open an ignored, restricted local file. These commands preserve existing contents:

```sh
(umask 077; touch .env.0g-smoke)
chmod 600 .env.0g-smoke
git check-ignore -- .env.0g-smoke
nano .env.0g-smoke
```

The file contains the following names. The operator supplies the credential privately in the editor; never send it in chat, a command argument or logs. No assistant access to Notes or this populated file is required.

```dotenv
ZERO_G_API_KEY=
ZERO_G_MODEL_ID=0gm-1.0-35b-a3b
ZERO_G_BASE_URL=https://router-api.0g.ai/v1
INFERENCE_TIMEOUT_MS=180000
```

No SESSION_SECRET, wallet, funding transaction, checkout configuration or Arkiv setup is required by this isolated smoke. Node's explicit `--env-file` handles loading; the script does not scan `.env.local` or any other file. Existing exported variables take precedence over Node env-file values; the smoke refuses a different base/model or out-of-range timeout. Run in a normal fresh Terminal without unrelated exported 0G overrides.

## The single live command: wait for explicit authorization

```sh
node --env-file=.env.0g-smoke --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --authorize-paid-inference
```

The operator ran this command once on 6 November 2026. It performed one completion POST and returned `status=failed`, `phase=inference`, `code=PROVIDER_UNAVAILABLE`, HTTP 502, 1,827 ms, `mayHaveBeenBilled=true`, and `automaticRetry=false`. This is a conservative billing indicator, not confirmation of a debit. The initial diagnostic output did not preserve upstream error type/code/request ID, so the exact failure cause cannot be recovered for that request. The smoke now captures only those allowlisted fields on future runs; it never logs the provider error message or raw response.

Do not rerun based on this result. First inspect the provider account's usage/credit history directly. A later invocation would be a new potentially billable request and requires a separate explicit authorization. No additional inference has been run by the assistant.

`status=completed` means validated structure plus reported request/provider/model and successful Router verification were present. It does not mean independent verification passed. `completed_evidence_incomplete` preserves null/mismatched reported fields, returns nonzero, and does not retry. Failures report a safe phase/code, elapsed time, attempted request count, whether billing is uncertain, and allowlisted upstream error type/code/request ID when present. Raw provider messages are never logged. Returned raw provider bytes are held in memory for extraction and are not printed or written to disk by this smoke. Missing/malformed structured responses may not yield parsed evidence; no ID is invented.

## Local validation and external limits

91 server tests passed, including 17 injected smoke cases. Lint/typecheck and whitespace checks pass. The actual public-only CLI passed. The operator's one live attempt failed with HTTP 502 as recorded above; no assistant-run inference occurred. Provider/private capacity, promotional-credit eligibility/debit, semantic quality, actual cost and independent registered-signer/content verification remain unproven. The observed 1,827 ms is the failed response duration, not successful model latency.

Official references: [private routing and public model catalog](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy), [Router error codes](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/errors), [Chat Completions parameters/trace](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/chat-completions), [Router versus independent verification](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution). The catalog and documentation were read without authentication; neither substitutes for the separately authorized live test.
