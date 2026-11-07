# Attribution and license status

This repository includes inherited Tool City frontend/reference work, BriefMint implementation, legacy translation/payment code, and AI-assisted code/documentation. Git records contributor identities `0xsan7`, `mevarx`, `VARX!!` and `usehoplite[bot]`; this is not an assignment of authorship for every asset or a claim of affiliation.

No root LICENSE or contributor licensing agreement is established. A scan of the working tree confirms there is no `LICENSE` or `COPYING` file anywhere in the repo itself outside `node_modules`; the only LICENSE file found outside dependency installs sits nested under `examples/checkout-demo/node_modules/@vitejs/plugin-react/` and belongs to that package, not this repository. Public GitHub visibility does not grant an open-source license. Before submission, the maintainers must confirm permission for inherited code and city/reference artwork, choose a suitable code license, and preserve any required notices. Do not apply a blanket license to assets without confirming rights. Choosing the root license remains an operator decision; this document does not select one.

## Verified inventory (this review)

### Bundled fonts

No font files (`*.ttf`, `*.otf`, `*.woff`, `*.woff2`) exist in the working tree outside `node_modules`; fonts are consumed as npm packages (verified against each package's own `LICENSE` file and `package.json` `license` field):

- `@fontsource-variable/inter` 5.3.0 — `license: "OFL-1.1"`; its shipped `LICENSE` file carries the SIL Open Font License 1.1 text and attributes the font ("Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)"). Imported in `src/app/layout.tsx:5`.
- `@fontsource/space-mono` 5.3.0 — `license: "OFL-1.1"`; its shipped `LICENSE` file carries the SIL Open Font License 1.1 text and attributes the font ("Copyright 2016 The Space Mono Project Authors (https://github.com/googlefonts/spacemono)"). Imported in `src/app/layout.tsx:3-4`.

**Action:** preserve these OFL notices when redistributing builds (the OFL requires license text distribution with the fonts). No other font assets are bundled.

### Runtime and build dependencies

Licenses below are read directly from each installed package's `node_modules/<pkg>/package.json` `license` field (or its own `LICENSE`/`LICENSE.md` file, noted); this is not an audit of their transitive dependency trees, which are pinned in `package-lock.json`:

| Package | Version | License (claimed by the package itself) |
| --- | --- | --- |
| `next` | 16.4.5 | MIT |
| `react` / `react-dom` | 19.3.1 | MIT |
| `pixi.js` | 8.22.0 | MIT (own `LICENSE` file) |
| `viem` | 2.57.16 | MIT (own `LICENSE` file) |
| `wagmi` | 3.7.11 | MIT (own `LICENSE` file) |
| `zod` | 4.6.7 | MIT (own `LICENSE` file) |
| `@tanstack/react-query` | 5.106.1 | MIT |
| `@arkiv-network/sdk` | 1.0.1 | MIT per its own `LICENSE.md` ("Copyright (c) 2025 Arkiv Network"); package.json has no `license` field |
| `server-only` | 0.0.1 | MIT |
| `@openzeppelin/contracts` | 5.6.1 | MIT (package.json field; used by `contracts/ToolCityCheckout.sol` and `contracts/test/TestToken.sol`) |
| `typescript` | 5.9.3 | Apache-2.0 |
| `dotenv` | 18.0.9 | BSD-2-Clause |
| `hardhat` | 3.21.2 | MIT (own `LICENSE` file) |
| `@nomicfoundation/hardhat-toolbox-viem` | 5.0.7 | MIT |
| `eslint` | 9.39.5 | MIT |
| `vite` | 8.3.6 | MIT |
| `vitest` | 5.1.0 | MIT |
| `tsx` | 4.23.15 | MIT |

The `examples/checkout-demo` workspace reuses the same reactive/viem stack (`@tanstack/react-query`, `react`, `react-dom`, `viem`, `wagmi`, `vite`, `typescript` — all versions listed above; `@vitejs/plugin-react` 6.2.1 ships its own `LICENSE` under `examples/checkout-demo/node_modules/`). Note that the `@arkiv-network/sdk` package states its license in its own `LICENSE.md` rather than in its `package.json` metadata (the field is absent there).

### City / reference code provenance

- `src/components/city/*` — including the Pixi renderer `src/components/city/pixi/city-engine.ts` (whose header states: "Everything is drawn procedurally, no external images or fonts") — originates from branches and commits inside this repo and its collaborators' fork, including `codex/city-frontend` on the `mevarx/Eth-global-26-` fork (`docs/frontend-handoff.md`) and `feat/tool-city-workshop-ui` merged into the current tree.
- `docs/briefs/TOOL-CITY-BUILD-PLAN.md:44` cites [mittal-parth/claude-clan](https://github.com/mittal-parth/claude-clan) as inspiration for the isometric-world interaction model ("We borrow that interaction principle") — not as a code source. That claude-clan repo uses no open-source license. Nothing in the current working tree is verified as copied from it; the inspiration claims should be taken at face value only as documentation, not as proof of originality of every line.
- Important: the `apps/web` claude-clan copy is **removed from the current working tree** (verified: no `apps/`, no third-party binary art in `public/` or `docs/`), but it remains reachable in git history. Because claude-clan upstream carries no license, any future release, fork, or submodule that resurrects that history would include unlicensed upstream material; current HEAD does not.
- `public/city/README.md` already states there are no binary artwork assets in the city directory at this checkpoint and acknowledges that an earlier blanket "all original / no third-party fonts" claim has not been established. That acknowledgment still stands; this document now replaces the inaccessible earlier claims with verified dependency-attribution facts above.

### Legal translation / payment code

The current translation and payment implementations (`src/components/checkout/ToolCityPay.tsx`, `src/app/api/jobs/[jobId]/verify-payment/route.ts`, `src/components/jobs/TranslationReview.tsx`, and related UI) are BriefMint implementation code on the shared derive layer; no legacy translation/payment demo code is present in the working tree. The only "legacy" reference material (the removed `apps/web` demo) is described above.

## Status: verified current-tree facts recorded; operator actions remain

| Item | Status |
| --- | --- |
| Bundled font identities, versions and upstream licenses (OFL-1.1) | **Verified** from installed package `LICENSE`/metadata |
| Runtime/build dependency licenses (~20 notable packages) | **Verified** from each package's own `LICENSE`/`package.json` (transitive trees not audited) |
| OpenZeppelin contracts MIT claim for `contracts/*.sol` | **Verified** (SPDX headers in `contracts/ToolCityCheckout.sol`, `contracts/test/TestToken.sol`; OZ package license field) |
| claude-clan upstream license | **Verified absent** (GitHub API `"license": null`) — treated as unlicensed upstream; no copy in current tree |
| Removed historical `apps/web` claude-clan copy in git history | **Flagged** — reachable in history, absent at HEAD; release process should acknowledge or prune if republishing history |
| City/reference code permission from all contributors | **Unverified** — maintaining operators must confirm permissions for inherited/forked work (identity attribution to `0xsan7`, `mevarx`, `VARX!!`, `usehoplite[bot]` does not constitute assignment of rights) |
| Root code license choice | **Not selected** — remains an operator prerequisite; no license is chosen or implied here |

No submission screenshot or video has been fabricated. Capture existing genuine artifacts using the [checklist](RECORDING_CHECKLIST.md), review for private material, and obtain consent for anything identifying a person. Add verified public video/demo URLs only after recording or deployment. AI assistance was used for planning, implementation, testing and writing; it does not establish ownership of third-party material.
