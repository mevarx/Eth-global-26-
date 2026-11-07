# Arkiv schema

BriefMint publishes only the human-approved canonical public opportunity JSON. Private source notes, model prompts/output references, internal IDs, and evidence remain in the access-controlled SQLite backend. The app validates the public payload before encoding it; backend access controls are not end-to-end encryption.

Schema implementation: [`src/lib/arkiv/briefmint/schema.ts`](../src/lib/arkiv/briefmint/schema.ts). Namespace is `tool-city.opportunity.v1`; the indexed `app` field repeats that namespace. Schema version is `1`. Other indexed fields are `schemaVersion`, `category`, `language`, `status`, `budgetPresent`, `budgetUsdCents`, and `deadlineUnixSeconds`. `title` and canonical `content` are UTF-8 byte fields and are unindexed. Network metadata supplies `$owner` (wallet), `$key` (entity identity), and `$expiresAt` (expiry block). Creation derives the network expiry block from the approved future business deadline and observed block duration. A patch updates the same entity and does not extend its lifetime.

The live demo established one Arkiv create, receipt and readback/discovery. The actual record and canonical hash are documented in [live evidence](../docs/evidence/LIVE_DEMO.md). Update, close, and native expiry were checked offline only.
