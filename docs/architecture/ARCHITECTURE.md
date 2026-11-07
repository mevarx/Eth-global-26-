# BriefMint architecture

Current integrated Next.js application; legacy translation/payment code is separate. [README](../../README.md) provides setup; [live evidence](../evidence/LIVE_DEMO.md) qualifies observations.

## Components and trust boundaries

```mermaid
flowchart LR
  subgraph Browser[Owner browser]
    Wallet[MetaMask owner wallet]
    UI[Next.js city and private review]
    Approval[Inspect exact public projection]
    Wallet --> UI
    UI --> Approval
  end
  subgraph Server[Trusted application host]
    API[Authenticated Next.js API]
    DB[(Access-controlled SQLite)]
    Parse[Validate structured output]
    Intent[Revision and hash-bound intent]
    API --> DB
    Parse --> DB
    API --> Intent
  end
  G[0G Router and model provider]
  Chain[Arkiv Rabdi public network]
  Reader[Independent reader without app API]
  UI -->|Cookie and owner header| API
  API -->|Private notes over HTTPS| G
  G -->|Draft and reported evidence| Parse
  API --> Approval
  Approval -->|Explicit approval| API
  Intent --> UI
  UI -->|Approved public operation| Wallet
  Wallet -->|Owner-signed transaction| Chain
  API -->|Receipt and entity readback| Chain
  Reader -->|Indexed query or entity get| Chain
```

The application host and inference provider process private notes. Wallet secrets remain in the wallet. Independent reader means independence from the BriefMint backend, not a different chain provider or independent TEE proof.

## Execution sequence

```mermaid
sequenceDiagram
  actor Owner
  participant UI as Browser UI
  participant API as Next.js API
  participant DB as Private SQLite
  participant G as 0G Router
  participant W as MetaMask
  participant A as Arkiv Rabdi
  participant R as Independent reader
  Owner->>UI: Connect and sign in
  UI->>API: Request chain-purpose challenge
  API-->>UI: Expiring single-use nonce
  UI->>W: Sign authentication message
  W-->>UI: Signature
  UI->>API: Verify signature
  API-->>UI: HttpOnly session cookie
  UI->>API: Create private brief
  API->>DB: Immutable input and owner
  Owner->>UI: Deliberately request generation
  UI->>API: Run brief
  API->>DB: Atomically reserve quota and lease
  API->>G: Private routing, verify_tee, no fallback
  G-->>API: Structured draft and available metadata
  API->>API: Validate output and evidence semantics
  API->>DB: Save immutable result and editable revision
  Owner->>UI: Review, edit and save
  UI->>API: Save expected revision
  API->>DB: New revision, invalidate old approval
  Owner->>UI: Approve exact public preview
  UI->>API: Approve revision and canonical hash
  API->>DB: Bind approval
  UI->>API: Prepare publication intent
  API-->>UI: Approved public-only operation
  UI->>W: Request owner signature and broadcast
  W->>A: Submit create
  W-->>UI: Transaction hash
  UI->>API: Persist hash immediately
  API->>DB: Pending intent and hash
  API->>A: Get receipt and entity
  A-->>API: Signer, entity, content and expiry
  API->>API: Verify matching approved intent
  API->>DB: Record confirmed publication
  R->>A: Public indexed query and readback
  A-->>R: Validated opportunity
```

This is the success path, not a guarantee of delivery. No hash means unknown broadcast, not proof of failure. Unknown attempts stay locked; automatic retries are forbidden. An entity transaction must target the pinned Arkiv engine and match actual owner/content/revision before success. Explicitly approved demo copies have separate identities; they do not cancel old attempts.

## Data and security boundary

```mermaid
flowchart TB
  subgraph Private[Access-controlled backend data]
    N[Immutable notes and source references]
    I[Inference inputs]
    D[Original model output and editable revisions]
    E[Sanitized model and request evidence]
    N --> I
    I --> D
    D --> E
  end
  G[Configured 0G service processes inference inputs]
  I --> G
  G --> D
  P[Allowlisted public projection]
  H[Owner approves revision and canonical SHA-256 hash]
  W[Owner wallet signs public intent]
  subgraph Public[Public network and readers]
    A[Arkiv content and indexed fields]
    M[Network owner, entity key and expiry]
    Q[Independent public discovery]
    A --> Q
    M --> Q
  end
  D -->|Human review and explicit field projection| P
  P --> H
  H --> W
  W --> A
  W --> M
```

Private data is protected by session ownership/origin checks and host controls, **not end-to-end encryption**. The public allowlist excludes notes, source IDs, internal IDs, prompts, evidence and credentials. It cannot prevent a human from approving a sensitive fact inside ordinary public prose.

## Implemented boundaries

| Boundary | Source |
|---|---|
| Canonical API registry, DTOs, strict validation, public hashing | [shared/briefs.ts](../../src/lib/shared/briefs.ts) |
| Auth, private persistence, quota/lease, generation | [server modules](../../src/lib/server/) |
| Server publication preparation and reconciliation | [brief-publication.ts](../../src/lib/server/brief-publication.ts) |
| Browser transaction policy and public schema/reader | [Arkiv adapters](../../src/lib/arkiv/briefmint/) |
| Independent executable reader | [briefmint-arkiv-reader.ts](../../scripts/briefmint-arkiv-reader.ts) |

The named schema is `tool-city.opportunity.v1`; [schema details](../../arkiv/schema.md) distinguish indexes from UTF-8 content and network system fields. Business deadline is a timestamp; native expiry is a network block. Creation derives expiry from the approved deadline and observed block timing. Patches do not extend lifetime.

## Runtime

One Node 24 Next.js instance serves UI and API on one origin, with persistent SQLite. Browser wallet writes; the server never signs opportunities for all users. Production needs HTTPS, matching origin configuration, Secure cookies, restricted disk access and consistent backups. Ephemeral/serverless filesystems and independent replica databases do not satisfy this deployment model. Saved results load without new inference.

## Evidence level

The operator demonstrated app generation and Arkiv create/read/discovery. Offline tests cover lifecycle/error/privacy paths. Independent TEE proof, live update/close/expiry and a public hosted deployment remain unverified. Successful request metadata records what was returned; absent verification fields remain unknown.
