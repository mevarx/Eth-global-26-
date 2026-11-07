> **Historical schema draft, superseded.** The integrated adapter uses [the current schema](schema.md) and [live evidence](../docs/evidence/LIVE_DEMO.md). Fields, file paths, default lifetime and “no write yet” statements below describe an earlier implementation, not current behavior.

# Arkiv opportunity schema — BriefMint public records

Entity kind: **public work opportunity** (wallet-owned discovery for writing/design briefs).

Namespace: `tool-city.opportunity.v1` — distinct from the legacy
`tool-city.workshop.v1` translation namespace. The legacy schema in
`src/lib/arkiv/schema.ts` is preserved untouched.

## Schema registration

`src/lib/arkiv/opportunity-schema.ts`:

```ts
export const OPPORTUNITY_SCHEMA = defineSchema("tool-city.opportunity.v1", {
  app: str().indexed(),
  category: str().indexed(),     // "writing" | "design"
  language: str().indexed(),     // always "en"
  status: str().indexed(),       // "open" | "closed"
  budgetPresent: bool().indexed(),
  budgetCents: u64().indexed(),  // 0 when absent
  deadline: str().indexed(),     // ISO business timestamp
  title: str(),                  // ≤ 128 UTF-8 bytes (chain str limit)
  summary: bytes(),              // longer UTF-8 text
  details: bytes(),              // JSON sections, ≤ 8 KiB
  contact: str(),                // https URL or empty
  revision: u64().indexed(),     // public revision
});
```

12 attributes + the schema tag = 13 (limit is 32).

## Field notes

`str` columns hold at most 128 UTF-8 bytes (`MAX_STRING_BYTES`); longer public
text uses `bytes` columns (up to 128 KiB per value). The public projection is
the exact allowlist in `src/lib/shared/briefmint.ts` — title, summary,
category, language, section texts, optional budget/contact/deadline, revision.
Private notes, source IDs, database IDs, sessions, and credentials are never
stored on Arkiv.

Owner and expiry are **system fields**: `$owner` (entity owner = publisher)
and `$expiresAt` (block height). Reads map them to `ownerAddress` /
`expiresAtBlock` (decimal string; `null` when absent).

## Queries

Indexed discovery (`src/lib/arkiv/opportunities-read.ts`):

```ts
await client.select().from(OPPORTUNITY_SCHEMA)
  .where(and(eq("app", NAMESPACE), eq("category", "writing"), eq("status", "open")))
  .limit(100).fetch();
```

Single key: `client.getEntity(key, OPPORTUNITY_SCHEMA)` (null when no live
record; never an invented record). Text search (`query`) filters client-side
after the indexed fetch. The independent reader
(`src/lib/arkiv/opportunities-independent.ts` + `OpportunityReader` UI +
`scripts/probe-briefmint-arkiv.ts`) takes an explicit RPC URL and never
imports the backend, so it works while the BriefMint API is stopped.

## Owner / writers

- Writer (project owner) address: _no write performed yet — publication
  requires the connected project-owner wallet signature in the browser.
  The probe below is read-only; no private key was requested or handled._
- Only the entity owner can patch/close it; a wrong-wallet update fails at
  broadcast with a sanitized error (no explorer link is fabricated for a
  transaction that never existed).

## Lifecycle evidence (genuine probe, 6 Nov 2026)

`npx tsx scripts/probe-briefmint-arkiv.ts` against the public Rabdi RPC:

- `legacy workshop namespace (tool-city.workshop.v1): query ok, first page entities=0`
- `briefmint opportunity namespace (tool-city.opportunity.v1): query ok, first page entities=0`
- `probe: all reads ok (no writes attempted)`

Both namespaces are queryable; nothing is published yet. Creates default to
30-day expiry; a clearly labelled short-lived demo (e.g. 1 day) exercises
native expiry. Closed records stay readable until expiry but leave the open view.
