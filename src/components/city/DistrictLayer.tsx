"use client";

// Living districts: world-space SVG <g> (world pixels). Houses = the signed-in owner's saved
// briefs, towers = public Arkiv opportunities, both in their reserved slot-plan lots.
// Decoration never represents data beyond what the model says; labels are public titles only.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { BLOCK_SIZE, blockOrigin, toWorld } from "./iso-layout";
import {
  overflowAnchor,
  plotAriaLabel,
  type BriefHouseState,
  type DistrictModel,
  type OpportunityPlot,
  type BriefPlot,
  type OpportunityTowerState,
} from "./district-model";
import { HOUSE_DISTRICT_BLOCK, TOWER_DISTRICT_BLOCK, slotCentreWorld } from "./slots";

export interface DistrictLayerProps {
  model: DistrictModel;
  selectedId?: string | null;
  onSelectBrief: (id: string) => void;
  onSelectOpportunity: (id: string) => void;
  onOpenTab: (tab: "briefs" | "opportunities") => void;
  fixture: boolean;
  reducedMotion: boolean;
}

const INK = "var(--bm-scene-ink)";
const FONT = "var(--bm-font-body)";
/** Half-diagonals of one 2x2 record lot, inset so neighbouring pads keep a tidy gap. */
const PAD = [
  { x: -34, y: 0 },
  { x: 0, y: -17 },
  { x: 34, y: 0 },
  { x: 0, y: 17 },
];
const pts = (ps: ReadonlyArray<{ x: number; y: number }>) => ps.map((p) => `${p.x},${p.y}`).join(" ");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Quad on a wall from a to b (fractions t0..t1), between heights y0..y1 above the wall's base line. */
const wallQuad = (a: { x: number; y: number }, b: { x: number; y: number }, t0: number, t1: number, y0: number, y1: number) =>
  pts([
    { x: lerp(a.x, b.x, t0), y: lerp(a.y, b.y, t0) - y0 },
    { x: lerp(a.x, b.x, t1), y: lerp(a.y, b.y, t1) - y0 },
    { x: lerp(a.x, b.x, t1), y: lerp(a.y, b.y, t1) - y1 },
    { x: lerp(a.x, b.x, t0), y: lerp(a.y, b.y, t0) - y1 },
  ]);

const HOUSE_COLOR: Record<BriefHouseState, string> = {
  draft: "var(--bm-text-muted)",
  compiling: "var(--bm-info)",
  "needs review": "var(--bm-warning)",
  approved: "var(--bm-teal)",
  publishing: "var(--bm-accent)",
  live: "var(--bm-success)",
  closed: "var(--bm-scene-stone)",
  expired: "var(--bm-scene-stone)",
  failed: "var(--bm-danger)",
  unknown: "var(--bm-text-muted)",
};
const TOWER_COLOR: Record<OpportunityTowerState, string> = {
  open: "var(--bm-teal)",
  closed: "var(--bm-scene-stone)",
};

function Badge({ y, glyph, color }: { y: number; glyph: string; color: string }) {
  return (
    <g transform={`translate(0 ${y})`} aria-hidden="true">
      <circle r={10} fill="var(--bm-scene-sign)" stroke={color} strokeWidth={3} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fontFamily={FONT}
        fill="var(--bm-scene-sign-ink)"
      >
        {glyph}
      </text>
    </g>
  );
}

const WALL = { stroke: INK, strokeWidth: 1.2, strokeOpacity: 0.85, strokeLinejoin: "round" as const };

function HouseArt({ state }: { state: BriefHouseState }) {
  const hw = 19;
  const hh = 9.5;
  const wallH = 15;
  const L = { x: -hw, y: 0 };
  const R = { x: hw, y: 0 };
  const B = { x: 0, y: hh };
  const Lt = { x: -hw, y: -wallH };
  const Rt = { x: hw, y: -wallH };
  const Bt = { x: 0, y: hh - wallH };
  const apex = { x: 0, y: -wallH - 14 };
  const roof = HOUSE_COLOR[state];
  return (
    <>
      <ellipse cx={0} cy={3} rx={hw + 2} ry={hh + 1} fill={INK} opacity={0.14} />
      <polygon points={pts([L, B, Bt, Lt])} fill="var(--bm-scene-wall-light)" {...WALL} />
      <polygon points={pts([R, B, Bt, Rt])} fill="var(--bm-scene-wall-shade)" {...WALL} />
      <polygon points={wallQuad(L, B, 0.3, 0.6, 5, 11)} fill="var(--bm-scene-window)" />
      <polygon points={wallQuad(B, R, 0.4, 0.6, 0, 9)} fill="var(--bm-scene-wood-dark)" />
      <polygon points={pts([Lt, Bt, apex])} fill={roof} {...WALL} />
      <polygon points={pts([Bt, Rt, apex])} fill={roof} {...WALL} />
      <polygon points={pts([Bt, Rt, apex])} fill={INK} opacity={0.25} />
    </>
  );
}

