import Link from "next/link";
import WalletControls from "../wallet/WalletControls";
import NavLinks from "./NavLinks";

// Shell for the non-city pages: a HUD top bar and a thin status footer.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="BriefMint city">
            <span className="brand-tick" aria-hidden="true" />
            <span className="brand-name">BriefMint</span>
            <span className="brand-sub">Tool City</span>
          </Link>
          <NavLinks />
          <div className="topbar-actions">
            <WalletControls />
          </div>
        </div>
      </header>
      <main id="main" className="site-main">
        {children}
      </main>
      <footer className="statusbar">
        <span>BriefMint · ETHGlobal Mumbai</span>
        <span>Promotional credits · unfunded budgets · owner-signed Arkiv records</span>
        <span className="statusbar-links">Private-to-public briefs · no checkout</span>
      </footer>
    </div>
  );
}
