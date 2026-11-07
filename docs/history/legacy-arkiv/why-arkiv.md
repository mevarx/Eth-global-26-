> Historical archive: this file is the version from commit `79be23a`, preserved for context. It describes the earlier Tool City translation/workshop concept and may contain claims that do not apply to BriefMint or the current live demo. For current Arkiv criteria responses, see the [current schema](../../../arkiv/schema.md), [friction](../../../arkiv/friction.md), [reach](../../../arkiv/reach.md), [why Arkiv](../../../arkiv/why-arkiv.md), and [how Arkiv is used](../../../arkiv/how-you-use-arkiv.md).

---

# Why Arkiv (and not just Postgres)

## What Arkiv gives us here

1. **Provider-owned public discovery.** The workshop listing is signed by the
   merchant's own wallet and readable by anyone (buyer UI, backend validator,
   block explorer) without asking our server. `$owner` is provenance the
   server does not have to vouch for — before creating a job, the backend
   independently checks the listing, owner, and configured service through
   the same server-neutral `read.ts` the frontend uses.
2. **Withdrawal that is an explicit, auditable act.** Delisting is an
   owner-signed `active=false` patch, not a row flip hidden in our database.
   Buyers can see the catalogue state and its history; previously accepted
   jobs remain payable/recoverable because the chain contract, not the
   listing, holds the entitlement.
3. **Built-in expiry.** Entities carry `$expiresAt`; a stale merchant who
   disappears does not leave a listing that looks live forever. Reads report
   expiry as a block and the UI shows fresh/stale from the last successful
   refresh — a failed refresh never proves withdrawal.

## What a Postgres table would do better

Honest trade-offs: a local table would give us longer descriptions (no
128-byte `str` cap), sortable creation timestamps, full-text search, and no
gas or RPC dependency for reads. Listing reads would be faster and work
offline in dev.

## What we deliberately keep OFF Arkiv

- **Buyer drafts, translations, and edits.** Private content stays
  server-side (0G via backend); merchant endpoints return settlements only,
  never raw buyer text. Arkiv entities are public — putting drafts there
  would contradict the "private translation" premise.
- **Payment state.** Entitlement lives in the Whitechain checkout contract
  and backend verification, not in a mutable listing field.
- **Financial terms as editable fields.** Price/service/terms are deployment
  configuration; the listing only *references* them (`serviceId`,
  `termsHash`) so the reader can check support. There is no editable price
  to drift from the contract.

In short: Arkiv holds the small public fact ("this merchant offers this
fixed service, currently active"), Postgres holds the private workflow, and
the chain holds the money. Each store does what it is good at.
