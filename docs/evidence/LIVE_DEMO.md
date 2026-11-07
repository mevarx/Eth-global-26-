# BriefMint live demonstration evidence

This document separates operator-demonstrated achievements, this checkpoint's read-only observations, and offline fixtures. No inference, wallet signature or chain write was made during the documentation checkpoint. Public identifiers below refer to already published data; private notes and database IDs are deliberately absent.

## Demonstrated app journey

The operator demonstrated MetaMask authentication, private intake/persistence, real 0G generation, editable structured output, saved edits, revision/hash approval, owner-signed Arkiv create, receipt/readback and public opportunity discovery. This is distinct from tests using synthetic adapters.

The published opportunity is a **separately approved demo copy** of an existing genuine generation. It reused saved output without another inference, received its own approval and publication identity, and is revision 1. The earlier approved R3 attempt remains pending/unknown without a hash. It was not cleared, cancelled or retried. A duplicate-content risk remains if that older attempt eventually appears.

## Public Arkiv record

| Field | Value |
|---|---|
| Network | Rabdi, chain `7794095` |
| Title | Developer onboarding document [demo 2a69f504] |
| Category / revision / status | `writing` / `1` / `open` |
| Owner | `0xD582d7C24528a3f0294aCAFA46Fae6e797b76aB8` |
| Entity key | `0x85ea1b83ec04c6f9ff795d75cfbd5f2d136cb69bb571c4ec6ec18dce648bb121` |
| Transaction | `0x78ab3f744d123c56e985008cbf70c12a81fe1fb927f79b4220e67147b0a4c3ea` |
| Canonical public SHA-256 | `0xead78d55b37906e3bd2333a7ed2c3840d00bf9ec163b331b55d5602b126e7c45` |
| Business deadline | `2026-11-13T09:00:00.000Z` |
| Native expiry | block `587315` |

Receipt/entity identifiers above match the existing confirmed local publication record and operator report. During this checkpoint the standalone reader independently returned this entity from the **public network**, with the matching owner/title/revision/status, structured sections, deadline and expiry. Its observation was block `304861`, chain timestamp `2026-11-06T20:04:52.000Z`; this is a network observation time, not a permanent freshness guarantee. Response latency was 1,524 ms.

A subsequent indexed `writing`/`open` query returned HTTP **429**, `ANON_COST_LIMITED`. This is a failed query, not zero results and not fresh confirmation of indexed discovery. Earlier public discovery was demonstrated by the operator. No further automatic retry was made. Anonymous endpoint availability can vary; use a deliberately configured public endpoint access key locally if needed, without publishing the key.

Read independently, even with the BriefMint server stopped:

```sh
node --import tsx scripts/briefmint-arkiv-reader.ts --get 0x85ea1b83ec04c6f9ff795d75cfbd5f2d136cb69bb571c4ec6ec18dce648bb121 --public-endpoint
node --import tsx scripts/briefmint-arkiv-reader.ts --list --public-endpoint --status open --category writing --limit 20
```

These commands use Arkiv directly, without application API, cookies or private SQLite. Future reads can fail, see changed state, or no longer find an expired record. Never substitute a fixture and call it live. The [transaction explorer page](https://rabdi.explorer.arkiv.network/tx/0x78ab3f744d123c56e985008cbf70c12a81fe1fb927f79b4220e67147b0a4c3ea) returned HTTP 200, and the served explorer JavaScript explicitly supports `/tx/:hash`. Its HTML is a client-rendered shell: URL availability alone is not receipt verification. Identifiers and the direct reader remain the verification path when explorer rendering is unavailable.

## 0G evidence levels

The saved source brief contains app request ID `c3ccfbf1-923b-4c2f-a9c9-4d9326470e46`, model `0gm-1.0-35b-a3b`, and provider identifier `0xf4FB8d2bD856e672b5f9848b0eD235A20079B250`. These sanitized metadata fields were inspected read-only; no source notes were extracted. `routerVerification` and `routingTier` were null. A provider identifier is reported metadata, not verified identity/attestation.

An **earlier standalone** authorized probe separately returned HTTP 200 in 9,133 ms with 668 total reported tokens and request ID `077bd220-2efa-4bbd-bb1f-3b3964ff0038`. Do not attribute that latency/token count to the later app request. The older HTTP 502 was overcome for those successful requests, not permanently solved.

Both use requested private routing, `verify_tee: true`, disabled fallbacks and no automatic retries. **Independent cryptographic TEE verification is not implemented/established.** Missing metadata is unknown, never verified. Actual promotional-credit debit and credit source were not measured. Current operator inference quota is exhausted; the demo must reuse saved output.

## Unverified or limited

- Live update, close and native expiry remain unverified; deterministic tests cover their intended paths.
- The original R3 broadcast remains unresolved; nonce zero or an empty explorer cannot prove nonbroadcast.
- HTTPS production deployment, public demo URL, final video and license/asset clearance remain operator tasks.
- Backend notes are access-controlled, not end-to-end encrypted. The app host and inference service process them.

Use the [demo guide](../submission/DEMO_GUIDE.md) and [verification record](../submission/VERIFICATION.md). No eligibility, independent TEE proof or live lifecycle completion is claimed.

## Operator UI captures — 7 November 2026 IST

The operator subsequently supplied four unchanged screenshots, now in the [README gallery](../../README.md#inside-tool-city). The public Opportunities capture shows a successful refresh at **01:59:44 IST**, the matching demo entity, revision 1, open/fresh status and expiry block 587315. This is newer operator UI evidence than the earlier rate-limited documentation query; no additional network call was made to create the gallery. It does not establish present availability or a new transaction.

The archive capture separately shows the published demo and unresolved original R3 intent. The independent-reader capture shows blank input controls, not an independent query result or proof that the API was stopped. The screenshot manifest and future draft/approval slots are documented in the [capture guide](../assets/screenshots/README.md).
