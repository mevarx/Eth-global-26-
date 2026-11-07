> **Current status — 7 November 2026 IST:** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint integration contract — frontend pointer

**Superseded.** The frozen contract is the teammate's
[`docs/briefmint/integration-contract.md`](briefmint/integration-contract.md)
(v1.2, canonical `src/lib/shared/briefs.ts`). The v0.1 proposal that lived in
this file was replaced during the `briefmint/fullstack` merge.

## What changed in the merge (frontend side)

- Canonical DTOs win: `src/lib/shared/briefmint.ts` is now a thin adapter that
  re-exports `briefs.ts` and adds only the browser `OpportunityView` projection,
  `toOpportunityView`, filter types, and `0x` address aliases. Legacy translation
  DTOs (`domain.ts`/`api.ts`) are untouched.
- SHA-256 async hashing replaces the proposed keccak stub; limits now match the
  contract (title 120 chars, summary 1000, sections ≤12×500, payload ≤16 KiB,
  7-day deadline via `assertBriefDeadline`).
- API client follows the `briefApi` registry exactly: cursor-paginated list,
  PUT draft, intent-based prepare (`intentId` + operation), reconcile with
  `{intentId, transactionHash, entityKey}`, new `refresh`, and content-Blobs
  export (`?format=&audience=`).
- Arkiv reads/writes use the canonical `src/lib/arkiv/briefmint/` adapter
  (indexed `content` JSON, `title` bytes, `deadlineUnixSeconds`,
  `budgetUsdCents`); the independent reader passes an explicit access key and
  no backend session. Publication requires a prepared intent, wallet
  chain/account checks, and server reconciliation — a submitted tx alone is
  never treated as success.
- Auth still uses the existing session flow (purpose defaults to legacy); the
  `purpose=briefmint` challenge is a documented follow-up, not a silent change.
- `apps/web` stays deleted (city is Next-hosted); README was resolved to the
  canonical text with Vite-only instructions removed.
- Verified after the merge: typecheck, lint, 27 UI tests, 126 server tests,
  production build. Live inference, Arkiv writes, wallet journey, and hosting
  remain open gates per `docs/briefmint/backend-checkpoint.md`.