function TowerArt({ state }: { state: OpportunityTowerState }) {
  const open = state === "open";
  const hw = 17;
  const hh = 8.5;
  const wallH = open ? 46 : 30;
  const L = { x: -hw, y: 0 };
  const R = { x: hw, y: 0 };
  const B = { x: 0, y: hh };
  const Lt = { x: -hw, y: -wallH };
  const Rt = { x: hw, y: -wallH };
  const Bt = { x: 0, y: hh - wallH };
  const Tt = { x: 0, y: -hh - wallH };
  const windowFill = open ? "var(--bm-scene-window)" : INK;
  const rows: number[] = [];
  for (let y = 12; y < wallH - 6; y += 11) rows.push(y);
  return (
    <>
      <ellipse cx={0} cy={3} rx={hw + 2} ry={hh + 1} fill={INK} opacity={0.14} />
      <polygon points={pts([L, B, Bt, Lt])} fill={open ? "var(--bm-scene-wall-light)" : "var(--bm-scene-wall-shade)"} {...WALL} />
      <polygon points={pts([R, B, Bt, Rt])} fill={open ? "var(--bm-scene-wall-shade)" : "var(--bm-scene-stone)"} {...WALL} />
      {rows.map((y) =>
        [
          [L, B],
          [B, R],
        ].map(([a, b], i) =>
          [0.2, 0.58].map((t) => (
            <polygon
              key={`${y}-${i}-${t}`}
              points={wallQuad(a, b, t, t + 0.22, y, y + 6)}
              fill={windowFill}
              opacity={open ? 1 : 0.5}
            />
          )),
        ),
      )}
      <polygon points={pts([Lt, Tt, Rt, Bt])} fill={open ? "var(--bm-scene-roof-blue)" : "var(--bm-scene-stone)"} {...WALL} />
      {open && (
        <>
          <line x1={0} y1={-wallH} x2={0} y2={-wallH - 16} stroke={INK} strokeWidth={1.5} />
          <polygon points={`0,${-wallH - 16} 12,${-wallH - 12} 0,${-wallH - 8}`} fill="var(--bm-accent)" stroke={INK} strokeWidth={1} />
        </>
      )}
    </>
  );
}

/** Focusable plot button; the art lives in an inner <g> so arrival animation never touches the placement. */
function PlotButton({
  id,
  x,
  y,
  ariaLabel,
  title,
  selected,
  focused,
  onActivate,
  onFocusChange,
  registerNode,
  children,
}: {
  id: string;
  x: number;
  y: number;
  ariaLabel: string;
  title: string;
  selected: boolean;
  focused: boolean;
  onActivate: () => void;
  onFocusChange: (id: string, on: boolean) => void;
  registerNode: (id: string, el: SVGGElement | null) => void;
  children: ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    onActivate();
  };
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      data-district-plot={id}
      style={{ pointerEvents: "auto", cursor: "pointer", outline: "none" }}
      onPointerDown={(e: PointerEvent<SVGGElement>) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={onKeyDown}
      onFocus={(e) => onFocusChange(id, e.currentTarget.matches(":focus-visible"))}
      onBlur={() => onFocusChange(id, false)}
    >
      <title>{title}</title>
      <polygon points={pts(PAD)} fill="var(--bm-scene-path)" fillOpacity={0.55} stroke={INK} strokeOpacity={0.3} strokeWidth={1} />
      {selected && <polygon points={pts(PAD)} fill="none" stroke="var(--bm-accent)" strokeWidth={3} strokeLinejoin="round" />}
      {focused && (
        <polygon
          points={pts(PAD.map((p) => ({ x: p.x * 1.1, y: p.y * 1.16 })))}
          fill="none"
          stroke="var(--bm-scene-sign)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      )}
      <g ref={(el) => registerNode(id, el)}>{children}</g>
    </g>
  );
}

function Plate({ x, y, text, fill, ink, stroke }: { x: number; y: number; text: string; fill: string; ink: string; stroke: string }) {
  const w = Math.round(text.length * 7.2 + 14);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-w / 2} y={-10} width={w} height={20} rx={5} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fontFamily={FONT}
        fill={ink}
        style={{ userSelect: "none" }}
      >
        {text}
      </text>
    </g>
  );
}

