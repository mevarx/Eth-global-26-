# Submission documentation checkpoint: 7 November 2026 IST

Base: `79be23a` on `codex/briefmint-integration-fixes`. This change updates presentation and setup examples, not runtime business logic. The final documentation commit follows this base; use Git history for its exact identity.

## Completed checks

| Command / check | Result |
|---|---|
| `npm test` | 176 server tests across 18 files; 27 UI tests; all passed. Synthetic adapters, not new live sponsor evidence. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed, using the repository's configured scope. |
| `npm run build` | Passed: legacy checkout example, Next.js production application and standalone asset preparation. |
| `npm run smoke:local` | Passed with loopback networking permitted: private CRUD/export, auth, approval gate, restart/session recovery and legacy proxy/checkout denial; zero inference dispatches, temporary synthetic DB. |
| Local Markdown links | 164 relative file/directory targets across 47 Markdown files resolved; zero missing targets and zero unbalanced code fences. |
| Mermaid diagrams | All 4 diagrams parsed with Mermaid 11.12.0 and JSDOM in a temporary directory outside the repo. No project dependency/lockfile change. Syntax checked; no screenshot-based layout audit. |
| Secret / staged review | 36 staged files reviewed; credential/private-key/Bearer-literal scan found no matches. Only documentation and placeholder `.env.example` included; no ignored environment files, SQLite data or `next-env.d.ts`. |

The first local HTTP smoke attempt could not bind `127.0.0.1:3187` within the sandbox. It was rerun with local networking permitted; this is an environment permission issue, not an inference/provider result. No 0G inference, wallet signature, transaction, deployment or modification to the existing demo record was performed.

Legacy Solidity tests were not rerun: no contract or deployment changes are included. Their historical pass counts are not new evidence from this checkpoint. No separate Vite city check exists in this migrated checkout; the current city is built/typechecked by Next. The build still validates the separate legacy Vite checkout example.

## Preservation and publication

- Existing `next-env.d.ts` development-path edits were backed up and restored around production build; they remain unstaged.
- Private SQLite, ignored environment files and the original R3 pending intent are unchanged.
- Previous Arkiv criteria notes are preserved under [historical archive](../history/legacy-arkiv/). Current schema/usage replaces their obsolete translation claims.
- Existing engineering notes have a current-status banner; dated evidence remains intact.
- No merge/default-branch update is authorized. Publish only the integration feature branch, without force.

## Observed live evidence and remaining gates

[Live evidence](../evidence/LIVE_DEMO.md) records the earlier operator-demonstrated app journey and this checkpoint's successful direct public entity read. The subsequent anonymous indexed query was HTTP 429, not empty and not successful. Explorer route availability is separate from receipt proof.

Independent TEE verification, original R3 resolution, live update/close/expiry, production HTTPS/persistent-volume validation, video, confirmed team contacts and asset/license clearance remain outstanding. The [submission copy](ETHGLOBAL_SUBMISSION.md) leaves explicit placeholders. Eligibility and a public deployment are not asserted.
