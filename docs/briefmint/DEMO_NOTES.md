> **Current status (7 November 2026 IST):** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](../evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# BriefMint demo notes (2–3 minutes)

Use a synthetic organizer brief and clearly say the content is synthetic. Do not show a real secret, private contact, API key, cookie, wallet signature, or personal source notes. The operator reports one successful standalone 0G smoke response (HTTP 200, valid structure), but no live BriefMint app generation, Arkiv record/lifecycle, production deployment, or independent response verification is established. Router verification/routing metadata was null and debit/credit source remain unknown. The prior HTTP 502 was overcome for that one request. Do not imply a bounty is funded or earned.

## Copyable synthetic intake

Private notes (fictional task, under the input limits):

```text
We are organizing a fictional neighborhood cleanup and need one square event poster. Please propose three visual directions, then deliver an editable SVG and a PNG. The poster should remain readable on a phone, use high-contrast text, and leave room for the final date and venue, which we have not selected yet. Do not invent those details. We can supply a logo after choosing a direction. Accessibility and clear information matter more than decorative effects.

Private coordinator note: INTERNAL-DEMO-CANARY is a harmless synthetic marker for this demonstration. It is not a public requirement and must not appear in the public opportunity. The owner will review and remove any private detail from the proposed sections before approving them.
```

Separate public fields:

```json
{"title":"Community cleanup poster","summary":"Design a readable event poster and supply editable SVG and PNG files.","category":"design","language":"en","budgetUsdCents":2500,"contactUrl":null}
```

Generate a future `deadline` separately, then paste its UTC value into the public date field (or use the UI's future-date picker):

```sh
node -e 'console.log(new Date(Date.now() + 2 * 86400000).toISOString())'
```

The advertised USD 25 is an unfunded statement, with no escrow, payment promise or applicant workflow. This sample does not prove model redaction: review the actual generated text and remove the canary or other private facts before saving/approving. Source IDs and evidence remain private structurally; schema validation cannot identify sensitive prose that a human approves.

## Short walkthrough

1. **Private intake (20–30 seconds):** explain that the organizer's source notes are stored privately by the application backend and submitted through its configured private inference route. Private routing does not hide notes from the backend. Enter a short synthetic sample with a conspicuous canary phrase such as `PRIVATE-CANARY-DO-NOT-PUBLISH` in source-only text.
2. **Compile and review (30–45 seconds):** only show a compiled result if it is genuinely available and evidenced. Show revision, editable draft, and exact public preview. Explain that model output is a proposal: a human must inspect every field and approve the exact payload. If compilation is unavailable, show the unavailable state honestly and narrate the intended step; do not substitute fixtures or imply a real provider response.
3. **Public boundary (30–40 seconds):** show the explicit approved projection and its unfunded budget. Point out that source notes, private IDs, prompts, source references, and verification evidence are excluded. Mention schema validation cannot catch sensitive facts typed into public fields. Do not claim the preview is already onchain.
4. **Arkiv flow (30–45 seconds):** only if a real human-authorized transaction and independent readback exist, show actual entity/owner/hash/receipt evidence and label update, close, filters, or expiry only if each was tested. Explain that Arkiv changes are signed by the owner wallet, indexed public queries support discovery, and the standalone reader can read while the app API is stopped. Native expiry is a network block lifetime; the business deadline is a separate timestamp filter. Use separately captured short-lived-entity evidence for expiry; a countdown is not proof. Without live evidence, describe this architecture as unverified. A screenshot, prepared intent, or successful build is not a chain write.
5. **Close (10–15 seconds):** summarize that BriefMint aims to turn private notes into a human-approved public opportunity while preserving a private working record. State the actual current integration status and invite questions about the trust boundary.

## Claims and provenance

- Current operator-reported evidence includes a public 0G catalog preflight and one successful standalone inference with missing Router verification/routing metadata. The probe's `independentResponseVerification` is unavailable. Router-reported billing or token values are not proof of actual debit; verify the intended account/pool's before-and-after usage or report debit unknown.
- No successful inference, live Arkiv create/readback/filter/update/close/expiry, production hosting, or persistent-host recovery is evidenced. Do not use future operator procedures as if they were completed.
- No funded bounty or award is established. Check current sponsor terms and the official event submission deadline directly before stating either as a fact.
- Known city source snapshot: `cb0db61d3515ee0621547f7832e9826f4be08f2e`. Disclose AI assistance. Original authorship and license provenance for all source/art assets have not been established; perform and document a third-party asset/library license audit before claiming ownership or that all assets are original.
- The visible city scene is implemented in SVG/CSS code; no generated image asset has been identified in the inspected scene component. The complete third-party library/asset inventory and attribution remain unverified. Do not claim that dependencies have been audited.
- Credit the existing city/reference source and AI-assisted backend/test/documentation work. The manifests include Next.js, React, Vite, Tailwind, Radix/Lucide, viem and the Arkiv SDK among other dependencies; retain applicable upstream notices and verify the complete inventory/licenses before distribution. A package name or imported asset alone does not establish reuse rights.
- The configured network explorer URLs are `https://rabdi.explorer.arkiv.network` and `https://explorer.testnet.whitechain.io`; they are not project deployment proof. Link only a separately checked exact transaction/entity.
- Do not show network explorer links as project proof unless the explorer record has been independently verified and corresponds to the demonstrated transaction.

For exact operator gates, see [LIVE_VALIDATION_AND_SUBMISSION.md](LIVE_VALIDATION_AND_SUBMISSION.md), [0G_LIVE_PROBE.md](0G_LIVE_PROBE.md), and [ARKIV_LIVE_PROBE.md](ARKIV_LIVE_PROBE.md).

If latency exceeds the video window, show an already saved **genuine** run and label when it ran, or explicitly shorten the waiting portion while preserving real timestamps. Never call a fixture or an edited waiting sequence a new live result. Current offline tests are useful engineering evidence and must be labelled MOCK; the current app's unavailable state is the truthful default until the external gates pass.
