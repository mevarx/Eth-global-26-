# ETHGlobal submission: BriefMint

> **Submission status:** Draft copy for review. Replace bracketed placeholders only after checking the actual submission form, repository state, and event rules. No prize eligibility, award, funded bounty, or deployed production demo is claimed.

## Project name and tagline

**BriefMint**: Turn private working notes into a public opportunity only after the owner reviews and approves it.

## Short description (about 250 characters)

BriefMint turns private organizer notes into a human-reviewed public opportunity. A private 0G Router model proposes structured copy; the owner edits and approves the exact public fields, then publishes them to Arkiv for independent discovery.

## Pitch (about 75 words)

Organizers often have useful work to offer but start with messy, sensitive notes. BriefMint keeps those notes in an access-controlled private backend and asks a 0G Router model to propose structured opportunity copy. The owner can edit it, inspect the public projection, and approve an exact revision before the owner wallet publishes it to Arkiv. Anyone can discover public opportunities independently. There is no applicant inbox, escrow, or payment flow: the product is a deliberate boundary between private preparation and public discovery.

## Detailed description (350–500 words)

Organizers describe work in rough notes: goals, constraints, preferences, and context that may not belong in a public listing. Copying those notes directly into a public marketplace is risky; manually rewriting them takes time and can omit important requirements. BriefMint provides a small workflow for turning private source material into an explicit, owner-approved public opportunity.

The organizer signs in with a wallet. BriefMint stores source notes in a private, access-controlled SQLite-backed service. “Private” describes the application’s access controls; the backend can read the notes, and the data is not end-to-end encrypted. When the owner asks for a draft, the server sends the notes to the configured 0G Router model (`0gm-1.0-35b-a3b`) with TEE verification requested and fallback disabled. The model returns structured draft content and source references. These settings express the requested route; independent cryptographic verification of the model execution has not been established, and missing Router verification metadata remains unknown.

The model output is only a proposal. The owner can edit it, create a revision, inspect the exact public fields, and approve that revision. The publication projection excludes private notes and internal source references by design, but a human still needs to inspect prose for accidental disclosure. After approval, the owner’s wallet signs an Arkiv create operation. The backend records the receipt and reads the entity back; public discovery uses independently indexed Arkiv data. A standalone CLI reader can fetch entities and list/filter opportunities without the application API, cookies, or SQLite database.

The demonstrated record is “Developer onboarding document [demo 2a69f504]”, revision R1, category `writing`, owned by `0xD582d7C24528a3f0294aCAFA46Fae6e797b76aB8` on chain 7794095. Its Arkiv entity is `0x85ea1b83ec04c6f9ff795d75cfbd5f2d136cb69bb571c4ec6ec18dce648bb121`, transaction `0x78ab3f744d123c56e985008cbf70c12a81fe1fb927f79b4220e67147b0a4c3ea`, canonical public hash `0xead78d55b37906e3bd2333a7ed2c3840d00bf9ec163b331b55d5602b126e7c45`, expiry block 587315. See [the live demo evidence](../evidence/LIVE_DEMO.md) for checked record links and provenance. The prior R3 intent remains unresolved/unknown with no hash; the demonstrated record is a separate copy that reused a genuine prior generation, received fresh owner approval, and has a new identity. This carries duplicate-content risk, which we disclose.

Live achievements include wallet authentication, private persistence, a genuine 0G-generated and editable draft, owner approval, successful Arkiv creation/receipt/readback, and public discovery. Update, close, and native expiry were exercised offline only. No applicants, escrow, or payment are implemented. The stack uses Next.js 16.4.5, React 19.3, TypeScript, Node 24, SQLite, Zod, wagmi/viem with MetaMask, and a Pixi.js city interface. The next work is to verify Router attestation independently, resolve the old intent safely, test lifecycle actions against the live network, complete asset/license attribution, and establish a hosted demo.

## Problem, solution, and how it works

1. **Problem:** useful opportunities begin as private, unstructured organizer notes; publishing them directly risks disclosure and weak requirements.
2. **Solution:** prepare privately, generate a structured draft, let the owner revise and inspect the public projection, then publish only after explicit approval.
3. **Flow:** wallet sign-in → access-controlled private persistence → server-only 0G Router inference → editable draft and source references → owner revision/hash approval → owner-wallet Arkiv create → backend receipt/readback → public indexed discovery or independent CLI read.

## Architecture and trust boundaries

