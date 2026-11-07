> Historical archive: this file is the version from commit `79be23a`, preserved for context. It describes the earlier Tool City translation/workshop concept and may contain claims that do not apply to BriefMint or the current live demo. For current Arkiv criteria responses, see the [current schema](../../../arkiv/schema.md), [friction](../../../arkiv/friction.md), [reach](../../../arkiv/reach.md), [why Arkiv](../../../arkiv/why-arkiv.md), and [how Arkiv is used](../../../arkiv/how-you-use-arkiv.md).

---

# Arkiv schema — Tool City workshops

Entity kind: **workshop listing** (provider-owned public discovery for one
English → Hindi translation service).

## Schema registration

`src/lib/arkiv/schema.ts`:

```ts
export const WORKSHOP_SCHEMA = defineSchema("tool-city.workshop.v1", {
  app: str().indexed(),
  title: str(),
  description: str(),
  active: bool().indexed(),
  jobType: str().indexed(),        // always "text.translate"
  sourceLang: str().indexed(),     // always "en"
  targetLang: str().indexed(),     // always "hi"
  checkoutChainId: u64().indexed(),// Whitechain chain id (1874)
  checkoutAddress: addr().indexed(),
  serviceId: key().indexed(),
  termsHash: key().indexed(),
});
```

11 columns + the schema tag = 12 attributes (limit is 32).

## Field notes

| Column | Type | Indexed | Notes |
|---|---|---|---|
| `app` | str | yes | Always `tool-city.workshop.v1`; defense-in-depth next to the schema tag |
| `title` | str | no | Merchant-set display title, ≤ 128 UTF-8 bytes |
| `description` | str | no | Merchant-set blurb, ≤ 128 UTF-8 bytes (chain limit, not our choice) |
| `active` | bool | yes | Owner-signed `false` = withdrawn |
| `jobType` | str | yes | Fixed `text.translate`; anything else is skipped by the reader |
| `sourceLang` / `targetLang` | str | yes | Fixed `en` / `hi` |
| `checkoutChainId` | u64 | yes | Must equal configured Whitechain chain id |
| `checkoutAddress` | addr | yes | Must equal configured checkout contract |
| `serviceId` / `termsHash` | key | yes | Must equal configured service id / terms hash |

Owner and expiry are **system fields**, not columns: `$owner` (entity owner =
merchant) and `$expiresAt` (block height). The reader maps them to
`ownerAddress` / `expiresAtBlock` (decimal string; `null` when absent — we
never guess a calendar date from a block).

## Queries

List (from `src/lib/arkiv/read.ts`):

```ts
await client
  .select()
  .from(WORKSHOP_SCHEMA)
  .where(eq("app", "tool-city.workshop.v1"))
  .limit(100)
  .fetch();
```

`.from()` already restricts to entities tagged `arkiv.schema =
'tool-city.workshop.v1'`; the `app` filter is defense-in-depth because anyone
may reuse the tag. Single-key read: `client.getEntity(key, WORKSHOP_SCHEMA)`
(null when no live record; never an invented record).

Runnable raw-query equivalent (same filter, for the `arkiv_query` escape
hatch / RPC inspection):

```text
arkiv.schema = str('tool-city.workshop.v1') AND app = str('tool-city.workshop.v1')
```

e.g. `client.query("arkiv.schema = str('tool-city.workshop.v1')", { select: { $key: true, title: true } })`.

## Owner / writers

- Writer (merchant) address: _placeholder — no mainnet/testnet write performed
  yet; filled in after the first Rabdi publication. Expected: the merchant's
  connected wallet address, recorded from the `createWorkshop` receipt._
- Only the entity owner can patch/withdraw it; a wrong-wallet update fails at
  broadcast and we surface a sanitized error (no explorer link is fabricated
  for a transaction that never existed).

## Expiry

Creates use `ExpirationTime.fromDays(30)`. The receipt's `expiresAt` block is
returned to the caller; reads report `$expiresAt` as a block string. No
`extendEntity` in this MVP — re-publication is the renewal path.
