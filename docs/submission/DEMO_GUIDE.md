# BriefMint demo guide

Target runtime: 2 minutes 30 seconds, maximum 3 minutes. Use only the already saved genuine draft and successful Arkiv entity. **Do not generate again, sign again, create another record, or perform a write during recording.** The prior R3 intent has no known transaction hash and remains unresolved; do not retry it. The shown entity is a distinct demo copy with fresh owner approval, and duplicate-content risk is disclosed.

## Before recording

- Start the already running local UI at `http://127.0.0.1:3001`; verify the intended wallet/account is visible without displaying secrets.
- Confirm the saved draft, approved public projection, successful receipt and entity are already present. If any is unavailable, stop and record the truthful backup below.
- Close unrelated tabs and hide terminal history, environment files, cookies, signatures, private source notes, and wallet prompts. Use a synthetic/review-safe brief only.
- Capture the screen at readable zoom. Do not trigger any control that can infer, sign, or write.
- Keep [RECORDING_CHECKLIST.md](RECORDING_CHECKLIST.md) open separately from the capture.

## Timed sequence and spoken lines

### 0:00–0:18: City / product framing

**Screen:** Open the BriefMint view in the Pixi.js city; move to the BriefMint workflow without lingering on unrelated interface.

**Say:** “BriefMint turns an organizer’s private working notes into a public opportunity only after the owner reviews and approves the exact public version.”

### 0:18–0:43: Private record and generated draft

**Screen:** Show the already saved brief and genuine generated draft. Avoid revealing the original private notes or any sensitive-looking text. Point to the draft’s editable state and source-reference area.

**Say:** “The source record lives in an access-controlled backend and is sent server-side to the configured 0G Router model for a structured proposal. Access-controlled does not mean end-to-end encrypted. This is a saved genuine result; I’m not making a new inference during the demo.”

### 0:43–1:08: Edit and approval boundary

**Screen:** Show the saved edited revision and approval/hash state. Highlight the exact public fields/preview. Do not click edit, approve, compile, or save.

**Say:** “The model output is only a proposal. The owner can edit it, review the public projection, and approve a specific revision. Private source notes and internal references are not part of the published projection. A person still has to review the wording for accidental disclosure.”

### 1:08–1:42: Existing Arkiv record

**Screen:** Show the successful create receipt and entity details already captured in the UI or evidence file. Avoid opening wallet prompts. Show owner, chain, canonical hash, transaction and entity identity only if legible. The evidence document is authoritative if the UI does not show all fields.

**Say:** “The owner approved and authorized this separate demo copy, which was created on Arkiv and read back. The transaction and entity identifiers, owner, chain, and canonical public hash are recorded in our evidence. The earlier R3 intent is still unresolved, so we do not retry it; this copy has its own approval and identity. That also means duplicate content is a known risk.”

### 1:42–2:12: Independent public read

**Screen:** Show a previously captured output from the standalone reader command below, or run a read-only query if already configured and safe. Do not include API cookies or private DB data. Network reads are read-only but can be rate-limited.

**Say:** “This record can be read from the public Arkiv index without BriefMint’s application API, session, or SQLite database. The CLI reader is an independent access path, not proof of independent TEE verification.”

### 2:12–2:30: Limits and close

**Screen:** Return to the public record or project title. No writes.

**Say:** “We have demonstrated the private persistence, genuine generated and edited draft, owner approval, Arkiv create and readback, and public discovery. Independent cryptographic TEE verification, live update, close, expiry, and production hosting are not established. There is no applicant, escrow, or payment flow.”

## Independent CLI reader

Run from the repository root only after the entity key and public endpoint are checked. These are read-only commands and use no BriefMint API, cookies, or SQLite. The public endpoint may rate-limit requests.

```sh
node --import tsx scripts/briefmint-arkiv-reader.ts --get 0x85ea1b83ec04c6f9ff795d75cfbd5f2d136cb69bb571c4ec6ec18dce648bb121 --public-endpoint
```

Optional indexed list query for the public record’s verified `writing` category (anonymous endpoint may return HTTP 429):

```sh
node --import tsx scripts/briefmint-arkiv-reader.ts --list --public-endpoint --status open --category writing --limit 20
```

If the read fails or the endpoint is unavailable, do not retry writes. Show a previously captured, timestamped, genuine successful reader output and state when it was captured. If there is no saved output, omit this screen and state that the independent read is unavailable now.

## Safe repeat versus costly or consequential actions

- **Read-only:** display already saved UI state; inspect sanitized evidence; run the CLI `--get` or `--list` with explicit public endpoint. A read may be rate-limited.
- **Potentially billable:** any new 0G generation or retry. Do not run during this demo.
- **Wallet-authorized writes:** create, update, and close require a fresh owner-approved transaction. Do not trigger them.
- **Uncertain transaction:** never retry an intent with unknown broadcast/hash status. Reconcile it separately before any future write.
- **Not shown as live:** update, close, and native expiry were tested offline only.

## Honest backup if RPC or UI is down

Use only sanitized, previously saved evidence for the same successful record. Say: “The live endpoint is unavailable during this recording, so I’m showing the previously captured receipt and reader result with its original timestamp. I am not making a new write or implying that this is a fresh live response.” If no saved evidence is available, show the prepared project screens only and clearly label the chain step “not available in this recording”; do not use a fixture, simulated response, screenshot montage presented as live, or generated replacement.
