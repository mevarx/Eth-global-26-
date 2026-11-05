# Arkiv friction log

Observed with `@arkiv-network/sdk` 1.0.1 and viem 2.57.16. Entries marked *unverified* were read from types or source only.

1. **Old examples do not apply.** Many examples use `payload`, `contentType` and `expiresIn`. 1.0.x uses `defineSchema` with typed columns and `createEntity(schema, values, { expiration })`.
2. **`str` is capped at 128 UTF-8 bytes.** A description does not fit, so `description` is a non-indexed `bytes` column holding UTF-8. It is selectable but not filterable.
3. **Maximum lifetime is about 182 days.** `ExpirationTime.max()` is 7,884,000 blocks past the landing block, assuming about 2 s per block. Listings expire after that. This MVP does not build `extendEntity`, so an expired listing must be republished. The UI should show the expiry block, not a guessed date.
4. **The `rabdi()` preset needs an access key.** An empty key warns and uses the public RPC, which is rate-limited. We build the chain from `PublicConfig.arkiv` instead and carry no key in code.
5. **`addr()` rejects mixed-case addresses with a bad checksum.** It throws `InvalidValueError`. We normalize with viem `getAddress` first. Our fixture addresses failed this until they were checksummed.
6. **Every write failure is wrapped in `EntityMutationError`.** That includes wallet rejection (EIP-1193 code 4001) and the on-chain `NotOwner` revert. The original error is only in `.cause`, so we walk the cause chain.
7. **`NotOwner` arrives as a revert.** We pre-check `$owner` before signing and also map the revert as a fallback. The fallback is matched by `errorName` or message text and is unit-tested only with synthetic errors. *unverified live*
8. **The wallet client exposes `addChain` but not `getChainId` or `switchChain`.** We call `viem/actions` directly.
9. **`PublicConfig.arkiv` has no currency metadata.** The `defineChain` native-currency name and symbol are cosmetic and hard-coded as `tGLM`, which wallets show when adding the chain.
10. **A schema-mismatched row is skipped, not thrown, in `select().from(schema)`.** The page count is `entities.length + skipped`, which paging uses.
11. **A live read on Rabdi works but is empty.** The list query ran against the public RPC and returned 0 listings, so parsing of real rows has only been tested on synthetic rows.
