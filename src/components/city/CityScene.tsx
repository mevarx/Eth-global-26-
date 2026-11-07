"use client";
// Full-screen city "emulator": the PixiJS island fills the viewport; camera-synced SVG layers
// (water life, scenery, districts, streets, landmarks) and screen-space labels sit above the
// canvas, and the glass HUD floats over everything. Every visual derives from `scene.city`
// (pure mapping of persisted state); no animation or camera callback reads or writes brief state.
import "./city.css";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import StatusChip, { type StatusTone } from "@/components/opportunities/StatusChip";
import type { BriefFreshness, BriefSummary, BriefView, OpportunityView } from "@/lib/shared/briefmint";
import { AmbientStreets, AmbientWater } from "./AmbientLife";
import { ArchiveDecor, PlanningDecor, RegistryDecor, ReleaseDecor, StudioDecor, type SceneFx } from "./BuildingDecor";
import { BuildingLabels } from "./BuildingLabels";
import { GroundAmbient, SkyAmbient } from "./CityAmbient";
import DistrictLayer from "./DistrictLayer";
import IsoBuilding from "./IsoBuilding";
import Landmarks, { landmarkLabelSpecs } from "./Landmarks";
import BuildingOcclusionMask from "./OcclusionMask";
import { Scenery, sceneryLabelSpecs } from "./Scenery";
import Worker from "./Worker";
import { createAmbientTicker, type AmbientTicker } from "./ambient-ticker";
import { sceneFromCityState, type BriefSceneTarget } from "./brief-state-to-scene";
import { createCameraStore, worldTransform } from "./camera-store";
import { CITY_FIXTURES } from "./city-fixtures";
import { deriveCityState, type CityState } from "./city-state";
import { workbenchInset } from "./city-viewport";
import { buildDistrictModel } from "./district-model";
import { EXPLAINERS, EXPLAINER_IDS, type ExplainerId } from "./explainers";
import { keyBuildingBox } from "./iso-buildings";
import { buildingLabelSpecs, estimateLabelSize, labelFontPx, type LabelSpec, type Rect } from "./label-layout";
import type { CameraState, CityEngine, MotionMode } from "./pixi/city-engine";
import { onCityOverlay } from "@/components/hud/overlay-signal";
import { stateLabelFor, tagFor, type BuildingTag } from "./scene-labels";
import { BUILDINGS, BUILDINGS_BACK_TO_FRONT, VIEWBOX, type BuildingDef, type BuildingId } from "./scene-config";

export interface ScanStats {
  opportunities: number;
  open: number;
  loading: boolean;
  stale: boolean;
  error: boolean;
}

export interface CityDistrictProps {
  /** null = not loaded or not readable. */
  briefs: BriefSummary[] | null;
  /** Full active brief (exact state for its own house). */
  brief: BriefView | null;
  /** null until the first opportunity read completes. */
  opportunities: OpportunityView[] | null;
  freshness: BriefFreshness;
  signedIn: boolean;
  selectedId: string | null;
  onSelectBrief: (id: string) => void;
  onSelectOpportunity: (entityKey: string) => void;
  onOpenTab: (tab: "briefs" | "opportunities") => void;
}

export interface CityExplainerProps {
  selected: ExplainerId | null;
  onOpen: (id: ExplainerId) => void;
}

interface CitySceneProps {
  selected: BuildingId | null;
  onSelect: (b: BuildingId) => void;
  scene: BriefSceneTarget;
  scan: ScanStats;
  /** Next real action (existing handlers only). */
  action: { label: string; run: () => void; busy?: boolean } | null;
  idleHint: string;
  notice?: ReactNode;
  district: CityDistrictProps;
  explainer: CityExplainerProps;
  /** The right HUD panel (BriefMintGlassPanel). */
  children: ReactNode;
}

const NO_FX: SceneFx = { stamp: null, stampKey: 0, scanKey: 0, boxesKey: 0 };
const FIXTURE_PREFIX = "DEV FIXTURE (not real data): ";

