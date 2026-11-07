> Historical archive: this file is the version from commit `79be23a`, preserved for context. It describes the earlier Tool City translation/workshop concept and may contain claims that do not apply to BriefMint or the current live demo. For current Arkiv criteria responses, see the [current schema](../../../arkiv/schema.md), [friction](../../../arkiv/friction.md), [reach](../../../arkiv/reach.md), [why Arkiv](../../../arkiv/why-arkiv.md), and [how Arkiv is used](../../../arkiv/how-you-use-arkiv.md).

---

# Reach — who would use this

No invented users, no staged testimonials. Status at writing: the Arkiv
read/write modules are implemented and typechecked, but no live listing has
been published and no buyer flow has run against them, so **no usage evidence
exists yet**.

## Intended users (from the project scope, not from observation)

1. **The merchant** — one workshop owner who publishes the `en → hi`
   translation service on Arkiv, updates its title/description, and withdraws
   it (`active=false`) when it should stop taking new jobs. Reached via the
   merchant console (owner wallet required).
2. **Buyers of English → Hindi translation** — someone with ~100–250 words of
   English text who discovers the workshop, pays fixed-price test USDT on
   Whitechain, and receives a reviewable Hindi draft. Reached via the city
   discovery page and My Jobs.
3. **A Hindi reviewer** — the buyer (or someone they share the export with)
   checking the draft segment-by-segment. The brief requires confirming a
   real reviewer before calling the translation useful; that confirmation has
   not happened yet.

## What would count as evidence

- A Rabdi entity key + owner address for a merchant-published workshop.
- A buyer job created from that listing, paid, run, and reviewed.
- Reviewer feedback on actual Hindi output quality.

None of the above exists at this commit. This file will be updated with
addresses, keys, and quotes only when they are real.