function VacantLot({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} role="img" aria-label="Vacant lot, no record here">
      <title>Vacant lot</title>
      <polygon points={pts(PAD)} fill="var(--bm-scene-sand)" fillOpacity={0.35} stroke={INK} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 4" />
      <line x1={0} y1={2} x2={0} y2={-9} stroke="var(--bm-scene-wood-dark)" strokeWidth={2} />
      <Plate x={0} y={-17} text="vacant" fill="var(--bm-scene-sign)" ink="var(--bm-scene-sign-ink)" stroke="var(--bm-scene-wood-dark)" />
    </g>
  );
}

function OverflowSign({
  x,
  y,
  count,
  noun,
  tabName,
  onOpen,
}: {
  x: number;
  y: number;
  count: number;
  noun: string;
  tabName: string;
  onOpen: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const text = `+${count} more`;
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${count} more ${noun}. Open ${tabName}`}
      style={{ pointerEvents: "auto", cursor: "pointer", outline: "none" }}
      onPointerDown={(e: PointerEvent<SVGGElement>) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
      onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <title>{`${count} more ${noun} not shown. Open ${tabName}`}</title>
      <rect x={-34} y={-14} width={68} height={24} fill="transparent" />
      <line x1={0} y1={0} x2={0} y2={-6} stroke="var(--bm-scene-wood-dark)" strokeWidth={2} />
      <Plate
        x={0}
        y={-12}
        text={text}
        fill="var(--bm-scene-sign)"
        ink="var(--bm-scene-sign-ink)"
        stroke={focused ? "var(--bm-accent)" : "var(--bm-scene-wood-dark)"}
      />
    </g>
  );
}

export default function DistrictLayer({
  model,
  selectedId = null,
  onSelectBrief,
  onSelectOpportunity,
  onOpenTab,
  fixture,
  reducedMotion,
}: DistrictLayerProps) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, SVGGElement>());
  /** Ids already on screen per kind; null until the first real answer (initial load is not an arrival). */
  const seen = useRef<{ houses: Set<string> | null; towers: Set<string> | null }>({ houses: null, towers: null });
  const running = useRef(new Set<Animation>());

  const registerNode = (id: string, el: SVGGElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  };
  const onFocusChange = (id: string, on: boolean) => setFocusId((cur) => (on ? id : cur === id ? null : cur));

  useLayoutEffect(() => {
    const track = (kind: "houses" | "towers", loaded: boolean, ids: string[]) => {
      if (!loaded) {
        seen.current[kind] = null;
        return;
      }
      const known = seen.current[kind];
      if (!known) {
        seen.current[kind] = new Set(ids);
        return;
      }
      for (const id of ids) {
        if (known.has(id)) continue;
        known.add(id);
        const el = nodes.current.get(id);
        if (!el || reducedMotion || typeof el.animate !== "function") continue;
        const anim = el.animate(
          [
            { opacity: 0, transform: "translateY(-16px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 420, easing: "ease-out", fill: "backwards" },
        );
        running.current.add(anim);
        anim.onfinish = anim.oncancel = () => running.current.delete(anim);
      }
    };
    track("houses", model.loaded.houses, model.houses.map((p) => p.id));
    track("towers", model.loaded.towers, model.towers.map((p) => p.id));
  }, [model, reducedMotion]);

  useEffect(() => {
    const live = running.current;
    return () => {
      for (const a of live) a.cancel();
      live.clear();
    };
  }, []);

  const houseTab = "My Briefs";
  const towerTab = "Opportunities";
  const houseAnchor = toWorld(overflowAnchor("brief-house"));
  const towerAnchor = toWorld(overflowAnchor("opportunity-tower"));
  const houseBlock = blockOrigin(HOUSE_DISTRICT_BLOCK.bx, HOUSE_DISTRICT_BLOCK.by);
  const towerBlock = blockOrigin(TOWER_DISTRICT_BLOCK.bx, TOWER_DISTRICT_BLOCK.by);
  // Both signs stand on the road corner in front of their block: free ground, no working building.
  const fixtureAt = toWorld({ gx: houseBlock.gx + BLOCK_SIZE, gy: houseBlock.gy + BLOCK_SIZE });
  const noticeAt = toWorld({ gx: towerBlock.gx + BLOCK_SIZE, gy: towerBlock.gy + BLOCK_SIZE });

  const renderHouse = (p: BriefPlot) => {
    const c = slotCentreWorld(p.slot);
    const color = HOUSE_COLOR[p.state];
    return (
      <PlotButton
        key={p.id}
        id={p.id}
        x={c.x}
        y={c.y}
        ariaLabel={plotAriaLabel(p)}
        title={`${p.label} (${p.state})`}
        selected={selectedId === p.id}
        focused={focusId === p.id}
        onActivate={() => onSelectBrief(p.id)}
        onFocusChange={onFocusChange}
        registerNode={registerNode}
      >
        <HouseArt state={p.state} />
        <Badge y={-44} glyph={p.glyph} color={color} />
      </PlotButton>
    );
  };

  const renderTower = (p: OpportunityPlot) => {
    const c = slotCentreWorld(p.slot);
    const color = TOWER_COLOR[p.state];
    return (
      <PlotButton
        key={p.id}
        id={p.id}
        x={c.x}
        y={c.y}
        ariaLabel={plotAriaLabel(p)}
        title={`${p.label} (${p.state})`}
        selected={selectedId === p.id}
        focused={focusId === p.id}
        onActivate={() => onSelectOpportunity(p.id)}
        onFocusChange={onFocusChange}
        registerNode={registerNode}
      >
        <TowerArt state={p.state} />
        <Badge y={p.state === "open" ? -76 : -44} glyph={p.glyph} color={color} />
      </PlotButton>
    );
  };

  const houseVacant = model.vacant.find((v) => v.district === "brief-house");
  const towerVacant = model.vacant.find((v) => v.district === "opportunity-tower");
  const { dimmed, notice } = model.towerDistrict;

  return (
    <g data-layer="districts">
      <g>
        {houseVacant && <VacantLot {...slotCentreWorld(houseVacant)} />}
        {model.houses.map(renderHouse)}
        {model.houseOverflow > 0 && (
          <OverflowSign
            x={houseAnchor.x}
            y={houseAnchor.y}
            count={model.houseOverflow}
            noun={model.houseOverflow === 1 ? "brief" : "briefs"}
            tabName={houseTab}
            onOpen={() => onOpenTab("briefs")}
          />
        )}
      </g>
      <g opacity={dimmed ? 0.5 : 1} style={reducedMotion ? undefined : { transition: "opacity 300ms ease" }}>
        {towerVacant && <VacantLot {...slotCentreWorld(towerVacant)} />}
        {model.towers.map(renderTower)}
        {model.towerOverflow > 0 && (
          <OverflowSign
            x={towerAnchor.x}
            y={towerAnchor.y}
            count={model.towerOverflow}
            noun={model.towerOverflow === 1 ? "opportunity" : "opportunities"}
            tabName={towerTab}
            onOpen={() => onOpenTab("opportunities")}
          />
        )}
      </g>
      {notice && (
        <g role="status" aria-live="polite">
          <Plate x={noticeAt.x} y={noticeAt.y} text={notice} fill="var(--bm-scene-sign)" ink="var(--bm-scene-sign-ink)" stroke="var(--bm-warning)" />
        </g>
      )}
      {fixture && (
        <g role="note" aria-label="FIXTURE DATA">
          <Plate x={fixtureAt.x} y={fixtureAt.y} text="FIXTURE DATA" fill="var(--bm-accent)" ink="var(--bm-on-accent)" stroke={INK} />
        </g>
      )}
    </g>
  );
}
