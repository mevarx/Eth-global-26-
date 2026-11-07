// Client wallet/network configuration: Agent B owned.
// Chain IDs and the official token are hardcoded per the common contract (§4):
// Whitechain 1874 + official test USDT 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7,
// Arkiv Rabdi 7794095. RPC/explorer URLs are public deployment data: ClientProviders
// fetches them from /api/config at runtime (never secrets, no NEXT_PUBLIC_ secrets).
// Manifest values below are fallbacks only, so the default config can connect before
// /api/config resolves.
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { getDeploymentManifest } from "../shared/deployment";

export const WHITECHAIN_ID = 1874;
export const ARKIV_RABDI_ID = 7794095;

function manifestRpcUrl(kind: "whitechain" | "arkiv"): string | undefined {
  try {
    const m = getDeploymentManifest();
    const url = kind === "whitechain" ? m.whitechain?.rpcUrl : m.arkiv?.rpcUrl;
    return typeof url === "string" && url.length > 0 ? url : undefined;
  } catch {
    return undefined;
  }
}

const whitechainFallbackRpc = manifestRpcUrl("whitechain");
const arkivFallbackRpc = manifestRpcUrl("arkiv");

export const whitechain = defineChain({
  id: WHITECHAIN_ID,
  name: "Whitechain Testnet",
  // Display-only currency metadata; authoritative RPC/explorer come from /api/config.
  nativeCurrency: { name: "Whitechain Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: { http: whitechainFallbackRpc ? [whitechainFallbackRpc] : [] },
  },
});

export const arkivChain = defineChain({
  id: ARKIV_RABDI_ID,
  name: "Arkiv Rabdi",
  nativeCurrency: { name: "Arkiv", symbol: "ARKV", decimals: 18 },
  rpcUrls: {
    default: { http: arkivFallbackRpc ? [arkivFallbackRpc] : [] },
  },
});

export type ChainRpcs = {
  whitechainRpcUrl?: string;
  arkivRpcUrl?: string;
};

/** Build the wagmi config. Pass RPC URLs fetched from /api/config when available. */
export function buildWagmiConfig(rpcs: ChainRpcs = {}) {
  return createConfig({
    chains: [whitechain, arkivChain],
    connectors: [injected()],
    transports: {
      [whitechain.id]: http(rpcs.whitechainRpcUrl || undefined),
      [arkivChain.id]: http(rpcs.arkivRpcUrl || undefined),
    },
  });
}

/** Placeholder config used before /api/config resolves; no secrets involved. */
export const defaultWagmiConfig = buildWagmiConfig();
