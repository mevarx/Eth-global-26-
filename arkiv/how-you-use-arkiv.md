# How BriefMint uses Arkiv

After wallet authentication, private notes are persisted in the access-controlled backend and sent server-side through the configured 0G Router model for a structured proposal. The owner edits the result, reviews the exact public projection, and approves a revision/hash. Only the canonical allowlisted public JSON is encoded into the Arkiv schema; notes, prompts, source references, model evidence, and private identifiers remain in SQLite.

The owner wallet authorizes the create. The backend records transaction/receipt evidence and reads the entity back. Public discovery queries indexed Arkiv fields, and a standalone CLI reader can fetch/list public opportunities without the application API, cookies, or SQLite. One create, receipt, readback, and public discovery were demonstrated; update, close, and native expiry remain offline-only checks. Independent TEE verification is not established. See [live record evidence](../docs/evidence/LIVE_DEMO.md).
