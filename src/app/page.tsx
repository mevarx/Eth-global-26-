"use client";
// Home: BriefMint city, real opportunity discovery (independent Arkiv reads
// with backend list when available) plus the city and selected-building panel.
// Loading / failed / empty states stay distinct; a failed refresh never proves
// withdrawal, expiry, or deletion.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NavLinks from "@/components/app/NavLinks";
import WalletControls from "@/components/wallet/WalletControls";
import BriefEvidence from "@/components/briefs/BriefEvidence";
import BriefIntakeForm from "@/components/briefs/BriefIntakeForm";
import OpportunityPublisher from "@/components/briefs/OpportunityPublisher";
import OpportunityReader from "@/components/briefs/OpportunityReader";
import ReleaseDesk from "@/components/briefs/ReleaseDesk";
import CityScene from "@/components/city/CityScene";
import { briefStateToScene } from "@/components/city/brief-state-to-scene";
import type { ExplainerId } from "@/components/city/explainers";
import type { BuildingId } from "@/components/city/scene-config";
import BriefMintGlassPanel, { type PanelTab } from "@/components/hud/BriefMintGlassPanel";
import ExplainerPanel from "@/components/hud/ExplainerPanel";
import { briefmintApi, isApiError } from "@/lib/client/briefmint-api";
import { useOpportunities } from "@/components/use-opportunities-data";
import { useBriefs } from "@/lib/client/use-briefs";
import { useSession } from "@/lib/client/use-session";
import { isCurrentSessionGeneration, currentSessionGeneration } from "@/lib/client/session-generation";
import { devFixturesEnabled } from "@/lib/shared/fixtures";
import type { BriefFreshness, BriefmintConfig, BriefView, OpportunityFilters } from "@/lib/shared/briefmint";

const ACTIVE_BRIEF_POLL = new Set(["running", "pending"]);

// The panel tab follows the selected building.
const TAB_FOR_BUILDING: Record<BuildingId, PanelTab> = {
  home: "briefs",
  studio: "overview",
  treasury: "briefs",
  registry: "opportunities",
  archive: "briefs",
};

