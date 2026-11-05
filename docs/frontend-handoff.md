# Frontend / Arkiv handoff (Agent B)

Status: the Arkiv adapter is code-complete against SDK 1.0.1. Nothing has been signed, so the on-chain write behavior is **pending manual verification**. No root app exists in this checkout, so root lint, typecheck and build have **not been run**.
No TEMPORARY stand-ins are in use: the adapter needs only domain.ts types (api.ts, validation.ts, deployment.ts and the ABI are not used). Its own error classes (ArkivReadError, ArkivWriteError, WorkshopInputError) live in src/lib/arkiv/.

```text
Commit / common contract version:
  Branch codex/city-frontend, merged with origin/codex/initial-readme (the only remote branch and the repo default).
  Contract v1.0 section 5 types. src/lib/shared/domain.ts is a verbatim copy of the contract types, committed alone as a
  bootstrap placeholder; the integrator's file wins on merge. The reference docs are at the repo ROOT
  (common_project_structure.md, varx_frontend_arkiv.md), not under docs/.

Files changed:
  src/lib/shared/domain.ts (verbatim placeholder, separate commit)
  src/lib/arkiv/schema.ts, read.ts, write.ts, arkiv.test.ts
  arkiv/schema.md, arkiv/friction.md, arkiv/list-workshops.ts
  docs/frontend-handoff.md, .gitignore (ignores the two reference docs)

Commands run and actual results:
  Run in a scratch dir outside the repo, against the committed domain.ts (strict TS + noUncheckedIndexedAccess, bundler resolution):
    tsc --noEmit                              -> 0 errors
    tsx --test src/lib/arkiv/arkiv.test.ts    -> 13 pass, 0 fail (synthetic fixtures, no network)
    list-workshops.ts against the public Rabdi RPC -> {"count": 0}  (read-only; the query ran, catalogue empty)
    list-workshops.ts against an unreachable URL   -> exit 1, ARKIV_UNAVAILABLE
  In the repo: npm ci / typecheck / lint / build -> NOT RUN (no package.json or lockfile; bootstrap absent)

Real Arkiv write/query/update/withdrawal evidence:
  Query:       live read-only list on Rabdi ran and returned 0 listings. Row parsing is tested on synthetic rows only.
  Publish:     pending manual verification
  Update:      pending manual verification
  Withdrawal:  pending manual verification
  Wrong-wallet: unit-tested to fail before any wallet request (mock provider); live behavior pending manual verification
  Entity key / tx hash / explorer link: none recorded. None will be invented.

ABI/deployment manifest commit consumed:
  None. The adapter reads only PublicConfig (arkiv.*, terms, appNamespace).

Live API paths vs development fixtures:
  No API or fixtures used. Tests and the script use synthetic data. The script reads Rabdi directly.

Wallet/network/browser behavior verified:
  Nothing verified in a browser. Mock-provider tests cover signature rejection (EIP-1193 4001) -> USER_REJECTED.
  Chain switch/add flow: pending manual verification.

Known failures / limitations:
  - No live write, update or withdrawal has run. Real-wallet rejection, the chain switch/add flow, and the on-chain NotOwner revert mapping are unverified.
  - permissionlessExtension (an SDK creation flag) is unverified. We set no creation flags.
  - Public RPC rate limits are unverified. There is no retry or backoff beyond viem's retryCount: 1.
  - Listings expire about 182 days after creation (7,884,000 blocks). There is no extend in the MVP (arkiv/friction.md).
  - A list read is capped at 1,000 listings (10 pages of 100). Past that it throws ARKIV_UNAVAILABLE rather than truncating.
  - `app` is a spoofable tag; `supported` is only a convenience flag.
  - Native-currency name/symbol in the chain definition is hard-coded (cosmetic).
  - Rows that are not an en->hi text.translate workshop (unsupported job type or language) are dropped, not marked unsupported, because WorkshopView cannot represent them.

What Agent A must merge or do next:
  1. Push the bootstrap: package.json, a single lockfile, shared/*, config, root layout.
  2. Dependencies (versions I tested): @arkiv-network/sdk 1.0.1, viem ^2.57.16 (tested 2.57.16). The SDK peers viem ^2.0.0 and typescript >=5.
     Dev: tsx, to run arkiv.test.ts (node:test API) and arkiv/list-workshops.ts; or point your own runner at them.
     wagmi (tested 3.7.11 metadata) peers viem 2.x, so it reuses the single root viem as long as the lockfile keeps one copy. Check `npm ls viem` for a single entry.
  3. read.ts is safe on the server: import listWorkshops/getWorkshop from src/lib/arkiv/read only. They need config.arkiv and nothing else.
     Do not use `rabdi()` or an access key. If the public RPC rate-limits you, put a keyed URL in arkiv.rpcUrl on your side.
  4. Confirm that WorkshopView.supported computed here is advisory. Your server must re-compare against its own configured terms.
```

## Read-only: list current workshops on Rabdi
```bash
ARKIV_RPC_URL=<Rabdi RPC from official Arkiv docs> npx tsx arkiv/list-workshops.ts
# optional: ARKIV_CHAIN_ID (default 7794095), ARKIV_EXPLORER_URL,
#           PUBLIC_CONFIG_FILE=path/to/PublicConfig.json  (to populate `supported` from real terms)
```
This needs no wallet, keys or funds. Without terms every listing reports `supported: false`. The Rabdi public RPC (observed from the SDK docs, not hardcoded in code): `https://rpc.rabdi.db-chain.testnet.arkiv.network`.

## Manual browser checklist (all results: pending manual verification)
Prerequisite: the UI must be wired to `write.ts` (page work is not part of this task). Record the actual values you observe. Do not copy any from this document.

1. **Fund the wallet.** Get tGLM from the Arkiv faucet (`https://hub.arkiv.network/faucet`). The wallet needs it for gas on Rabdi.
2. **Network.** Connect on the wrong network first. Expected: the wallet prompts to switch or add Rabdi (chain 7794095). Rejecting it gives a recoverable error and no transaction.
3. **Publish.** Publish with a title and description, with `config.terms` set. Expected: a wallet signature prompt, then a real entity key and tx hash. Record them. Then run the list script and check that the listing appears with your address as `ownerAddress`, `expiresAtBlock` set, and `supported: true`.
4. **Reject.** Reject the signature in the wallet. Expected: a recoverable "rejected" message, no tx hash, no explorer link.
5. **Update.** Change the description only. Expected: a signature prompt and a tx hash. Re-run the list script: the new description shows, and owner and checkout fields are unchanged.
6. **Wrong wallet.** Switch to a different account and attempt update or withdraw. Expected: a "does not own this listing" error shown before any signature prompt, no tx hash, no explorer link. Also confirm in the wallet that no request appeared.
7. **Withdraw.** As the owner, withdraw. Expected: a signature prompt, a tx hash, and the list shows `active: false` (the listing is still returned).
8. **Failed read.** Block the RPC (offline or wrong URL). Expected: a distinct "failed" state in the UI, not an empty catalogue and not "withdrawn".
