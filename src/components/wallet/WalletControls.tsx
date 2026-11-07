"use client";
// Wallet + session controls, Agent B owned. Connect the project-owner wallet,
// switch between Rabdi (Arkiv publication) and Whitechain (legacy checkout),
// sign in/out of the cookie session, and wrong-network hints. The wallet's
// private key is never requested or handled, signing happens in the wallet.
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { usePathname } from "next/navigation";
import { useLogin, useLogout, useSession } from "@/lib/client/use-session";
import {
  ARKIV_RABDI_ID,
  WHITECHAIN_ID,
  arkivChain,
  whitechain,
} from "@/lib/client/wallet-config";

export function truncateAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function chainLabel(chainId: number | undefined): string {
  if (chainId === WHITECHAIN_ID) return whitechain.name;
  if (chainId === ARKIV_RABDI_ID) return arkivChain.name;
  return chainId === undefined ? "Not connected" : `Chain ${chainId}`;
}

export default function WalletControls({
  expectedChainId,
}: {
  /** Network the surrounding screen expects; defaults to Rabdi (Arkiv publication). */
  expectedChainId?: number;
}) {
  const pathname = usePathname();
  const legacyScreen = pathname.startsWith("/jobs") || pathname.startsWith("/merchant");
  const targetChainId = expectedChainId ?? (legacyScreen ? WHITECHAIN_ID : ARKIV_RABDI_ID);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();
  const session = useSession();
  const login = useLogin(legacyScreen ? "legacy" : "briefmint");
  const logout = useLogout();

  const sessionAddress = session.address;
  const wrongNetwork = isConnected && chainId !== targetChainId;

  return (
    <div className="wallet">
      {!isConnected ? (
        <div className="wallet-row">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isConnecting}
              onClick={() => connect({ connector })}
            >
              {isConnecting ? "Connecting…" : `Connect ${connector.name === "Injected" ? "wallet" : connector.name}`}
            </button>
          ))}
        </div>
      ) : (
        <div className="wallet-row">
          <span className="wallet-chip" title={address}>
            <span className="wallet-dot" aria-hidden="true" />
            {address ? truncateAddress(address) : "-"} <span className="wallet-chain">{chainLabel(chainId)}</span>
          </span>
          {legacyScreen && <>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={isSwitching || chainId === WHITECHAIN_ID}
            onClick={() => switchChain({ chainId: WHITECHAIN_ID })}
            title="Legacy checkout network"
          >
            {whitechain.name}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={isSwitching || chainId === ARKIV_RABDI_ID}
            onClick={() => switchChain({ chainId: ARKIV_RABDI_ID })}
            title="Arkiv publication network"
          >
            {arkivChain.name}
          </button>
          </>}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      )}

      {wrongNetwork && (
        <p role="status" className="wallet-warn">
          Wrong network: this screen expects {chainLabel(targetChainId)}.{" "}
          <button
            type="button"
            className="btn btn-sm"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: targetChainId })}
          >
            {isSwitching ? "Switching…" : `Switch to ${chainLabel(targetChainId)}`}
          </button>
        </p>
      )}

      <div className="wallet-row">
        {session.loading ? (
          <span className="wallet-hint">Checking session…</span>
        ) : sessionAddress ? (
          <>
            <span className="wallet-hint" title={sessionAddress}>Signed in as {truncateAddress(sessionAddress)}</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </button>
          </>
        ) : isConnected && address ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={login.isPending || wrongNetwork || !!session.blockedReason}
              onClick={() => login.mutate(address)}
              title="Sign a login challenge (not a payment authorization)"
            >
              {login.isPending ? "Signing…" : "Log in with wallet"}
            </button>
            {login.isError && <span role="alert" className="wallet-warn">{login.error instanceof Error ? login.error.message : "Login failed."}</span>}
          </>
        ) : (
          <span className="wallet-hint">Connect a wallet, then sign in.</span>
        )}
      </div>

      {session.blockedReason && (
        <p role="alert" className="wallet-warn">
          {session.blockedReason} Private access is blocked.
          <button type="button" className="btn btn-sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
            {logout.isPending ? "Ending session…" : "Retry logout"}
          </button>
        </p>
      )}

      {connectError && <p role="alert" className="wallet-warn">{connectError.message}</p>}
      {switchError && <p role="alert" className="wallet-warn">{switchError.message}</p>}
      {logout.isError && (
        <p role="alert" className="wallet-warn">
          Logout did not reach the server, but local private state was cleared.
        </p>
      )}
    </div>
  );
}
