/** A cookie alone never grants access to private UI restored in another wallet. */
export function sessionMatchesWallet(sessionAddress: string | null | undefined,
  walletAddress: string | undefined, status: string): boolean {
  return status === "connected" && !!sessionAddress && !!walletAddress
    && sessionAddress.toLowerCase() === walletAddress.toLowerCase();
}