/** One-shot effects only for transitions observed on the same brief while the page is open. */
function nextFx(prev: CityState, next: CityState, fx: SceneFx): SceneFx {
  if (next.briefId === null) return NO_FX;
  if (prev.briefId !== next.briefId) return { ...NO_FX, boxesKey: prev.briefId === null ? fx.boxesKey + 1 : 0 };
  let out = fx;
  if (prev.release !== "approved" && next.release === "approved") out = { ...out, stamp: "in", stampKey: out.stampKey + 1 };
  if (prev.release === "approved" && next.release !== "approved") out = { ...out, stamp: "out", stampKey: out.stampKey + 1 };
  if (
    prev.registry === "live" &&
    next.registry === "live" &&
    next.registryObservedAt !== null &&
    prev.registryObservedAt !== next.registryObservedAt
  ) {
    out = { ...out, scanKey: out.scanKey + 1 };
  }
  return out;
}

function decorFor(def: BuildingDef, city: CityState, fx: SceneFx): ReactNode {
  const p = { def, city, fx };
  switch (def.id) {
    case "home":
      return <PlanningDecor {...p} />;
    case "studio":
      return <StudioDecor {...p} />;
    case "treasury":
      return <ReleaseDecor {...p} />;
    case "registry":
      return <RegistryDecor {...p} />;
    case "archive":
      return <ArchiveDecor {...p} />;
  }
}

