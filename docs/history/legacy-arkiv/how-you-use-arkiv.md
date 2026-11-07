> Historical archive: this file is the version from commit `79be23a`, preserved for context. It describes the earlier Tool City translation/workshop concept and may contain claims that do not apply to BriefMint or the current live demo. For current Arkiv criteria responses, see the [current schema](../../../arkiv/schema.md), [friction](../../../arkiv/friction.md), [reach](../../../arkiv/reach.md), [why Arkiv](../../../arkiv/why-arkiv.md), and [how Arkiv is used](../../../arkiv/how-you-use-arkiv.md).

---

# How Tool City uses Arkiv

## Filters → discovery the UI can trust (but verifies)

- `listWorkshops` queries `.from(WORKSHOP_SCHEMA).where(eq("app",
  "tool-city.workshop.v1"))` — one merchant's catalogue in practice, but the
  code assumes anyone may write under the tag.
- Every row is reconciled against configured terms before display: owner vs
  merchant address, chain id / checkout address / service id / terms hash
  (addresses case-insensitive). The result is the `supported` flag — only a
  supported, `active` workshop can start a purchase.
- **User-visible effect:** the Registry Hall panel shows owner, entity key,
  last successful refresh, and fresh/stale state. Loading, failed query, and
  empty catalogue are three distinct screens; a failed refresh shows "stale",
  never "withdrawn".

## Edits → owner-signed presentation changes only

- `updateWorkshop` patches `title` / `description` / `active` — and nothing
  else. Checkout address, service, language pair, and terms references are
  immutable after creation; there is no price editing because there is no
  editable price.
- `withdrawWorkshop` = `updateWorkshop(…, { active: false })`.
- **User-visible effect:** after any write the UI refreshes the query on
  focus/mount; withdrawal removes the workshop from new-job discovery while
  existing paid jobs stay openable and reviewable. A wrong-wallet update
  fails before broadcast with a plain error — no fake explorer link.

## Expiry → listings die on their own

- Creates use `ExpirationTime.fromDays(30)`; the receipt's `expiresAt` block
  is shown after publication, and reads surface `$expiresAt` per listing.
- **User-visible effect:** an expired listing reads as absent (SDK:
  `NoEntityFoundError` → `null`), which the UI renders as "empty catalogue",
  not as an error. Renewal path in this MVP is re-publication (no
  `extendEntity` wired yet).

## End-to-end shape

Merchant connects wallet on Rabdi → `createWorkshop` (30-day listing) →
buyer discovers via `listWorkshops` → server re-validates the same record via
`read.ts` before job creation → payment on Whitechain → translation →
review. Arkiv never sees private text or payment state; it stays the public,
owner-signed front door.