- **Private app service:** Next.js / Node 24 with SQLite and Zod validation. It is access-controlled but not end-to-end encrypted.
- **Inference:** server-only 0G Router request for `0gm-1.0-35b-a3b`, `verify_tee: true`, fallbacks disabled. A requested verification mode is not proof of an independently verified TEE result; metadata gaps remain unknown.
- **Publication:** wagmi/viem and MetaMask for the owner’s Arkiv action. The approved public projection has a canonical hash and excludes private source fields. The wallet owner authorizes the transaction.
- **Discovery:** Arkiv indexed public records and a standalone CLI reader requiring neither app API nor local private database.
- **Experience:** Pixi.js animated city interface around the BriefMint workflow.

## Live achievements and limitations

**Demonstrated:** wallet authentication; private persistence; genuine 0G-generated editable draft; owner edit/revision/hash approval; Arkiv create, receipt and entity readback; independently accessible public opportunity discovery. Exact record identifiers are in [live evidence](../evidence/LIVE_DEMO.md).

**Not demonstrated live:** independent cryptographic TEE verification; update, close, or native expiry (offline checks only); production deployment or hosting; resolved status of the original R3 intent. There is no applicant workflow, escrow, or payment. The duplicate-content risk from the separately approved demo copy is disclosed. Attribution and license audit is incomplete; do not describe all assets as original.

## What is distinct

The product makes the human approval boundary central: model output cannot directly become a listing. The private working record and the public opportunity are separate representations, the exact approved revision is hash-bound, and public discovery does not depend on BriefMint’s private database or API.

## Roadmap

- Obtain and independently validate 0G Router verification evidence.
- Reconcile the unresolved original intent and document safe duplicate handling.
- Demonstrate live update, close, expiry, and independent reads with checked evidence.
- Complete third-party asset and dependency attribution/license review.
- Deploy a persistent, monitored demo and test recovery and user feedback.
- Consider applicant and payment features only as a separately designed, reviewed scope.

## Conditional prize suggestions

No eligibility or award is asserted. The [Arkiv prizes](https://ethglobal.com/events/mumbai/prizes/arkiv) page has criteria submissions for schema, friction, reach, why Arkiv, and how Arkiv is used; the accompanying files in [`arkiv/`](../../arkiv/) answer those prompts factually. “Build on Arkiv (from scratch)” eligibility is not established because project build timing must be verified; the existing-projects variant requires Continuity participation, which is also not established. The [0G prizes](https://ethglobal.com/events/mumbai/prizes/0g) page describes Build with 0G Private Computer requirements including mainflow inference request IDs, public repository, setup instructions, video under 3 minutes, live demo, and team contact. Those submission materials/demo are not yet complete; the iAI bonus is not implemented. Verify current official terms before selecting tracks. There is no root LICENSE; the open-source-license requirement is unmet pending operator confirmation of rights and asset attribution review. Do not claim eligibility, an award, or a funded bounty.

## 90-second narration

“BriefMint helps an organizer turn rough, private notes into a public opportunity without publishing those notes directly. I sign in with my wallet, enter source material, and ask the server to prepare a structured draft through the configured 0G Router model. The notes are stored in an access-controlled backend, so private here does not mean end-to-end encrypted. The model’s output is a proposal: I can edit it, inspect the public fields, and approve a specific revision. Then my wallet authorizes the Arkiv create. This live record has a receipt, a public entity identity, and a canonical hash. I can discover it through the public index or use the standalone reader without the app API or private database. We have demonstrated creation and readback; independent TEE verification and live update, close, and expiry remain unverified. BriefMint is focused on that clear boundary between private preparation and deliberate public publication.”

## Judge pitch

**In one sentence:** BriefMint uses 0G-assisted drafting and Arkiv publication to make the owner’s review and approval the explicit gate between private work notes and a discoverable public opportunity.

**Show:** a saved genuine draft, the editable/approved public projection, the successful Arkiv receipt and public entity, then the independent CLI reader. See [DEMO_GUIDE.md](DEMO_GUIDE.md).

## Links and placeholders

- **Repository:** [GitHub branch](https://github.com/0xsan7/Eth-global-26-/tree/codex/briefmint-integration-fixes) *(confirm branch is public and current at submission time)*
- **Team contact:** `[ADD CONFIRMED TEAM NAMES AND CONTACT DETAILS]`
- **Live demo:** `[ADD VERIFIED PUBLIC DEMO URL, none established]`
- **Video (under 3 minutes):** `[ADD VIDEO URL AFTER RECORDING]`
- **Evidence:** [live demo evidence](../evidence/LIVE_DEMO.md)
- **Local UI:** `http://127.0.0.1:3001` *(local operator environment, not a public demo link)*

**Contributors (verified Git identities):** `0xsan7`, `mevarx`, `VARX!!`. Roles and affiliations are not asserted. AI assistance was used. The existing city/reference source and all third-party asset/library licenses still require attribution review; the repository has no root LICENSE file.
