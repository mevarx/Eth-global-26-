"use client";
// BriefMint glass dashboard for the city HUD. Derived from the reference adjustable glass
// dashboard (inline style block, glass tokens, tabs, segment controls, toast) with BriefMint content.
// PROPS-ONLY: it receives data, existing handlers and existing components as slots and never calls
// APIs. The city scene is the backdrop (no shader, no background image); colors are fixed --bm-*
// tokens (no light-dark()).
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  LayoutDashboard,
  Layers,
  ListChecks,
  Maximize2,
  Megaphone,
  Plus,
  X,
  FileText,
} from "lucide-react";
import OpportunityCard from "@/components/opportunities/OpportunityCard";
import OpportunityFilters from "@/components/opportunities/OpportunityFilters";
import { EmptyPanel, FailedPanel, LoadingPanel, StaleBanner } from "@/components/opportunities/OpportunityStates";
import { StatusChip } from "@/components/opportunities/StatusChip";
import { DEFAULT_FILTERS, parseTimestamp } from "@/components/opportunities/opportunity-format";
import { filterOpportunities } from "@/lib/shared/briefmint-validation";
import type {
  BriefSummary,
  BriefView,
  BriefmintConfig,
  OpportunityFilters as Filters,
  OpportunityView,
} from "@/lib/shared/briefmint";
import { dispatchCityOverlay } from "./overlay-signal";
import {
  PANEL_TABS,
  STAGE_STATE_LABEL,
  activeStage,
  briefStateChips,
  chipsFromView,
  deriveReadiness,
  derivePipeline,
  derivePublicFootprint,
  nextTabIndex,
  opportunitiesViewState,
  recentBriefs,
  sessionLabel,
  type ChipTone,
  type FootprintValue,
  type PanelTab,
  type StageState,
  type StateChip,
} from "./briefmint-panel-data";
import { cityInputFromBrief } from "@/components/city/city-state";

gsap.registerPlugin(useGSAP);

export type { PanelTab };

export interface BriefMintGlassPanelProps {
  /** "panel": right HUD panel (about 420px, scrolls inside itself) with an Expand button. "overlay": the wide dashboard, always expanded. */
  variant: "panel" | "overlay";
  tab?: PanelTab;
  defaultTab?: PanelTab;
  onTabChange?: (tab: PanelTab) => void;
  session: { address: string | null; loading?: boolean };
  config: BriefmintConfig | null;
  configError: string | null;
  briefs: BriefSummary[];
  briefsLoading: boolean;
  briefsError?: boolean;
  /** Active or selected brief: drives the pipeline stepper and the selected-brief actions. */
  brief: BriefView | null;
  onSelectBrief?: (id: string) => void;
  /** The existing BriefIntakeForm element. */
  intake: ReactNode;
  /** Existing ReleaseDesk / BriefReview / OpportunityPublisher / BriefEvidence elements for `brief`. */
  briefActions?: ReactNode;
  /** The existing next-action handler (compile, retry, review, publish...). */
  nextAction?: { label: string; run: () => void; busy?: boolean } | null;
  runError?: string | null;
  opportunities: OpportunityView[];
  opportunitiesLoading: boolean;
  opportunitiesError: string | null;
  opportunitiesStale: boolean;
  lastRefresh: string | null;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onRefresh: () => void;
  selectedOpportunityKey?: string | null;
  onSelectOpportunity?: (o: OpportunityView) => void;
  /** Existing OpportunityReader (and similar registry tools). */
  opportunityTools?: ReactNode;
  /** Explainer content supplied by the explainer landmarks. */
  explain?: ReactNode;
  /** Extra header content, e.g. the console nav and wallet controls. */
  headerExtra?: ReactNode;
  /** True only behind NEXT_PUBLIC_ENABLE_DEV_FIXTURES: shows the FIXTURE DATA label. */
  fixture?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  className?: string;
}

