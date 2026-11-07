> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint local integration runbook

This runbook covers the integrated Next backend and Vite city in this checkout. It is local-only: it does not call 0G, configure quota, contact Arkiv, deploy, or broadcast a transaction.

## Start the local API

Use Node 24.x. In a fresh Terminal at the repository root, set a disposable database and local origin policy, then generate a temporary session secret in the shell. Do not print, copy, or record the secret; do not enable shell tracing (`set -x`). The same running shell retains it across an API restart.

```sh
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
node --version
export APP_ORIGIN="http://127.0.0.1:5173"
export AUTH_ALLOWED_ORIGINS="http://127.0.0.1:5173"
umask 077
export BRIEFMINT_LOCAL_DIR="$(mktemp -d /tmp/briefmint-local.XXXXXX)"
export DATABASE_PATH="$BRIEFMINT_LOCAL_DIR/state.sqlite"
export SESSION_SECRET="$(openssl rand -hex 32)"
export ZERO_G_API_KEY=""
export ZERO_G_MODEL_ID=""
export BRIEFMINT_ALLOWED_WALLETS=""
npm run dev -- --hostname 127.0.0.1 --port 4100
```

Keep this process and its shell environment alive while exercising refresh/restart behavior. To restart the API, stop it with Ctrl-C and run the `npm run dev` command again in the same shell. A newly generated secret invalidates existing local sessions. The database is disposable and may contain private test notes; stop the server before removing the generated temporary directory and its SQLite journal/WAL companions. Empty provider/allowlist exports override values Next might otherwise load from local environment files and prevent compilation in this procedure.

No 0G key, quota policy, `SESSION_SECRET` file, wallet key, Whitechain configuration, or Arkiv configuration is needed for auth and private persistence checks. Missing provider/quota should leave compilation unavailable and fail closed; do not count that as a successful compilation. Do not invoke the paid provider smoke from this runbook.

## Start the city through its same-origin proxy

In a second terminal, start the already-configured Vite city:

```sh
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
npm run reference:dev -- --host 127.0.0.1 --port 5173
```

Vite forwards `/api` unchanged to `http://127.0.0.1:4100`. Use relative `/api/...` requests with `credentials: 'same-origin'`. Preserve the browser `Origin` and `Set-Cookie`; do not call port 4100 directly from the browser, add credentialed cross-origin CORS, or mix `localhost` and `127.0.0.1`. The session cookie is host-only and should be stored against the browser origin.

The BriefMint challenge uses chain ID 7794095 for message sign-in. Authentication proves address control; it does not authorize compilation spend or Arkiv publication. Account changes must clear private UI/query caches and log out the previous session before authenticating the new account. Use synthetic harmless notes only.

The city is now API-wired and built, but a successful build does not establish a browser wallet/cookie journey. Record that integrated check as pending until it is exercised against this API. Do not set `VITE_ARKIV_ACCESS_KEY` for this local cookie check; without it the public reader and wallet-write controls remain visibly disabled.

## Production configuration remains a gate

Do not deploy as part of this runbook. The target production topology is one public HTTPS origin: `/api/*` forwards unchanged to one persistent Node 24 Next instance on private port 4100, and other paths serve the built Vite app with SPA fallback only outside `/api`. Keep SQLite on persistent storage and run one application process. Preserve original external `Origin` and `Cookie`/`Set-Cookie`; use the external HTTPS origin for `APP_ORIGIN` and the allowlist. Require `Secure`, `HttpOnly`, `SameSite=Lax`, host-only cookies; do not cache private API responses or return `index.html` for API errors. Proxy timeout must exceed the configured inference timeout plus persistence margin.

Before calling production ready, collect evidence for the actual Node version, HTTPS origin/proxy routing, persistent volume, process count, proxy timeout, and a restart that preserves private records and recovers interrupted work. Host, credentials, disk, timeout, HTTPS and restart evidence are not established by local setup.

## Privacy and retention text for owners

Show this before note entry:

> Your source notes and private draft are stored in BriefMint’s backend so you can compile, edit, and recover them. The backend processes your notes through the configured private inference route. Private routing does not hide notes from the application backend. Storage uses access-controlled SQLite; this demo does not promise application-level encryption or deletion from host backups. Only fields you review and approve are eligible for public export or publication. Public copies may persist after a record is closed or expires.

Do not promise a retention duration, backup erasure, zero-knowledge storage, or confidentiality from the operator without an implemented policy and supporting evidence. The owner must inspect the exact public preview; schema validation cannot detect private facts written into approved text.

## Local integration evidence checklist

Record each result as pass, fail, or not run, and distinguish local behavior from live provider/chain evidence.

- **Authentication and ownership:** sign in through the Vite proxy; verify an unauthenticated request is denied, the owner can read their brief, and a second session receives the same not-found response for an absent and wrong-owner private ID. Confirm private responses are not cached.
- **Private persistence and recovery:** create a synthetic brief, verify its source stays private, refresh the browser, then stop and restart the API against the same disposable SQLite file. The record should remain available without triggering another inference. Do not describe this as production restart evidence.
- **Approval boundary:** verify a saved edit increments the revision and clears approval; a stale revision cannot overwrite it. Only the current approved revision may be publicly exported. Public export content contains only the approved payload and no private brief ID, source, source references, or evidence. Historical deadline does not block that approved export.
- **Publication refresh:** `POST /api/briefs/:id/publication/refresh` with `{}` is read-only. It never publishes or compiles. A successful reader observation may update observed chain state; unavailable/error observations preserve the last confirmed publication and do not imply absence or expiry.
- **Provider boundary:** with provider/quota unset, compilation remains unavailable and dispatch attempts remain zero. Do not treat a local stub or config response as a real inference result.
- **Deployment and live integrations:** report Arkiv lifecycle, independent reader, actual 0G completion/verification, hosting, persistent-volume restart, and intended-user trial as not run unless supported by separate real evidence.

For 0G-specific setup and its one recorded live attempt, follow [0g-preflight.md](0g-preflight.md). The operator's single authorized attempt returned HTTP 502 / `PROVIDER_UNAVAILABLE`, with billing uncertain and no successful inference. Do not make another attempt without separate explicit authorization.