export default function HomePage() {
  const sessionQ = useSession();
  const address = sessionQ.address;
  // FIX 7: one shared opportunity source for the city scan, the districts and
  // the HUD panel. (The /opportunities page uses the same hook and cache.)
  const { rows: oppRows, loading: oppLoading, error: oppError, stale: oppStale,
    lastRefresh: oppLastRefresh, hasRead: oppHasRead, refresh: refreshOpportunities } = useOpportunities();
  const [briefConfig, setBriefConfig] = useState<BriefmintConfig | null>(null);
  const [briefConfigError, setBriefConfigError] = useState<string | null>(null);
  const [oppFilters, setOppFilters] = useState<OpportunityFilters>({ status: "open" });
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [building, setBuildingState] = useState<BuildingId>("home");
  const [tab, setTab] = useState<PanelTab>(TAB_FOR_BUILDING.home);
  const [explainerId, setExplainerId] = useState<ExplainerId | null>(null);
  const setBuilding = (b: BuildingId) => {
    setBuildingState(b);
    setTab(TAB_FOR_BUILDING[b]);
    setExplainerId(null);
  };
  const [storedBrief, setBrief] = useState<BriefView | null>(null);
  const brief = address && storedBrief?.ownerAddress.toLowerCase() === address.toLowerCase() ? storedBrief : null;
  const briefsQ = useBriefs(!!address, undefined, address);
  const briefSummaries = briefsQ.data?.briefs ?? [];
  const briefsLoading = briefsQ.isLoading;
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const briefOperationEpoch = useRef(0);
  const previousBriefId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await briefmintApi.config();
        if (cancelled) return;
        setBriefConfig(cfg);
      } catch (e) {
        if (cancelled) return;
        setBriefConfigError(
          isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")
            ? "BriefMint backend unavailable (503), public discovery continues via the independent Arkiv reader."
            : "BriefMint config unavailable.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh discovery when the window regains focus.
  useEffect(() => {
    const onFocus = () => {
      refreshOpportunities(oppFilters);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [oppFilters, refreshOpportunities]);

  const handleFiltersChange = useCallback(
    (f: OpportunityFilters) => {
      setOppFilters(f);
      refreshOpportunities(f);
    },
    [refreshOpportunities],
  );
  // Account change clears the prior owner's private brief UI state
  // (query caches are cleared by useSessionAccountSync in the provider).
  const prevAddress = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevAddress.current !== undefined && prevAddress.current !== address) {
      briefOperationEpoch.current += 1;
      setBrief(null);
      setRunBusy(false);
      setRunError(null);
    }
    prevAddress.current = address;
  }, [address]);

  useEffect(() => {
    if (previousBriefId.current !== undefined && previousBriefId.current !== (brief?.id ?? null)) {
      briefOperationEpoch.current += 1;
    }
    previousBriefId.current = brief?.id ?? null;
  }, [brief?.id]);

  // Poll the active brief ~2s; reopening a saved brief just loads state.
  useEffect(() => {
    if (!brief || (!ACTIVE_BRIEF_POLL.has(brief.executionStatus) && brief.publication.status !== "pending")) return;
    const epoch = briefOperationEpoch.current;
    const id = brief.id;
    const t = setInterval(async () => {
      try {
        const updated = await briefmintApi.getBrief(id, address);
        if (epoch === briefOperationEpoch.current) setBrief(updated);
      } catch {
        /* keep last known state */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [brief, address]);

  const handleRun = async () => {
    if (!brief || !address || brief.ownerAddress.toLowerCase() !== address.toLowerCase()) return;
    const epoch = briefOperationEpoch.current;
    const generation = currentSessionGeneration();
    const id = brief.id;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await briefmintApi.runBrief(id, address);
      if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) setBrief(result.brief);
    } catch (e) {
      if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) {
        setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start compilation. Retry.");
        // A failed dispatched attempt is persisted before its error is returned.
        // Refresh only the brief record so the UI shows the consumed attempt count.
        try {
          const current = await briefmintApi.getBrief(id, address);
          if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) setBrief(current);
        } catch { /* Keep the current view if the recovery read is unavailable. */ }
      }
    } finally {
      if (epoch === briefOperationEpoch.current) setRunBusy(false);
    }
  };

  // Opens a saved brief from the panel or a district house; same guards as the poll and run code.
  const handleSelectBrief = async (id: string) => {
    if (!address) return;
    const epoch = briefOperationEpoch.current;
    const generation = currentSessionGeneration();
    try {
      const loaded = await briefmintApi.getBrief(id, address);
      if (epoch === briefOperationEpoch.current && isCurrentSessionGeneration(generation)) setBrief(loaded);
    } catch {
      /* Keep the current view if the read is unavailable. */
    }
  };

  const openExplainer = (id: ExplainerId) => {
    setExplainerId(id);
    setTab("explain");
  };
  const handleTabChange = (t: PanelTab) => {
    setTab(t);
    if (t !== "explain") setExplainerId(null);
  };

  // Selection is user-driven; the first open record of the shared read is the
  // derived default (no setState effect needed).
  const selectedKey = userSelectedKey
    ?? oppRows.find((o) => o.status === "open")?.entityKey
    ?? oppRows[0]?.entityKey
    ?? null;
  const firstReadDone = oppHasRead;
  const freshness: BriefFreshness = oppError && oppRows.length === 0 ? "unavailable" : oppStale ? "stale" : "fresh";
  const scene = briefStateToScene(brief);
  const approved = brief?.review.status === "approved" && brief.review.approval?.draftRevision === brief.draftRevision;

  // The single next action for the bottom bar (existing navigation + run handler only).
  const nextAction: { label: string; run: () => void; busy?: boolean } | null = (() => {
    if (!brief) return { label: "Start a brief", run: () => setBuilding("home") };
    if (brief.executionStatus === "draft") {
      return { label: runBusy ? "Compiling…" : "Compile brief", run: handleRun, busy: runBusy };
    }
    if (brief.executionStatus === "failed" || brief.executionStatus === "interrupted") {
      if (!brief.retryEligible) return null;
      return { label: runBusy ? "Compiling…" : "Retry compilation", run: handleRun, busy: runBusy };
    }
    if (brief.executionStatus === "running") return null;
    if (brief.executionStatus === "ready" && !approved)
      return { label: "Review and approve", run: () => setBuilding("treasury") };
    if (brief.publication.status === "pending") return null;
    if (brief.publication.status === "live")
      return { label: "View live opportunity", run: () => setBuilding("registry") };
    if (brief.publication.status === "closed" || brief.publication.status === "expired")
      return { label: "View in Archive", run: () => setBuilding("archive") };
    if (brief.executionStatus === "ready" && approved)
      return { label: "Publish opportunity", run: () => setBuilding("registry") };
    return null;
  })();

  const openCount = oppRows.filter((o) => o.status === "open").length;
  const idleHint =
    brief?.executionStatus === "running"
      ? "Compiling, polling the saved record"
      : brief?.publication.status === "pending"
        ? "Waiting for on-chain confirmation"
        : "Follow the worker to continue";
  const servicesReady = briefConfig
    ? briefConfig.compilation.available && briefConfig.arkiv.readiness.available && briefConfig.auth.readiness.available
    : null;

  return (
    <div className="city-page">
      <h1 className="sr-only">BriefMint, private notes to public opportunity</h1>
      <CityScene
        selected={building}
        onSelect={setBuilding}
        scene={scene}
        scan={{ opportunities: oppRows.length, open: openCount, loading: oppLoading, stale: oppStale, error: Boolean(oppError) }}
        action={nextAction}
        idleHint={idleHint}
        notice={
          briefConfigError ? (
            <p className="notice notice-warn" role="status">{briefConfigError} Saving, compiling and publishing are unavailable until the backend responds.</p>
          ) : briefConfig && servicesReady === false ? (
            <p className="notice notice-warn" role="status">Some BriefMint services are not ready: intake, compilation or Arkiv may be unavailable.</p>
          ) : null
        }
        district={{
          briefs: address && briefsQ.data ? briefSummaries : null,
          brief,
          opportunities: firstReadDone ? oppRows : null,
          freshness,
          signedIn: Boolean(address),
          selectedId: tab === "opportunities" ? selectedKey : brief?.id ?? null,
          onSelectBrief: (id) => {
            void handleSelectBrief(id);
            handleTabChange("briefs");
          },
          onSelectOpportunity: (key) => {
            setUserSelectedKey(key);
            handleTabChange("opportunities");
          },
          onOpenTab: handleTabChange,
        }}
        explainer={{ selected: explainerId, onOpen: openExplainer }}
      >
        <BriefMintGlassPanel
          key={address ?? "logged-out"}
          variant="panel"
          tab={tab}
          onTabChange={handleTabChange}
          session={{ address, loading: sessionQ.loading }}
          config={briefConfig}
          configError={briefConfigError}
          briefs={briefSummaries}
          briefsLoading={briefsLoading}
          brief={brief}
          onSelectBrief={(id) => void handleSelectBrief(id)}
          intake={<BriefIntakeForm onCreated={(b) => { setBrief(b); setBuilding("studio"); }} />}
          briefActions={
            brief ? (
              <>
                <ReleaseDesk key={`${brief.id}:${brief.draftRevision}`} brief={brief} onSaved={setBrief} />
                <OpportunityPublisher brief={brief} onSaved={setBrief} rpcLabel="Rabdi 7794095" />
                <BriefEvidence brief={brief} />
                <Link className="bm-btn" href={`/briefs/${brief.id}`}>Open full brief</Link>
              </>
            ) : null
          }
          nextAction={nextAction}
          runError={runError}
          opportunities={oppRows}
          opportunitiesLoading={oppLoading}
          opportunitiesError={oppError}
          opportunitiesStale={oppStale}
          lastRefresh={oppLastRefresh}
          filters={oppFilters}
          onFiltersChange={handleFiltersChange}
          onRefresh={() => refreshOpportunities(oppFilters)}
          selectedOpportunityKey={selectedKey}
          onSelectOpportunity={(o) => setUserSelectedKey(o.entityKey)}
          opportunityTools={<OpportunityReader />}
          explain={<ExplainerPanel explainerId={explainerId} onClose={() => setExplainerId(null)} onSelect={openExplainer} />}
          headerExtra={
            <div className="console-top">
              <NavLinks />
              <WalletControls />
            </div>
          }
          fixture={devFixturesEnabled()}
        />
      </CityScene>
    </div>
  );
}
