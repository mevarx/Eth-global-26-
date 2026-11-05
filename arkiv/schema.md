# Arkiv listing schema: `tool-city.workshop.v1`

Implemented in `src/lib/arkiv/schema.ts` against `@arkiv-network/sdk` 1.0.1.

- **Schema name** (the SDK `arkiv.schema` tag): `tool-city.workshop.v1`. The SDK allows any non-empty `str` of up to 128 bytes. Queries through the schema see only entities written through it.
- **`app` value**: exactly `tool-city.workshop.v1`, independent of the schema name. Anyone can write this value, so it is never proof of provenance.

| Column | SDK type | Indexed | Notes |
|---|---|---|---|
| `app` | `str` | yes | List queries filter `eq("app", "tool-city.workshop.v1")`. |
| `title` | `str` | no | At most 60 characters and 128 UTF-8 bytes (the SDK `str` cap). Editable. |
| `description` | `bytes` | no | UTF-8 text, at most 500 characters and 2000 bytes. Editable. `str` caps at 128 bytes, too short for a description. |
| `active` | `bool` | no | Editable. `false` means withdrawn. Lists return active and inactive listings, so an index would add write cost without helping any query. |
| `jobType` | `str` | no | Fixed to `text.translate`. |
| `sourceLang` / `targetLang` | `str` | no | Fixed to `en` / `hi`. |
| `checkoutChainId` | `u64` | no | Written as `u64(BigInt(terms.chainId))`; parsed to a JS number (safe-integer checked). |
| `checkoutAddress` | `addr` | no | The SDK stores it checksummed; comparisons are normalized. |
| `serviceId` | `key` | no | `key` is a fixed 32-byte hex value, the same shape as the contract's `bytes32`. Reads return lowercase `0x` + 64 hex, which round-trips to `Hex`. `str` would work but loses length validation. |
| `termsHash` | `key` | no | Same as `serviceId`. |

Only `title`, `description` and `active` are editable. Price, service, checkout address and terms are not editable fields. Publish takes the checkout fields from `config.terms` and refuses to publish when `terms` is `null`.

## System fields
- **Owner:** `$owner`, the creating account, used as `ownerAddress`.
- **Expiry:** `$expiresAt`, a block number (bigint in the SDK), reported as the decimal string `expiresAtBlock`, or `null` if absent. No calendar date is derived.
- **Lifetime:** listings are created with `ExpirationTime.max()`, 7,884,000 blocks. `extendEntity` is not implemented in the MVP (see `friction.md`).

## `supported`
`true` only when every one of the following matches `config.terms` (addresses compared normalized, hashes compared as lowercase hex):
- the owner equals `merchantAddress`
- `checkoutAddress` matches
- `checkoutChainId` equals `chainId`
- `serviceId` matches
- `termsHash` matches

It is `false` when `terms` is `null`. It is a convenience flag only. The server must compare against its own configured terms.

## Rows that fail validation
A row is dropped from lists, and `getWorkshop` returns `null` for it, when any of these holds:
- a wrong `app` tag
- an unsupported job type or language
- a malformed hex, address or boolean
- an undecodable description
- an invalid owner

Rows from the same schema with columns missing or of the wrong type are skipped by the SDK itself.

## Errors (read)
- A missing or expired key makes `getWorkshop` return `null`.
- A malformed key throws `ArkivReadError` with code `INVALID_ENTITY_KEY`.
- A bad config namespace throws `INVALID_CONFIG`.
- Any network or query failure throws `ARKIV_UNAVAILABLE` (retryable, sanitized).
- A failed read is never returned as an empty list or `null`.
