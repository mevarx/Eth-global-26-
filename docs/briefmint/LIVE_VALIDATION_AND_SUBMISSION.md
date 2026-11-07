> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint live validation and submission gate

This is the shortest ordered operator checklist. It is a procedure, not evidence of a completed app journey. The operator reports one standalone 0G probe returned HTTP 200 in 9,133 ms with valid structured output, 668 reported tokens, request ID `077bd220-2efa-4bbd-bb1f-3b3964ff0038`, and model `0gm-1.0-35b-a3b`; Router verification and routing tier were null and the probe reported `completed_evidence_incomplete`. Debit/credit source and independent response verification remain unknown. No BriefMint UI generation, Arkiv record/lifecycle, production host, or persistent-volume restart is established. Do not make another billable request without separate explicit authorization or claim production readiness/end-to-end completion from local builds.

## 1. Safe local checks

Use Node 24, from the repository root. First run the isolated 0G catalog preflight (public GET only):

```sh
node --version
node --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --preflight
```

Run local checks without provider, quota or Arkiv credentials. Follow [local-integration.md](local-integration.md) for the disposable database, same-origin Vite proxy, and private persistence checklist. The minimal start is:

```sh
export APP_ORIGIN="http://127.0.0.1:5173"
export AUTH_ALLOWED_ORIGINS="http://127.0.0.1:5173"
umask 077
export BRIEFMINT_LOCAL_DIR="$(mktemp -d /tmp/briefmint-local.XXXXXX)"
export DATABASE_PATH="$BRIEFMINT_LOCAL_DIR/state.sqlite"
export SESSION_SECRET="$(openssl rand -hex 32)"
export ZERO_G_API_KEY=""
export ZERO_G_MODEL_ID=""
export BRIEFMINT_ALLOWED_WALLETS=""
export ARKIV_ACCESS_KEY=""
npm run dev -- --hostname 127.0.0.1 --port 4100
```

In a second terminal:

```sh
VITE_ARKIV_ACCESS_KEY= npm run reference:dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`; use synthetic harmless notes. Connecting/signing a wallet remains a human action requiring explicit consent. With no provider configured, verify private intake, ownership and restart only; compilation/edit/approval must remain unavailable until a genuine result exists. The offline vertical-slice test covers the remaining lifecycle with labelled fixtures: `npx vitest run tests/server/brief-vertical-slice.test.ts`. The no-billing process/proxy smoke is `npm run smoke:local` after `npm run build`; it uses disposable identity/database and explicitly empty provider/Arkiv/quota settings. It checks loopback Vite Cookie/Set-Cookie/Origin forwarding and actual standalone restart. It does not establish browser extension behavior, TLS or production persistence.

Required configuration names (values supplied only in private operator files):

| Component | Names / constraint |
|---|---|
| Node API/session | `APP_ORIGIN`, `AUTH_ALLOWED_ORIGINS` (one canonical origin), `SESSION_SECRET` (random, at least 32 characters, stable across restart), `DATABASE_PATH` (persistent absolute path in production) |
| 0G probe/application | `ZERO_G_API_KEY`, `ZERO_G_BASE_URL=https://router-api.0g.ai/v1`, `ZERO_G_MODEL_ID=0gm-1.0-35b-a3b`, `INFERENCE_TIMEOUT_MS` (1000–180000) |
| Application spend gate | `BRIEFMINT_ALLOWED_WALLETS`, `BRIEFMINT_COMPILATIONS_PER_WALLET`, `BRIEFMINT_GLOBAL_DISPATCH_LIMIT`, `BRIEFMINT_QUOTA_WINDOW_ID`, `BRIEFMINT_QUOTA_WINDOW_END` (future UTC). Operator chooses finite allowances after measuring cost; no default entitlement. |
| Arkiv server / independent reader | `ARKIV_ACCESS_KEY`; standalone reader can instead select its public endpoint explicitly |
| Browser Arkiv | `VITE_ARKIV_ACCESS_KEY` is a deliberately public endpoint-access value, never a wallet/inference secret; Vite loads it from `apps/web/.env.local` or the build environment, not automatically from root `.env.local` |
| Process / legacy exclusion | `HOSTNAME=127.0.0.1`, `PORT=4100`, `NEXT_PUBLIC_ENABLE_DEV_FIXTURES=false`. No deployer/merchant/checkout/Whitechain key or funding is needed for BriefMint. |

## 2. 0G inference: separate explicit consent required

No inference command is authorized by this checklist. A human must separately approve one potentially billable request after reviewing current 0G account usage and the risk that a failure/timeout can still debit. Keep an ignored `.env.0g-smoke` containing the required values; never expose its contents. Check only its existence and ignore status, then restrict permissions:

```sh
test -f .env.0g-smoke
git check-ignore -- .env.0g-smoke
chmod 600 .env.0g-smoke
```

Only after that separate explicit approval, the one fixed-fixture request is:

```sh
env -u ZERO_G_API_KEY -u ZERO_G_MODEL_ID -u ZERO_G_BASE_URL -u INFERENCE_TIMEOUT_MS node --env-file=.env.0g-smoke --conditions=react-server --import tsx scripts/briefmint-live-smoke.ts --authorize-paid-inference
```

It makes one inference POST, no retries. Never repeat it to repair a failure. Save sanitized status/evidence only. A Router-reported billing-neuron/token count is provider-reported; it does not prove promotional credit use or actual debit. Compare the correct account/pool's before-and-after usage and timestamps to establish debit; if records do not resolve it, report debit unknown. The observed probe reports `independentResponseVerification: unavailable`; Router TEE verification is not independent signature/content verification. See [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md).