const TAB_ICON = {
  overview: LayoutDashboard,
  briefs: FileText,
  opportunities: Megaphone,
  explain: BookOpen,
} as const;

const STAGE_ICON: Record<StageState, typeof Check> = {
  done: Check,
  current: CircleDot,
  upcoming: CircleDashed,
  blocked: CircleAlert,
  stale: Clock,
  unavailable: CircleAlert,
};

const TONE_ICON: Record<ChipTone, typeof Check> = {
  ok: CircleCheck,
  warn: Clock,
  danger: CircleAlert,
  info: CircleDot,
  muted: CircleDashed,
};

function Chips({ chips }: { chips: StateChip[] }) {
  return (
    <>
      {chips.map((c) => {
        const Icon = TONE_ICON[c.tone];
        return (
          <StatusChip key={c.key} tone={c.tone} icon={<Icon size={14} aria-hidden="true" />}>
            {c.label}
          </StatusChip>
        );
      })}
    </>
  );
}

function FootprintTile({ label, value }: { label: string; value: FootprintValue }) {
  return (
    <div className="bmg-tile">
      <span className="bmg-tile-label">{label}</span>
      {value.kind === "count" ? (
        <>
          <strong className="bmg-tile-value bm-num">{value.value}</strong>
          {(value.stale || value.scope) && (
            <span className="bmg-tile-note">{[value.stale ? "Stale read" : null, value.scope].filter(Boolean).join(" · ")}</span>
          )}
        </>
      ) : value.kind === "checking" ? (
        <>
          <strong className="bmg-tile-value">…</strong>
          <span className="bmg-tile-note">Reading Arkiv</span>
        </>
      ) : (
        <>
          <strong className="bmg-tile-word">Unavailable</strong>
          <span className="bmg-tile-note">{value.reason}</span>
        </>
      )}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section className={`bmg-card bmg-reveal ${className}`.trim()} aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

export default function BriefMintGlassPanel(props: BriefMintGlassPanelProps) {
  const {
    variant, session, config, configError, briefs, briefsLoading, briefsError, brief, onSelectBrief,
    intake, briefActions, nextAction, runError, opportunities, opportunitiesLoading, opportunitiesError,
    opportunitiesStale, lastRefresh, filters, onFiltersChange, onRefresh, selectedOpportunityKey,
    onSelectOpportunity, opportunityTools, explain, headerExtra, fixture = false, onExpand, onClose, className = "",
  } = props;

  const id = useId().replace(/:/g, "");
  const shell = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [localTab, setLocalTab] = useState<PanelTab>(props.defaultTab ?? "overview");
  const tab = props.tab ?? localTab;
  const [expanded, setExpanded] = useState(false);
  const mode = variant === "overlay" || expanded ? "overlay" : "panel";
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(!brief && briefs.length === 0);
  const [notice, setNotice] = useState("");
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [seenRefresh, setSeenRefresh] = useState(lastRefresh);
  /** Latest close handler for the document-level Escape/focus-trap listener (kept fresh below). */
  const collapseRef = useRef(() => {});
  const collapse = () => {
    if (variant === "panel") setExpanded(false);
    onClose?.();
    toggle.current?.focus();
  };

  // A refresh the user asked for ends with a real timestamp: announce that, nothing invented.
  if (lastRefresh !== seenRefresh) {
    setSeenRefresh(lastRefresh);
    if (awaitingRefresh && lastRefresh) {
      setAwaitingRefresh(false);
      setNotice("Opportunities refreshed.");
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (mode === "overlay") toggle.current?.focus();
  }, [mode]);

  // Stacking contract: tell the city scene while the dialog is open (scene + labels go inert),
  // keep Tab focus inside the dialog, and close on Escape even when focus was lost to the body.
  useEffect(() => {
    dispatchCityOverlay(mode === "overlay");
    return () => dispatchCityOverlay(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "overlay") return;
    const focusable = () =>
      Array.from(
        shell.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]):not([aria-hidden='true']), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        const target = e.target as Element | null;
        if (target?.closest?.(".bmg-pop")) return; // the glass popover closes itself first
        e.stopPropagation();
        collapseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = shell.current?.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // collapse stays in this component and closes over this mode only.
  }, [mode]);

  // The trap listener reads only the ref, so it never goes stale without re-subscribing.
  useEffect(() => {
    collapseRef.current = collapse;
  });

  // The engine pans/zooms from native listeners on the scene host: keep panel gestures to the panel.
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("pointerdown", stop);
    el.addEventListener("wheel", stop, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
    };
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = content.current?.querySelectorAll(".bmg-reveal");
        if (!items?.length) return;
        gsap.fromTo(
          items,
          { y: 10, opacity: 0.4 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: "power3.out", clearProps: "transform,opacity" },
        );
      });
      return () => mm.revert();
    },
    { scope: shell, dependencies: [tab, mode], revertOnUpdate: true },
  );

  const changeTab = (next: PanelTab) => {
    setLocalTab(next);
    props.onTabChange?.(next);
  };
  const expand = () => {
    setExpanded(true);
    onExpand?.();
  };
  const refresh = () => {
    setAwaitingRefresh(true);
    onRefresh();
  };
  const onShellKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && mode === "overlay") {
      e.stopPropagation();
      collapse();
    }
  };

  const stages = derivePipeline(cityInputFromBrief(brief));
  const stage = activeStage(stages);
  const readiness = deriveReadiness(config, configError);
  const owner = session.address;
  const footprint = derivePublicFootprint({
    ownerAddress: owner,
    opportunities,
    loading: opportunitiesLoading,
    error: opportunitiesError,
    stale: opportunitiesStale,
    lastRefreshedAt: lastRefresh,
    filters,
  });
  const visible = filterOpportunities(opportunities, { ...filters, query });
  const list = opportunitiesViewState({
    loading: opportunitiesLoading,
    error: opportunitiesError,
    stale: opportunitiesStale,
    total: opportunities.length,
    shown: visible.length,
    hasRead: lastRefresh !== null,
  });
  const lastRefreshedAt = parseTimestamp(lastRefresh);
  const recent = recentBriefs(briefs, 3);

  const pickBrief = (briefId: string, goTo?: PanelTab) => {
    onSelectBrief?.(briefId);
    if (goTo) changeTab(goTo);
  };

  const nextButton = nextAction && (
    <button type="button" className="bm-btn bm-btn--primary" disabled={nextAction.busy} onClick={nextAction.run}>
      {nextAction.label}
    </button>
  );
  const runErrorNote = runError && (
    <p className="bmg-error" role="alert">
      <CircleAlert size={16} aria-hidden="true" /> {runError}
    </p>
  );

  const briefRows = (items: BriefSummary[], goTo?: PanelTab) => (
    <ul className="bmg-list">
      {items.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            className="bmg-row"
            aria-pressed={brief?.id === b.id}
            onClick={() => pickBrief(b.id, goTo)}
            disabled={!onSelectBrief}
          >
            <span className="bmg-row-title">{b.title}</span>
            <span className="bmg-row-meta">
              <span className="bm-num">r{b.draftRevision}</span>
              <span>{b.category === "design" ? "Design" : "Writing"}</span>
            </span>
            <span className="bmg-chips">
              <Chips chips={briefStateChips(b)} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const briefsStatus = (children: ReactNode) => <p className="bmg-note" role="status">{children}</p>;
  const briefListBody = !owner
    ? briefsStatus("Sign in to see your briefs.")
    : briefsLoading
      ? briefsStatus("Loading briefs…")
      : briefsError
        ? briefsStatus("Brief list unavailable. This does not mean briefs were removed.")
        : null;

  const overview = (
    <div className="bmg-grid bmg-grid--two">
      <Card title="Pipeline" className="bmg-span-2">
        <ol className="bmg-stepper" aria-label="Brief pipeline">
          {stages.map((s) => {
            const Icon = STAGE_ICON[s.state];
            return (
              <li
                key={s.id}
                data-state={s.state}
                aria-current={stage?.id === s.id ? "step" : undefined}
                aria-label={`${s.label}: ${STAGE_STATE_LABEL[s.state]}`}
              >
                <span className="bmg-marker">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="bmg-step-label">{s.label}</span>
                <span className="bmg-step-state">{STAGE_STATE_LABEL[s.state]}</span>
              </li>
            );
          })}
        </ol>
        <div aria-live="polite">
          <p className="bmg-brief-line">
            {brief ? (
              <>
                <strong>{brief.publicParameters.title}</strong> <span className="bm-num">r{brief.draftRevision}</span>
              </>
            ) : (
              "No active brief."
            )}
          </p>
          <p className="bmg-muted">
            {stage ? `${stage.label}: ${stage.detail}` : brief ? "All stages are complete in the saved record." : stages[0].detail}
          </p>
        </div>
        {(nextButton || runErrorNote) && (
          <div className="bmg-actions">
            {nextButton}
            {runErrorNote}
          </div>
        )}
      </Card>

      <Card title="Readiness">
        <ul className="bmg-list" aria-live="polite">
          {readiness.map((r) => (
            <li key={r.id} className="bmg-ready">
              <span className="bmg-ready-main">
                <strong>{r.label}</strong>
                <span className="bmg-muted">{r.detail}</span>
              </span>
              <StatusChip
                tone={r.state === "ok" ? "ok" : r.state === "checking" ? "muted" : "warn"}
                icon={
                  r.state === "ok" ? (
                    <CircleCheck size={14} aria-hidden="true" />
                  ) : r.state === "checking" ? (
                    <CircleDashed size={14} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={14} aria-hidden="true" />
                  )
                }
              >
                {r.state === "ok" ? "Ready" : r.state === "checking" ? "Checking" : "Unavailable"}
              </StatusChip>
            </li>
          ))}
        </ul>
        <p className="bmg-muted bmg-foot">{sessionLabel(owner, Boolean(session.loading))}</p>
      </Card>

      <Card title="Public footprint">
        <div className="bmg-tiles">
          <FootprintTile label="Live" value={footprint.live} />
          <FootprintTile label="Closed" value={footprint.closed} />
        </div>
        <p className="bmg-muted bmg-foot">Your opportunities in the current Arkiv read.</p>
      </Card>

      <Card title="Recent briefs" className="bmg-span-2">
        {briefListBody ??
          (recent.length ? (
            briefRows(recent, "briefs")
          ) : (
            briefsStatus("No briefs yet. Start one in the Briefs tab.")
          ))}
      </Card>
    </div>
  );

  const briefsTab = (
    <div className="bmg-grid">
      <Card title="New brief">
        <button
          type="button"
          className="bm-btn bm-btn--ghost"
          aria-expanded={newOpen}
          aria-controls={`${id}-intake`}
          onClick={() => setNewOpen((v) => !v)}
        >
          <Plus size={16} aria-hidden="true" /> {newOpen ? "Hide the form" : "New brief"}
        </button>
        <div id={`${id}-intake`} className="bmg-intake" hidden={!newOpen}>
          {intake}
        </div>
      </Card>

      <Card title="Your briefs">
        {briefListBody ?? (briefs.length ? briefRows(briefs) : briefsStatus("No briefs yet. Save private notes with the form above."))}
      </Card>

      {brief && (
        <Card title="Selected brief">
          <p className="bmg-brief-line">
            <strong>{brief.publicParameters.title}</strong> <span className="bm-num">r{brief.draftRevision}</span>
          </p>
          <p className="bmg-chips">
            <Chips chips={briefStateChips(chipsFromView(brief))} />
          </p>
          <div className="bmg-actions">
            {nextButton}
            <Link className="bm-btn" href={`/briefs/${brief.id}`}>
              Open full brief
            </Link>
          </div>
          {runErrorNote}
          {briefActions && <div className="bmg-slot">{briefActions}</div>}
        </Card>
      )}
    </div>
  );

  const opportunitiesTab = (
    <div className="bmg-grid">
      <div className="bmg-reveal">
        <OpportunityFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          query={query}
          onQueryChange={setQuery}
          onRefresh={refresh}
          loading={opportunitiesLoading}
          shownCount={visible.length}
          totalCount={opportunities.length}
        />
      </div>
      {list.kind === "loading" && <LoadingPanel count={3} />}
      {list.kind === "failed" && (
        <FailedPanel message={opportunitiesError ?? "The Arkiv read failed."} onRetry={refresh} busy={opportunitiesLoading} />
      )}
      {list.kind === "empty" && <EmptyPanel />}
      {list.kind === "stale" && <StaleBanner message={opportunitiesError} />}
      {list.kind === "no-match" && (
        <EmptyPanel
          filtered
          onReset={() => {
            setQuery("");
            onFiltersChange({ ...DEFAULT_FILTERS });
          }}
        />
      )}
      {(list.kind === "ready" || list.kind === "stale") && visible.length > 0 && (
        <ul className="bmg-cards" aria-label="Opportunities">
          {visible.map((o) => (
            <li key={o.entityKey}>
              <OpportunityCard
                opportunity={o}
                freshness={opportunitiesStale ? "stale" : o.freshness}
                lastRefreshedAt={lastRefreshedAt}
                selected={o.entityKey === selectedOpportunityKey}
                onSelect={onSelectOpportunity}
                compact
              />
            </li>
          ))}
        </ul>
      )}
      {list.kind === "stale" && visible.length === 0 && (
        <EmptyPanel
          filtered
          onReset={() => {
            setQuery("");
            onFiltersChange({ ...DEFAULT_FILTERS });
          }}
        />
      )}
      {opportunityTools && <div className="bmg-slot bmg-reveal">{opportunityTools}</div>}
    </div>
  );

  const explainTab = explain ? (
    <div className="bmg-reveal">{explain}</div>
  ) : (
    <Card title="Explain">
      <p className="bmg-muted">Explainers are not available in this view.</p>
    </Card>
  );

  const tabIndex = Math.max(0, PANEL_TABS.findIndex((t) => t.id === tab));

  return (
    <div className={`bmg-host ${className}`.trim()} data-mode={mode}>
      <style>{STYLES}</style>
      {mode === "overlay" && <div className="bmg-scrim" aria-hidden="true" onClick={collapse} />}
      <section
        ref={shell}
        className="bmg-shell bm-glass bm-glass--text"
        data-mode={mode}
        role={mode === "overlay" ? "dialog" : "region"}
        aria-label="BriefMint dashboard"
        onKeyDown={onShellKey}
      >
        <header className="bmg-top">
          <div className="bmg-brand">
            <span className="bmg-brand-icon">
              <Layers size={18} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div>
              <h2>BriefMint</h2>
              <span className="bmg-brand-sub">Private notes to public opportunity</span>
            </div>
          </div>
          <div className="bmg-toolbar">
                        <button
              ref={toggle}
              type="button"
              className="bm-btn bm-btn--ghost"
              aria-expanded={variant === "panel" ? mode === "overlay" : undefined}
              onClick={mode === "overlay" ? collapse : expand}
            >
              {mode === "overlay" ? <X size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
              <span>{mode === "overlay" ? "Close" : "Expand"}</span>
              <span className="bm-sr-only">{mode === "overlay" ? "expanded dashboard" : "dashboard"}</span>
            </button>
          </div>
        </header>
        {headerExtra && <div className="bmg-extra">{headerExtra}</div>}
        <div className="bmg-tabs" role="tablist" aria-label="BriefMint views">
          {PANEL_TABS.map((t, i) => {
            const Icon = TAB_ICON[t.id];
            return (
              <button
                key={t.id}
                id={`${id}-tab-${t.id}`}
                type="button"
                role="tab"
                title={t.label}
                aria-selected={tab === t.id}
                aria-controls={`${id}-panel`}
                tabIndex={i === tabIndex ? 0 : -1}
                onClick={() => changeTab(t.id)}
                onKeyDown={(e) => {
                  const next = nextTabIndex(e.key, i, PANEL_TABS.length);
                  if (next === null) return;
                  e.preventDefault();
                  changeTab(PANEL_TABS[next].id);
                  (e.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined)?.focus();
                }}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div
          ref={content}
          id={`${id}-panel`}
          className="bmg-body"
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab}`}
          tabIndex={0}
        >
          {fixture && (
            <p className="bmg-fixture" role="note">
              <ListChecks size={16} aria-hidden="true" /> FIXTURE DATA: visual check only, not live records.
            </p>
          )}
          {tab === "overview" && overview}
          {tab === "briefs" && briefsTab}
          {tab === "opportunities" && opportunitiesTab}
          {tab === "explain" && explainTab}
        </div>
        {notice && (
          <div className="bmg-toast" role="status">
            <Check size={16} aria-hidden="true" />
            {notice}
          </div>
        )}
      </section>
    </div>
  );
}

// Glass material is fixed by the --bm-glass-* tokens in src/styles/briefmint-tokens.css.
// (The former glass-appearance control and provider were removed;
// the recipe now binds directly to the fixed frosted tokens.)
// Bare glass carries text-primary only; secondary copy sits on .bmg-card wells (navy at 70%).
const STYLES = `
.bmg-host { display: block; height: 100%; min-height: 0; pointer-events: none; }
.bmg-host *, .bmg-host *::before, .bmg-host *::after { box-sizing: border-box; }
.bmg-host .bmg-shell {
  pointer-events: auto;
  container: bmg / inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--bm-radius-lg);
  color: var(--bm-text-primary);
  font: 400 var(--bm-text-sm)/var(--bm-leading) var(--bm-font-body);
}
.bmg-host .bmg-shell[data-mode="overlay"] {
  position: fixed;
  inset: 0;
  margin: auto;
  z-index: var(--z-overlay);
  width: min(1100px, 92vw);
  height: min(86svh, 860px);
  max-height: none;
  animation: bmg-in 0.22s ease-out;
}
.bmg-scrim { position: fixed; inset: 0; z-index: var(--z-scrim); background: var(--bm-scrim); pointer-events: auto; }
@keyframes bmg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.bmg-shell button, .bmg-shell a { font: inherit; }
.bmg-shell button { cursor: pointer; }
.bmg-shell button:disabled { cursor: not-allowed; opacity: 0.55; }
.bmg-shell :focus-visible { outline: var(--bm-focus-ring); outline-offset: var(--bm-focus-offset); }
.bmg-top { display: flex; align-items: center; justify-content: space-between; gap: var(--bm-space-3); flex-wrap: wrap; padding: var(--bm-space-3) var(--bm-space-4); border-bottom: 1px solid var(--bm-line); }
.bmg-brand { display: flex; align-items: center; gap: var(--bm-space-3); min-width: 0; }
.bmg-brand h2 { margin: 0; font: 600 var(--bm-text-lg)/1.2 var(--bm-font-heading); }
.bmg-brand-sub { display: block; font-size: var(--bm-text-xs); }
.bmg-brand-icon { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: var(--bm-radius-sm); background: var(--bm-accent); color: var(--bm-on-accent); }
.bmg-toolbar { display: flex; align-items: center; gap: var(--bm-space-2); flex-wrap: wrap; }
.bmg-extra { padding: var(--bm-space-2) var(--bm-space-4); border-bottom: 1px solid var(--bm-line); }
.bmg-tabs { display: flex; align-items: stretch; gap: var(--bm-space-1); padding: var(--bm-space-2) var(--bm-space-3); border-bottom: 1px solid var(--bm-line); }
/* Equal-width flexible tabs: the tablist always fits the panel, never clips or scrolls. */
.bmg-tabs button {
  flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  min-height: var(--bm-touch); padding: 0 var(--bm-space-2);
  border: 1px solid transparent; border-radius: 999px; background: none; color: var(--bm-text-primary);
  font-weight: 600; font-size: var(--bm-text-xs); white-space: nowrap;
}
.bmg-tabs button > span { overflow: hidden; text-overflow: ellipsis; }
.bmg-tabs button:hover { background: color-mix(in srgb, var(--bm-text-primary) 10%, transparent); }
.bmg-tabs button[aria-selected="true"] { border-color: var(--bm-accent); background: color-mix(in srgb, var(--bm-accent) 30%, var(--bm-bg-1)); color: var(--bm-text-primary); }
/* Narrow panels (including the ~420px HUD panel and small-screen overlays): drop the labels visually but
   keep them for assistive tech and let the icon-only tab carry the full label as a tooltip. */
@container bmg (max-width: 439.9px) {
  .bmg-tabs button > span {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
}
.bmg-body { flex: 1; min-height: 0; overflow: auto; scrollbar-width: thin; padding: var(--bm-space-4); display: grid; gap: var(--bm-space-4); align-content: start; }
.bmg-grid { display: grid; gap: var(--bm-space-4); grid-template-columns: minmax(0, 1fr); align-content: start; }
@container bmg (min-width: 760px) {
  .bmg-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bmg-span-2 { grid-column: 1 / -1; }
  .bmg-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.bmg-card { min-width: 0; padding: var(--bm-space-4); border: 1px solid var(--bm-line); border-radius: var(--bm-radius-md); background: color-mix(in srgb, var(--bm-bg-1) 70%, transparent); color: var(--bm-text-primary); }
.bmg-card h3 { margin: 0 0 var(--bm-space-3); color: var(--bm-text-secondary); font: 600 var(--bm-text-xs)/1.3 var(--bm-font-body); letter-spacing: var(--bm-tag-tracking); text-transform: uppercase; }
.bmg-card p { margin: var(--bm-space-2) 0 0; }
.bmg-muted { color: var(--bm-text-secondary); }
.bmg-foot { font-size: var(--bm-text-xs); }
.bmg-note { margin: 0; color: var(--bm-text-secondary); }
.bmg-brief-line { margin: var(--bm-space-3) 0 0; overflow-wrap: anywhere; }
.bmg-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--bm-space-3); margin-top: var(--bm-space-3); }
.bmg-error { display: flex; align-items: center; gap: var(--bm-space-2); margin: 0; color: var(--bm-danger); }
.bmg-stepper { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--bm-space-1); margin: 0; padding: 0; list-style: none; }
.bmg-stepper li { position: relative; display: grid; justify-items: center; gap: 2px; text-align: center; }
.bmg-stepper li:not(:last-child)::after { content: ""; position: absolute; top: 15px; left: calc(50% + 20px); right: calc(-50% + 20px); height: 2px; background: var(--bm-line-strong); }
.bmg-stepper li[data-state="done"]:not(:last-child)::after { background: var(--bm-success); }
.bmg-marker { display: grid; place-items: center; width: 32px; height: 32px; border: 2px solid var(--bm-line-strong); border-radius: 50%; background: var(--bm-bg-1); color: var(--bm-text-primary); }
.bmg-stepper li[data-state="done"] .bmg-marker { border-color: var(--bm-success); color: var(--bm-success); }
.bmg-stepper li[data-state="current"] .bmg-marker { border-color: var(--bm-accent); color: var(--bm-accent); }
.bmg-stepper li[data-state="blocked"] .bmg-marker { border-color: var(--bm-danger); color: var(--bm-danger); }
.bmg-stepper li[data-state="stale"] .bmg-marker, .bmg-stepper li[data-state="unavailable"] .bmg-marker { border-color: var(--bm-warning); color: var(--bm-warning); }
.bmg-step-label { font-weight: 600; }
.bmg-step-state { color: var(--bm-text-secondary); font-size: var(--bm-text-xs); }
.bmg-list { display: grid; gap: var(--bm-space-2); margin: 0; padding: 0; list-style: none; }
.bmg-ready { display: flex; align-items: center; justify-content: space-between; gap: var(--bm-space-3); }
.bmg-ready-main { display: grid; min-width: 0; }
.bmg-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--bm-space-3); }
.bmg-tile { display: grid; align-content: start; gap: 2px; padding: var(--bm-space-3); border: 1px solid var(--bm-line); border-radius: var(--bm-radius-sm); }
.bmg-tile-label { color: var(--bm-text-secondary); font-size: var(--bm-text-xs); letter-spacing: var(--bm-tag-tracking); text-transform: uppercase; }
.bmg-tile-value { font: 600 28px/1.1 var(--bm-font-heading); }
.bmg-tile-word { font-weight: 600; }
.bmg-tile-note { color: var(--bm-text-secondary); font-size: var(--bm-text-xs); }
.bmg-row { display: grid; gap: 4px; width: 100%; padding: var(--bm-space-3); border: 1px solid var(--bm-line); border-radius: var(--bm-radius-sm); background: none; color: inherit; text-align: left; }
.bmg-row:hover:not(:disabled) { background: color-mix(in srgb, var(--bm-text-primary) 8%, transparent); }
.bmg-row[aria-pressed="true"] { border-color: var(--bm-accent); }
.bmg-row-title { font-weight: 600; overflow-wrap: anywhere; }
.bmg-row-meta { display: flex; gap: var(--bm-space-3); color: var(--bm-text-secondary); font-size: var(--bm-text-xs); }
.bmg-chips { display: flex; flex-wrap: wrap; gap: var(--bm-space-1); }
.bmg-intake { margin-top: var(--bm-space-3); }
.bmg-intake[hidden] { display: none; }
.bmg-slot { display: grid; gap: var(--bm-space-3); margin-top: var(--bm-space-3); min-width: 0; overflow-wrap: anywhere; }
.bmg-cards { display: grid; gap: var(--bm-space-3); grid-template-columns: minmax(0, 1fr); margin: 0; padding: 0; list-style: none; }
.bmg-shell .opp-filters { position: static; }
.bmg-fixture { display: flex; align-items: center; gap: var(--bm-space-2); margin: 0; padding: var(--bm-space-2) var(--bm-space-3); border: 1px dashed var(--bm-warning); border-radius: var(--bm-radius-sm); background: color-mix(in srgb, var(--bm-bg-1) 85%, transparent); color: var(--bm-warning); font-weight: 600; }
.bmg-toast { position: absolute; left: 50%; bottom: var(--bm-space-4); transform: translateX(-50%); z-index: var(--z-toasts); display: flex; align-items: center; gap: var(--bm-space-2); max-width: calc(100% - 24px); padding: var(--bm-space-3) var(--bm-space-4); border-radius: var(--bm-radius-md); background: var(--bm-accent); color: var(--bm-on-accent); font-weight: 600; }
@media (max-width: 700px) {
  .bmg-shell[data-mode="overlay"] { width: 96vw; height: 92svh; }
  .bmg-top { padding: var(--bm-space-2) var(--bm-space-3); }
  .bmg-body { padding: var(--bm-space-3); }
}
@media (max-height: 550px) { .bmg-shell[data-mode="overlay"] { height: 96svh; } }
@media (prefers-reduced-motion: reduce) { .bmg-shell[data-mode="overlay"] { animation: none; } }
`;
