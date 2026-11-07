> Historical archive: this file is the version from commit `79be23a`, preserved for context. It describes the earlier Tool City translation/workshop concept and may contain claims that do not apply to BriefMint or the current live demo. For current Arkiv criteria responses, see the [current schema](../../../arkiv/schema.md), [friction](../../../arkiv/friction.md), [reach](../../../arkiv/reach.md), [why Arkiv](../../../arkiv/why-arkiv.md), and [how Arkiv is used](../../../arkiv/how-you-use-arkiv.md).

---

# Arkiv friction log

Real issues hit while implementing against `@arkiv-network/sdk@1.0.1`
(sources read from the published tarball; no live Rabdi write performed yet —
live-network verification is pending a funded merchant wallet + access key).

## 1. Bundled `.d.ts` files are aliased/minified — read `src/` instead

`dist/index.d.ts` re-exports through hashed modules
(`../index-DaMIgZgJ.js`, `../changeOwnership-CV-auKHv.js`), so following a
name like `SelectQueryBuilder` through `dist` is painful. The package ships
`src/`, which is the readable reference.

Repro: open `node_modules/@arkiv-network/sdk/dist/index.d.ts`, search for
`class SelectQueryBuilder` — not there; the real builder docs live in
`src/query/queryBuilder.ts` / `src/query/builderBase.ts`.

## 2. `rabdi()` requires `{ accessKey }` — `""` means public endpoint

```ts
rabdi({ accessKey: "" }) // public, heavily rate-limited endpoint
```

Omitting the key throws `MissingAccessKeyError`; the docs note `""` opts into
the public endpoint. Free keys: https://hub.arkiv.network/access-keys.
`read.ts` uses `""` plus the RPC URL from config (`http(url)` overrides the
chain default; `http()` with no URL uses the chain default).

## 3. `str` values are capped at 128 UTF-8 bytes — constrains `description`

`str(value)` throws `InvalidValueError` past 128 **bytes**, not characters
(`src/schema/values.ts`, `MAX_STRING_BYTES`). A merchant blurb longer than a
tweet does not fit. `write.ts` pre-validates with `TextEncoder` and throws a
sanitized error before broadcasting; consider `bytes()` (128 KiB) for
long-form copy in a later revision.

Repro:

```ts
import { str } from "@arkiv-network/sdk/schema";
str("x".repeat(129)); // throws InvalidValueError
```

## 4. `getEntity` throws on missing — it never returns null

`arkiv_getEntity` returns `null` over RPC, but the SDK converts that to
`NoEntityFoundError` (`src/actions/public/getEntity.ts`). `read.ts`
normalizes: `NoEntityFoundError` → `null`; anything else → sanitized throw.
Additionally, `getEntity(key, schema)` throws `SchemaMismatchError` for a live
entity that is not a workshop — also normalized to `null` (the key holds no
workshop record) rather than a 500-style failure.

## 5. Inline the `select()` object or lose narrow row types

A selection stored in a variable widens `true` → `boolean` and rows degrade
to `PartialRow` (every field optional). `read.ts` calls
`client.select().from(WORKSHOP_SCHEMA)` (select-all → `FullRow`), so this did
not bite, but any future column-picking UI must pass the object literal
inline (or `as const`).

## 6. Named-schema tag already filters — our `app` column is belt-and-braces

`.from(schema)` adds an `arkiv.schema = '…'` tag filter automatically; a
separate `where(eq("app", …))` is redundant but harmless, and protects the
corner where someone writes the tag without the column. Verified in
`src/query/selection.ts` (`Projection.tag`).

## 7. `createEntity` has no default expiry; patches need `{ set: … }`

- `createEntity(schema, values, options)` requires `options.expiration`
  (an `Expiry`, only buildable via `ExpirationTime`). We use
  `ExpirationTime.fromDays(30)`.
- `patchEntity(schema, key, { set: { active: bool(false) } })` — the `set`
  wrapper is mandatory, and an empty patch throws `EmptyPatchError`;
  `updateWorkshop` pre-validates ≥ 1 field.
- `PatchEntityValues` is `readonly`-mapped: build the object literally,
  don't assign into it (`tsc` TS2540 otherwise — hit during implementation).

## 8. Bare values vs tagged values both work — we use tagged

`eq("app", "tool-city.workshop.v1")` (bare string) and
`{ title: str("…"), checkoutAddress: addr("0x…") }` (tagged) are both
accepted (`PredicateValue` / `ColumnInput`). Writes use tagged constructors
so type mismatches fail at `tsc`, not at broadcast.

## Not yet exercised (blockers, not code gaps)

No live query/write against Rabdi testnet from this worktree yet: needs a
merchant wallet with tGLM for gas and (for comfort) an access key. The code
paths are typechecked (`tsc --noEmit` clean for `src/lib/arkiv/*`) but
unproven against a node — see handoff for the exact commands to run.
