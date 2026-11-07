# Amber Harbor UI brief

Amber Harbor brings the city workbench forward as the task surface. On desktop, the expandable workbench is 520 px wide by default and 680 px expanded, capped at 55vw. The city camera reserves space from the panel's measured geometry, including its expanded and stacked layouts, so the map fits the actual viewport. On screens at or below 1000 px, the workbench comes first and the map remains a compact, touch-pan viewport; the flow stays task-first at mobile sizes.

Navigation now follows the five-step flow: Plan, Generate, Review, Publish, Archive. Opportunity rows use a named component class for consistent interaction styling. Wallet network-switch controls remain available on legacy jobs and merchant screens; the BriefMint workbench does not surface those controls. Typography, contrast, focus visibility, and 44 px touch targets were increased for readability and access.

Existing safeguards remain in place: fixture previews do not receive live/success styling; compilation credits are described as promotional and advertised budgets as unfunded; publishing still uses the existing confirmation flow; wallet private keys are neither requested nor handled. No inference, wallet writes, environment edits, or changes to existing databases were introduced. Verification: 182 server tests and 27 UI tests passed, along with typecheck, lint and production build. A disconnected preview with temporary storage was used for desktop expansion and task-first narrow-screen checks; this does not establish a live authenticated journey.

Building names remain on the map above each roof in both Pixi and SVG renderers, with larger nameplates. The workbench uses the shorter task labels.