This isolated probe does not create an application brief. After it succeeds, a later app compilation is a separate potentially billable action: explicitly approve/configure its finite quota and runtime credential, then authorize one deliberate Studio run. Do not claim that a successful isolated probe also passed the application's complete journey.

## 3. Browser wallet and Arkiv: later human operator only

Do not begin until Agent B's frontend requirements are complete and reviewed: epoch guards for mutation completions, fresh server prepare before signing, one-shot uncertainty arming, durable intent/transaction identifiers, and honest state/error controls. A wallet operator must log in explicitly and separately approve each publication signature/fee. Login proves address control; it does not approve a publication. Check current readiness, Rabdi chain 7794095, connected account/intent owner, exact approved public bytes/hash, and recipient/operation in the wallet prompt. Use only a synthetic brief with a genuinely ready result already available; this checklist does not authorize paid inference or automatic compute.

Follow the precise human-only, synthetic-record sequence in [ARKIV_LIVE_PROBE.md](ARKIV_LIVE_PROBE.md): create and independently read back, query/filter with independent readback, then separately prepare/approve/reconcile update and close. Use a distinct short-lived synthetic record for native expiry testing, with a separately approved future business deadline around 90 seconds only when an already-ready result and all approvals are immediately available. Verify actual expiry block and later observed current block; a missing entity by itself is not expiry evidence. Reconcile possible broadcasts before any further action. Run `scripts/briefmint-arkiv-reader.ts` with the API stopped to verify independent read/filter behavior. No such live record is currently evidenced.

## 4. Production is a separate unverified gate

Do not select or purchase a host from this document. No host is selected and deployment is not authorized here. Production target is one public HTTPS origin, `/api/*` reverse-proxied unchanged to one persistent Node 24 Next process on private port 4100, and Vite build served for non-API routes with SPA fallback. SQLite must live on persistent storage; preserve external Origin/Cookie/Set-Cookie, use `APP_ORIGIN` as the external origin, and allow only that origin. Proxy timeout must exceed inference timeout plus persistence margin. Require evidence of TLS, proxy behavior, volume persistence, one-process topology, restart recovery, and API errors not receiving `index.html`.

Root `npm start` runs `.next/standalone/server.js` and does not explicitly select your operator environment file. After the operator has independently provisioned the host, secret, persistent mount, and private environment file, use explicit Node env-file loading, for example:

```sh
cd "/path/to/tool-city"
HOSTNAME=127.0.0.1 PORT=4100 node --env-file=/private/path/to/production.env .next/standalone/server.js
```

Replace placeholders only on the provisioned host; do not put secrets in command arguments. Verify the actual environment loading and standalone asset/build layout for the selected host before relying on this command. No deployment, host, credentials, disk, TLS, or restart proof is established.

Prepare artifacts with `npm run build` and `npm run reference:build`. Serve `apps/web/dist` for non-API routes; preserve the standalone `.next/static`, `public` and `src/lib/server/migrations` copied by the build script. The generated launcher changes its working directory to `.next/standalone`; retain that directory's complete layout rather than copying `server.js` alone. Use an absolute `DATABASE_PATH` on the persistent mount. Run one Node process (no multiworker/cluster/serverless replicas sharing SQLite). Proxy `/api/*` to private port 4100 with no caching or SPA fallback; preserve the external `Origin`, `Cookie` and `Set-Cookie`, and allow a timeout of at least 210 seconds for a 180-second inference. Browser cookies must be Secure, HttpOnly, host-only, SameSite=Lax over the real HTTPS origin. API errors must stay JSON.

Use a persistent directory with operator-only access, for example create the chosen mount with `umask 077` and restrict access to the Node service account. Startup applies additive migrations transactionally; restart with the same database and session secret. The demo has no application-level encryption, deletion or backup-erasure guarantee. For a simple consistent backup, stop the one app process and copy its database directory and any SQLite journal companions to private storage; test restore before relying on it. Do not copy only the main SQLite file while WAL writes are active. Host TLS, persistent-volume restart and restored-session behavior still require actual operator evidence.

Capture only sanitized public evidence: actual request/provider/model/verification status, operation, entity key, transaction hash, owner, canonical public hash/revision, receipt block/status, native expiry/observed blocks, and checked exact explorer links. Keep private notes, cookies, signatures and credentials out of screenshots, video, logs and submissions. Record intended-user feedback without inventing adoption or reach. Before submitting, prepare a video under three minutes and fill in actual repo/demo URLs, 0G evidence and Arkiv schema/friction/reach/why/how notes; use explicit `not yet demonstrated` where evidence is absent.

## 5. Submission facts to verify

The official ETHGlobal Mumbai page currently lists the event November 5–7, 2026. The exact submission deadline/time is not established by this checkout; verify it on the [official event details page](https://ethglobal.com/events/mumbai/info/details) and in the team's submission dashboard before planning around a deadline. Do not repeat the old 09:00 IST estimate as verified.

Before submission, record the exact Git commit, real public demo/repository URLs, actual live integration evidence, and any failures. State plainly that there is no funded bounty or verified deployment unless new evidence supports it. Identify AI assistance and disclose the known city source snapshot (`cb0db61d3515ee0621547f7832e9826f4be08f2e`) accurately; authorship and license for every original source/art asset have not been established, so do not claim all-original work. Complete an actual third-party asset/library license audit before making a licensing claim. Never infer an external asset license from its appearance or presence in the repo.

`config/deployment.json` currently names the Rabdi Arkiv explorer at `https://rabdi.explorer.arkiv.network` and Whitechain testnet explorer at `https://explorer.testnet.whitechain.io`. These are configured network links, not evidence that a BriefMint entity or checkout is deployed. Only include an entity/transaction link after checking it resolves to the exact independently verified record.