/** Mirrors the camera onto the HTML hit layer (DOM write only, no React state per frame). */
function applyHitTransform(el: HTMLElement | null, c: CameraState) {
  if (el) el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.z})`;
}

const subscribeNoop = () => () => {};
function useFixtureEnabled(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("cityFixture"),
    () => false,
  );
}

const DIM_LABELS: Array<{ key: string; label: string; value: (c: CityState) => string; tone: (c: CityState) => string }> = [
  {
    key: "exec",
    label: "Compile",
    value: (c) => (c.briefId === null ? "none" : c.studio === "idle" ? (c.planning.lit ? "draft" : "done") : c.studio),
    tone: (c) => (c.worker.unresolved ? "warn" : c.studio === "running" ? "info" : "plain"),
  },
  {
    key: "review",
    label: "Review",
    value: (c) => (c.release === "idle" ? "-" : c.release),
    tone: (c) => (c.release === "approved" ? "ok" : c.release === "awaiting" ? "info" : "plain"),
  },
  {
    key: "pub",
    label: "Publish",
    value: (c) => (c.registry === "none" ? "-" : c.registry),
    tone: (c) =>
      c.registry === "live" ? "ok" : c.registry === "stale" || c.registry === "unavailable" ? "warn" : c.registry === "pending" ? "info" : "plain",
  },
];

const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
}

const CHIP_TONE: Record<string, StatusTone> = { ok: "ok", warn: "warn", info: "info", plain: "muted" };
const LANDMARK_PREFIX = "landmark-";
const EXPLAINER_BY_LABEL = new Map<string, ExplainerId>(EXPLAINER_IDS.map((id) => [`${LANDMARK_PREFIX}${EXPLAINERS[id].landmark}`, id]));

/** Building, landmark and scenery plates; sizes are estimates until the label layer measures them. */
function buildAllLabelSpecs(): LabelSpec[] {
  const extra = (kind: "landmark" | "scenery", priority: number, items: Array<{ id: string; text: string; anchor: { x: number; y: number } }>) =>
    items.map(
      (i): LabelSpec => ({
        id: i.id,
        text: i.text,
        kind,
        anchor: i.anchor,
        ...estimateLabelSize(i.text, kind, labelFontPx(1, kind)),
        priority,
        ariaLabel: kind === "landmark" ? `Explainer: ${i.text}` : i.text,
      }),
    );
  return [...buildingLabelSpecs(), ...extra("landmark", 60, landmarkLabelSpecs()), ...extra("scenery", 30, sceneryLabelSpecs())];
}

/**
 * Districts are built from the briefs list, which only carries summaries. A summary with a
 * live/closed/expired status always has a reconciled publication behind it (schema invariant),
 * so only the fields `deriveBriefState` reads are supplied; nothing private is involved.
 */
function houseInput(s: BriefSummary): BriefView {
  const confirmed =
    s.publicationStatus === "unpublished" || s.publicationStatus === "pending"
      ? null
      : { status: s.publicationStatus, entityKey: s.id, expiresAtBlock: 1, observedAt: s.updatedAt };
  return {
    id: s.id,
    createdAt: s.createdAt,
    draftRevision: s.draftRevision,
    executionStatus: s.executionStatus,
    publicParameters: { title: s.title },
    editedDraft: null,
    review: {
      status: s.reviewStatus,
      approval: s.reviewStatus === "approved" ? { draftRevision: s.draftRevision } : null,
    },
    publication: { status: s.publicationStatus, freshness: s.freshness, confirmed },
  } as unknown as BriefView;
}

function houseBriefs(list: BriefSummary[] | null, current: BriefView | null): BriefView[] | null {
  if (list === null) return null;
  const rows = list.map((s) => (current && current.id === s.id ? current : houseInput(s)));
  return current && !list.some((s) => s.id === current.id) ? [...rows, current] : rows;
}

const rectOf = (el: HTMLElement | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

function freshnessChip(scan: ScanStats): { tone: StatusTone; text: string } {
  if (scan.loading) return { tone: "info", text: "Reading Arkiv…" };
  if (scan.stale) return { tone: "warn", text: "Stale read" };
  if (scan.error) return { tone: "warn", text: "Read unavailable" };
  return { tone: "ok", text: "Fresh read" };
}

export default function CityScene({
  selected,
  onSelect,
  scene: realScene,
  scan,
  action,
  idleHint,
  notice,
  district,
  explainer,
  children,
}: CitySceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fixtureEnabled = useFixtureEnabled();
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const fixture = fixtureEnabled && fixtureId ? CITY_FIXTURES.find((f) => f.id === fixtureId) ?? null : null;
  const scene = fixture ? sceneFromCityState(deriveCityState(fixture.input)) : realScene;
  const city = scene.city;
  const statusText = fixture ? `${FIXTURE_PREFIX}${city.statusText}` : city.statusText;

  // Derive one-shot fx from observed state changes (React "adjust state on prop change" pattern).
  const cityKey = JSON.stringify(city);
  const [prev, setPrev] = useState<{ key: string; city: CityState; fx: SceneFx }>({ key: cityKey, city, fx: NO_FX });
  let fx = prev.fx;
  if (prev.key !== cityKey) {
    fx = nextFx(prev.city, city, prev.fx);
    setPrev({ key: cityKey, city, fx });
  }
  // Identity changes only when the derived state content changes.
  const stableCity = prev.city;
  const isFixture = Boolean(fixture);

  const engineRef = useRef<CityEngine | null>(null);
  const modeRef = useRef<MotionMode>("on");
  const [engineReady, setEngineReady] = useState(false);
  const [camera] = useState(createCameraStore);
  const [ticker, setTicker] = useState<AmbientTicker | null>(null);
  const reducedMotion = useReducedMotion();

  // Game renderer loads client-side only; on any failure the SVG scene stays.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: CityEngine | null = null;
    let shared: AmbientTicker | null = null;
    const onCamera = (c: CameraState) => {
      applyHitTransform(hitsRef.current, c);
      camera.set(c);
    };
    import("./pixi/city-engine")
      .then(({ CityEngine }) => CityEngine.create(host, { onCamera, reservedWidth: () => workbenchInset(host.getBoundingClientRect(), workbenchRef.current?.getBoundingClientRect() ?? null) }))
      .then((e) => {
        if (cancelled) {
          e.destroy();
          return;
        }
        engine = e;
        e.setMotion(modeRef.current);
        engineRef.current = e;
        camera.set(e.camera());
        shared = createAmbientTicker();
        setTicker(shared);
        setEngineReady(true);
      })
      .catch(() => {
        /* WebGL/canvas unavailable: keep the SVG scene */
      });
    return () => {
      cancelled = true;
      shared?.dispose();
      engine?.destroy();
      engineRef.current = null;
    };
  }, [camera]);

  // World-space overlay follows the camera by direct DOM writes (no React state per frame).
  useEffect(() => {
    if (!engineReady) return;
    return camera.subscribe((c) => {
      if (overlayRef.current) overlayRef.current.style.transform = worldTransform(c);
    });
  }, [engineReady, camera]);

  // Follow actual panel geometry, including expansion and stacked mobile layout.
  useEffect(() => {
    const host = hostRef.current;
    const panel = workbenchRef.current;
    if (!host || !panel) return;
    let previousInset: number | null = null;
    const resize = () => {
      const inset = workbenchInset(host.getBoundingClientRect(), panel.getBoundingClientRect());
      host.style.setProperty("--map-right-inset", `${inset}px`);
      // Content height changes on the stacked workspace must not reset map pan/zoom.
      if (inset !== previousInset) engineRef.current?.fit();
      previousInset = inset;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    observer.observe(host);
    resize();
    return () => observer.disconnect();
  }, [engineReady]);

  // Push derived state to the renderer. The renderer never writes state back.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engineReady || !engine) return;
    engine.setState(stableCity);
  }, [engineReady, stableCity]);

  useEffect(() => {
    if (engineReady) engineRef.current?.setSelected(selected);
  }, [engineReady, selected]);

  // Global motion switch: off for reduced motion, paused when hidden or off-screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = true;
    const apply = () => {
      const mode: MotionMode = mq.matches ? "off" : document.hidden || !onScreen ? "paused" : "on";
      root.setAttribute("data-anim", mode);
      modeRef.current = mode;
      engineRef.current?.setMotion(mode);
      ticker?.setOnScreen(onScreen);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            apply();
          })
        : null;
    io?.observe(root);
    mq.addEventListener("change", apply);
    document.addEventListener("visibilitychange", apply);
    apply();
    return () => {
      io?.disconnect();
      mq.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, [ticker]);

  useEffect(() => {
    ticker?.setReducedMotion(reducedMotion);
  }, [ticker, reducedMotion]);

  // BriefMint Expand overlay (any modal per the stacking contract): while it is open the scene,
  // its labels and the left HUD column are inert + aria-hidden; focus is trapped in the dialog
  // by the panel itself. Closing restores the previous root state.
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => onCityOverlay((d) => setModalOpen(Boolean(d.open))), []);
  useEffect(() => {
    const setInert = (el: HTMLElement | null) => {
      if (!el) return;
      if (modalOpen) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
    };
    setInert(hostRef.current);
    setInert(leftColRef.current);
  }, [modalOpen]);

  const select = (id: BuildingId) => {
    if (engineRef.current?.consumeDrag()) return;
    onSelect(id);
    engineRef.current?.ping(id);
  };

  const activateLabel = (id: string) => {
    const explained = EXPLAINER_BY_LABEL.get(id);
    if (explained) explainer.onOpen(explained);
    else if (BUILDINGS.some((b) => b.id === id)) select(id as BuildingId);
  };

  const labelSpecs = useMemo(() => buildAllLabelSpecs(), []);
  const tags = useMemo(
    () =>
      Object.fromEntries(BUILDINGS.map((b) => [b.id, tagFor(b.id, stableCity, isFixture)])) as Record<BuildingId, BuildingTag | null>,
    [stableCity, isFixture],
  );
  const { briefs, brief, opportunities, freshness, signedIn } = district;
  const districtModel = useMemo(
    () => buildDistrictModel({ briefs: houseBriefs(briefs, brief), opportunities, freshness, signedIn }),
    [briefs, brief, opportunities, freshness, signedIn],
  );
  const avoidRects = () =>
    [statusRef.current, workbenchRef.current, barRef.current].map(rectOf).filter((r): r is Rect => r !== null);
  const getHostRect = () => hostRef.current?.getBoundingClientRect() ?? null;

  const fresh = freshnessChip(scan);
  const unreadable = !scan.loading && scan.error && !scan.stale;

  const fixtureCard = fixtureEnabled ? (
    <section className="hud-card bm-glass bm-glass--text" data-tone="warn" aria-label="Dev fixture">
      <h2 className="hud-card__title">FIXTURE DATA</h2>
      <label className="hud-field">
        <span className="hud-card__note">Preview a scene state (not real data)</span>
        <select className="bm-input" value={fixtureId ?? ""} onChange={(e) => setFixtureId(e.target.value || null)}>
          <option value="">off (real state)</option>
          {CITY_FIXTURES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  ) : null;

  return (
    <div className="game" ref={rootRef} data-anim="on" data-engine={engineReady ? "ready" : "svg"}>
      <div className="hud-layer" data-glass-scope="city">
        <div className="hud-col hud-col--right" ref={workbenchRef}>
          {children}
        </div>
        <div className="hud-col hud-col--left" ref={leftColRef}>
          <section className="hud-card bm-glass bm-glass--text" ref={statusRef} aria-label="City scan">
            <div className="hud-scan">
              <span className="hud-scan__big bm-num">{scan.loading ? "…" : unreadable ? "–" : scan.open}</span>
              <span className="hud-card__note">open opportunities</span>
              <StatusChip tone={fresh.tone}>{fresh.text}</StatusChip>
            </div>
            {!unreadable && !scan.loading && <p className="hud-card__note">{scan.opportunities} indexed</p>}
            <div className="hud-chips">
              {DIM_LABELS.map((d) => (
                // Fixture previews never get success/live colouring.
                <StatusChip key={d.key} tone={isFixture ? "muted" : CHIP_TONE[d.tone(city)]}>
                  {`${d.label} ${d.value(city)}`}
                </StatusChip>
              ))}
              {fixture && <StatusChip tone="danger">fixture</StatusChip>}
            </div>
          </section>
          {fixtureCard}
          <div className="hud-col-spacer" />
          <section
            className="hud-card hud-bar bm-glass bm-glass--text"
            ref={barRef}
            aria-label="Next step"
            data-tone={city.worker.unresolved ? "warn" : undefined}
          >
            <p className="hud-bar__status" role="status" aria-live="polite">
              {statusText}
            </p>
            {notice}
            <div className="hud-bar__row">
              {!action && <span className="hud-bar__idle">{idleHint}</span>}
              {action && (
                <button type="button" className="bm-btn bm-btn--primary" disabled={action.busy} onClick={action.run}>
                  {action.busy ? "Working…" : action.label}
                </button>
              )}
              <span className="hud-zoom">
                <button type="button" className="bm-btn bm-btn--ghost" aria-label="Zoom in" onClick={() => engineRef.current?.zoomBy(1.25)} disabled={!engineReady}>
                  +
                </button>
                <button type="button" className="bm-btn bm-btn--ghost" aria-label="Zoom out" onClick={() => engineRef.current?.zoomBy(0.8)} disabled={!engineReady}>
                  −
                </button>
                <button type="button" className="bm-btn bm-btn--ghost" aria-label="Reset view" onClick={() => engineRef.current?.fit()} disabled={!engineReady}>
                  ⌂
                </button>
              </span>
            </div>
            <p className="hud-card__note">Drag to pan · Scroll to zoom · Click a building</p>
            <p className="hud-card__note">
              Compilation uses promotional credits. Any advertised budget is unfunded: BriefMint never holds or moves funds.
            </p>
          </section>
        </div>
      </div>

      <div className="game-world" ref={hostRef}>
        <svg
          className="game-fallback"
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Tool City map. Five buildings around paved streets with one document worker."
        >
          <desc>{statusText}</desc>
          <rect x={0} y={0} width={VIEWBOX.w} height={VIEWBOX.h} fill="#9db38a" />
          <rect x={0} y={228} width={VIEWBOX.w} height={38} fill="#d9c39a" />
          <rect x={300} y={110} width={44} height={252} fill="#d9c39a" />
          <ellipse cx={320} cy={322} rx={72} ry={30} fill="#d9c39a" stroke="#bfa171" strokeWidth={3} />
          <GroundAmbient />
          {BUILDINGS_BACK_TO_FRONT.map((b) => (
            <IsoBuilding
              key={b.id}
              def={b}
              index={BUILDINGS.indexOf(b)}
              selected={selected === b.id}
              onSelect={() => onSelect(b.id)}
              stateLabel={stateLabelFor(b.id, city)}
              tag={tagFor(b.id, city, isFixture)}
              dataState={{
                lit: String(b.id === "home" ? city.planning.lit : b.id === "studio" ? city.studio === "running" : false),
                studio: b.id === "studio" ? city.studio : "",
                registry: b.id === "registry" ? city.registry : "",
              }}
              chimney={b.id === "home"}
              wallLeft={b.id === "studio" ? "#e8f1ee" : undefined}
              wallRight={b.id === "studio" ? "#cfe0da" : undefined}
            >
              {decorFor(b, city, fx)}
            </IsoBuilding>
          ))}
          <Worker
            x={scene.x}
            y={scene.y}
            pose={city.worker.pose}
            carry={city.worker.carry}
            unresolved={city.worker.unresolved}
            briefId={city.briefId}
            building={city.worker.building}
          />
          <SkyAmbient />
        </svg>

        {engineReady && ticker && (
          // Object layer, painter order: water and boats first, then scenery (rear objects ride
          // in the building-occlusion mask), record districts, life on the streets, landmarks.
          // The label layer (screen space, below) paints last and never reorders this.
          <div className="game-overlay" ref={overlayRef}>
            <svg width={1} height={1} overflow="visible" style={{ overflow: "visible", pointerEvents: "none" }}>
              <BuildingOcclusionMask />
              <AmbientWater ticker={ticker} camera={camera} getHostRect={getHostRect} reducedMotion={reducedMotion} />
              <Scenery ticker={ticker} reducedMotion={reducedMotion} />
              <DistrictLayer
                model={districtModel}
                selectedId={district.selectedId}
                onSelectBrief={district.onSelectBrief}
                onSelectOpportunity={district.onSelectOpportunity}
                onOpenTab={district.onOpenTab}
                fixture={isFixture}
                reducedMotion={reducedMotion}
              />
              <AmbientStreets ticker={ticker} reducedMotion={reducedMotion} />
              <Landmarks selected={explainer.selected} onOpen={explainer.onOpen} reducedMotion={reducedMotion} />
            </svg>
          </div>
        )}
        {engineReady && (
          <div
            className="game-hits"
            ref={(el) => {
              hitsRef.current = el;
              const engine = engineRef.current;
              if (el && engine) applyHitTransform(el, engine.camera());
            }}
          >
            {BUILDINGS_BACK_TO_FRONT.map((b) => {
              const box = keyBuildingBox(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  className="game-hit"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                  onClick={() => select(b.id)}
                  onPointerEnter={() => engineRef.current?.setHover(b.id)}
                  onPointerLeave={() => engineRef.current?.setHover(null)}
                />
              );
            })}
          </div>
        )}
        {engineReady && (
          <BuildingLabels
            camera={camera}
            specs={labelSpecs}
            selectedId={selected}
            onActivate={activateLabel}
            avoidRects={avoidRects}
            tags={tags}
            // Scenery nameplates collapse below zoom 0.9; buildings stay laid out at every zoom.
            options={{ minZoom: { scenery: 0.9 } }}
          />
        )}
      </div>

      <ul className="sr-only">
        {BUILDINGS_BACK_TO_FRONT.map((b) => {
          const s = stateLabelFor(b.id, city);
          return (
            <li key={b.id}>
              {b.name}: {b.description}
              {s ? ` Current state: ${s}.` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
