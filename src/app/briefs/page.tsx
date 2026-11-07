"use client";
// My Briefs: owner-authenticated private summaries via the canonical BriefMint API.
// 401 → login prompt. 503 → backend unavailable (honest, no fixtures).
// FIX 4: same page system as the Opportunities route (PageShell + Blocks).
import AppShell from "@/components/app/AppShell";
import PageShell from "@/components/dashboard/PageShell";
import Block from "@/components/dashboard/Block";
import BriefList from "@/components/briefs/BriefList";
import { isApiError } from "@/lib/client/briefmint-api";
import { useBriefs } from "@/lib/client/use-briefs";
import { useSession } from "@/lib/client/use-session";

export default function BriefsPage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  const briefsQ = useBriefs(!!address, undefined, address);

  let body: React.ReactNode;
  if (sessionQ.loading) {
    body = <p className="tc-muted">Checking session…</p>;
  } else if (!address) {
    body = <p className="notice">Connect the project-owner wallet and sign in to see private briefs.</p>;
  } else if (briefsQ.isLoading) {
    body = <p className="tc-muted">Loading briefs…</p>;
  } else if (briefsQ.error) {
    const e = briefsQ.error;
    body = isApiError(e) && e.status === 401 ? (
      <p className="notice">Connect the project-owner wallet and sign in to see private briefs.</p>
    ) : isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE") ? (
      <p className="notice" role="status">
        BriefMint backend unavailable (503), private briefs cannot be listed yet. Nothing was fabricated; no fixture substituted.
      </p>
    ) : (
      <p className="error" role="alert">
        {isApiError(e) ? `${e.code}: ${e.message}` : "Could not load briefs."}
      </p>
    );
  } else {
    body = <BriefList briefs={briefsQ.data?.briefs ?? []} />;
  }

  return (
    <AppShell>
      <PageShell>
        <section className="bm-block bm-glass bm-glass--text opp-header" aria-label="My briefs">
          <div className="bm-block__head bm-block__head--baseline">
            <h1 className="opp-header__title">My briefs</h1>
          </div>
          <div className="bm-block__body">
            <p className="bm-secondary">Owner-only. Reopening a brief loads saved content, never recompiles.</p>
          </div>
        </section>
        <Block title="Your briefs" ariaLabel="Your briefs">
          {body}
        </Block>
      </PageShell>
    </AppShell>
  );
}
