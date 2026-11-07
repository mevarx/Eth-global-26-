> **Current status — 7 November 2026 IST:** This engineering record retains historical instructions/checkpoints. For the integrated Next.js setup use the [README](../README.md); for successful app generation and Arkiv create/read/discovery use [live evidence](evidence/LIVE_DEMO.md). Earlier Vite-city, HTTP 502-only, no-publication and backend-branch claims are historical. Independent TEE proof and live update/close/expiry remain unverified; do not retry the original unknown R3 intent.

# Tool City — Live Setup From Zero

**Prepared:** 6 November 2026. This is the prerequisite checklist for the feature branch. No wallet, credits, deployment or paid inference has been configured by the agent yet.

## 1. Prepare wallet accounts

Use a wallet supporting EVM networks, such as MetaMask from its official site. Create a dedicated hackathon wallet/account. Keep recovery words/private keys local; do not paste them into chat, screenshots, source files or GitHub.

Prepare two public addresses: **merchant** (owns the Arkiv workshop and receives test-USDT payments) and **buyer** (demonstrates paying and recovering a result). They may be two test accounts in your wallet; do not claim this proves independent customer demand. Copy their public addresses into your notes. Public addresses can be shared with the team.

Your teammate controls the merchant's Arkiv publication flow. A deployment key may be a separate throwaway funded account; the running app never needs it. Browser buyers keep signing in their own wallet.

## 2. Get Whitechain test access

Open the [official Whitechain faucet](https://faucet.testnet.whitechain.io/). Its current landing page requires GitHub login, an account at least 30 days old, and limits faucet drips per account. Complete that login yourself.

Add Whitechain Sepolia using official network information:

| Setting | Value |
|---|---|
| Chain ID | `1874` |
| RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | `https://explorer.testnet.whitechain.io` |
| Native test gas | WBT |
| Official test-USDT contract | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |

Claim test WBT for deployment and customer transactions. The public faucet landing page does not show its authenticated token options, so we have not verified whether it also supplies USDT. **If only WBT appears, ask the Whitechain mentor for official test-USDT funding/mint instructions.** A token we deploy ourselves will not satisfy the selected payment track. [Official Whitechain track](https://ethglobal.com/events/mumbai/prizes/whitechain)

Buyer needs both native test gas and enough official test USDT for the nominal one-token job. Fund the deployment account with native test gas. Confirm actual token decimals through RPC/tooling before setting the integer amount. Do not assume a faucet transaction or token import proves checkout works.

**Tell the agent when ready:** public merchant/buyer addresses, test funding available, and any faucet error. Do not send wallet secrets. Contract deployment remains a separate action after local tests and configuration review. [Official deployment guide](https://docs.whitechain.io/build/deploy/deploy-with-hardhat)

## 3. Get Arkiv test access — teammate can do this in parallel

Open [Arkiv's network page](https://hub.arkiv.network/networks) and use **Add to MetaMask** for Rabdi, or enter the published settings:

| Setting | Value |
|---|---|
| Chain ID | `7794095` |
| RPC | `https://rpc.rabdi.db-chain.testnet.arkiv.network` |
| Explorer | `https://rabdi.explorer.arkiv.network` |

Visit the [official Arkiv faucet](https://hub.arkiv.network/faucet), connect the merchant wallet and claim test **tGLM** for entity writes. Respect the displayed cooldown; do not create fake users to bypass it.

The teammate then proves a genuine signed write/read/update using the SDK. A temporary integration probe must be clearly non-purchasable; the real workshop waits for the actual checkout deployment fields. Next, publish the canonical workshop and return its public entity key and writer address. No server-owned replacement listing.

## 4. Get 0G hackathon compute access

The [Mumbai 0G prize page](https://ethglobal.com/events/mumbai/prizes/0g) says participating teams receive compute credits. Since you have access to the founders/mentors, ask them first:

> We are building Tool City: a paid private English-to-Hindi translation workshop. We need our team's hackathon credits enabled for Private Computer Router API calls, an inference API key, and confirmation of a currently available private model/configuration suitable for Hindi translation. Could you help us activate that and confirm whether this reviewed-translation workflow fits the consumer-app track?

Do not buy mainnet 0G simply because the general quickstart describes deposits. Confirm how **hackathon credits** apply to the Router account and private route first. Whitechain test USDT does not pay the Router bill automatically.

Open [0G Private Computer](https://pc.0g.ai), sign in/connect the account receiving credits, then go to **Dashboard → API Keys → Create**. The documented inference key starts with `sk-`; copy it once into local configuration. An `mk-` management key is not the inference key our app needs. [Official quickstart](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/quickstart), [authentication/key types](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/authentication)

Verify available credits and private model access with the mentor/dashboard. A model catalogue entry alone is not a successful request. Do not silently switch to a non-private tier if capacity is unavailable.

## 5. Configure the local backend

From the repository:

```bash
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
cp .env.example .env.local
```

Open `.env.local` in your editor and fill `ZERO_G_API_KEY` privately. Keep the documented Router base URL and use the model/configuration actually validated with the mentor. Generate an independent session secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste that generated value into `SESSION_SECRET` in `.env.local`; do not send it here. Keep `NEXT_PUBLIC_ENABLE_DEV_FIXTURES=false`. The example confirmation count is a configurable policy, not proof of finality; verify the appropriate policy before live acceptance.

For later Hardhat deployment, create a separate gitignored `.env` with the required deployment-only fields (`DEPLOYER_PRIVATE_KEY`, `MERCHANT_ADDRESS`, network RPC). The secret goes directly into your local editor and is not needed by the running server. Do not run a deployment merely because the file exists; compilation/tests, terms review and funded account selection come first.

Public deployment/contract values are updated in the committed manifest only after real deployment, source verification and reconciliation. Until then `configured=false` is correct. Configuring an API key must not automatically enable purchases against a nonexistent contract.

## 6. Report readiness without sharing secrets

Send a message like:

```text
Merchant address: 0x...
Buyer address: 0x...
Whitechain test WBT: ready / blocked with error
Official test USDT: ready / blocked with error
Arkiv merchant tGLM: ready / blocked with error
0G hackathon credits: enabled / waiting on mentor
0G API key: configured locally / not yet
Hindi reviewer: available / not yet
```

After these prerequisites, the next live gates are actual contract deployment/verification, an official-token purchase, a real owner-published workshop and useful private translations. Until those and the rest of the readiness checklist pass, development remains on the feature branch.

## Publish this feature branch

The initial README was pushed using a one-command credential-cache bypass. That did not save a credential for later agent pushes. The local repo now has `credential.useHttpPath=true` and username `0xsan7`, so credentials can be scoped to this repository.

Run this yourself in Terminal once, and paste the existing fine-grained GitHub token only at its password prompt:

```bash
cd "/Users/santiagojerald/Desktop/Eth Global/tool-city"
git -c credential.helper= -c credential.helper=osxkeychain push -u origin codex/payment-backend
```

This resets the helper list for that command, uses macOS Keychain and can save the successful repository-scoped credential. Do not paste the token into chat or put it in the command/remote URL. If GitHub rejects it, verify the existing selected-repository Contents read/write permission. This publishes the feature branch; it does not merge main.

After the branch is actually published, the teammate starts their frontend branch from this shared baseline and follows the common ownership contract.
