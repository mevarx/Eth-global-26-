"use client";
// Explainer landmarks: original SVG art in WORLD space (iso-layout toWorld pixels) for the clock
// tower, gatehouse (with wall) and notice board, plus an outlined "i" pin over the lighthouse the
// Pixi engine already draws. Presentation only: no worker, no state reads or writes. The parent
// SVG applies the camera transform (brief §6.5); this layer never subscribes to the camera.
import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { EXPLAINERS, EXPLAINER_IDS, type ExplainerId } from "./explainers";
import { toWorld } from "./iso-layout";
import { OCCLUSION_MASK_ID } from "./OcclusionMask";
import { isRearObject } from "./scene-depth";
import { SLOTS, rectCentre, type GridRect, type LandmarkKind } from "./slots";

interface Pt {
  x: number;
  y: number;
}

export interface LandmarksProps {
  selected?: ExplainerId | null;
  onOpen(id: ExplainerId): void;
  reducedMotion: boolean;
}

const INK = "var(--bm-scene-ink)";
const S = (v: string) => `var(--bm-scene-${v})`;

/** Same grid point the Pixi engine uses for the lighthouse. */
const LIGHTHOUSE_BASE: Pt = toWorld({ gx: 0.9, gy: 22.5 });

function slotRect(kind: LandmarkKind): GridRect {
  const s = SLOTS.find((x) => x.role === "landmark" && x.landmark === kind);
  if (!s) throw new Error(`Missing landmark slot ${kind}`);
  return s.rect;
}

function footprint(r: GridRect, inset = 0.12): string {
  return [
    toWorld({ gx: r.gx + inset, gy: r.gy + inset }),
    toWorld({ gx: r.gx + r.w - inset, gy: r.gy + inset }),
    toWorld({ gx: r.gx + r.w - inset, gy: r.gy + r.h - inset }),
    toWorld({ gx: r.gx + inset, gy: r.gy + r.h - inset }),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

const centreOf = (kind: LandmarkKind): Pt => toWorld(rectCentre(slotRect(kind)));

/** Name-plate inputs for SA-2's label layer; anchor is a ground point in world px. */
export function landmarkLabelSpecs(): Array<{ id: string; text: string; anchor: Pt }> {
  return EXPLAINER_IDS.map((id) => {
    const e = EXPLAINERS[id];
    const base = e.landmark === "lighthouse" ? LIGHTHOUSE_BASE : centreOf(e.landmark);
    return { id: `landmark-${e.landmark}`, text: e.title, anchor: { x: base.x, y: base.y + 12 } };
  });
}

// ---- iso box helpers: a = tiles along gx, b = tiles along gy, h/z0 in px ----
interface Fills {
  top: string;
  right: string;
  left: string;
}
const WALL: Fills = { top: S("sign"), right: S("wall-light"), left: S("wall-shade") };
const STONE: Fills = { top: S("stone"), right: S("stone"), left: `color-mix(in srgb, ${S("stone")} 70%, ${INK})` };
const WOOD: Fills = { top: S("wood"), right: S("wood"), left: S("wood-dark") };
const ROOF: Fills = { top: S("roof-red"), right: S("roof-red"), left: `color-mix(in srgb, ${S("roof-red")} 72%, ${INK})` };

function corner(c: Pt, a: number, b: number, sa: number, sb: number, z: number): string {
  return `${c.x + sa * a * 10 - sb * b * 10},${c.y + sa * a * 5 + sb * b * 5 - z}`;
}

function Box({ c, a, b, h, z0 = 0, fills }: { c: Pt; a: number; b: number; h: number; z0?: number; fills: Fills }) {
  const t = z0 + h;
  const edge = { stroke: INK, strokeWidth: 1, strokeLinejoin: "round" as const };
  return (
    <g>
      <polygon points={[corner(c, a, b, -1, 1, z0), corner(c, a, b, 1, 1, z0), corner(c, a, b, 1, 1, t), corner(c, a, b, -1, 1, t)].join(" ")} style={{ fill: fills.left, ...edge }} />
      <polygon points={[corner(c, a, b, 1, -1, z0), corner(c, a, b, 1, 1, z0), corner(c, a, b, 1, 1, t), corner(c, a, b, 1, -1, t)].join(" ")} style={{ fill: fills.right, ...edge }} />
      <polygon points={[corner(c, a, b, -1, -1, t), corner(c, a, b, 1, -1, t), corner(c, a, b, 1, 1, t), corner(c, a, b, -1, 1, t)].join(" ")} style={{ fill: fills.top, ...edge }} />
    </g>
  );
}

/** Transform placing local face coords (x right, y down from the top edge) on the +gx face. */
function rightFace(c: Pt, a: number, b: number, top: number): string {
  const [x, y] = corner(c, a, b, 1, -1, top).split(",");
  return `matrix(-1 0.5 0 1 ${x} ${y})`;
}
/** Same for the +gy face. */
function leftFace(c: Pt, a: number, b: number, top: number): string {
  const [x, y] = corner(c, a, b, -1, 1, top).split(",");
  return `matrix(1 0.5 0 1 ${x} ${y})`;
}

function ClockFace({ transform, cx, cy }: { transform: string; cx: number; cy: number }) {
  // Static face, fixed at 10:10. Never a live countdown.
  return (
    <g transform={transform}>
      <circle cx={cx} cy={cy} r={7.5} style={{ fill: S("sign"), stroke: INK, strokeWidth: 1.2 }} />
      {[
        [0, -6, 0, -4.5],
        [6, 0, 4.5, 0],
        [0, 6, 0, 4.5],
        [-6, 0, -4.5, 0],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={cx + x1} y1={cy + y1} x2={cx + x2} y2={cy + y2} style={{ stroke: INK, strokeWidth: 1 }} />
      ))}
      <line x1={cx} y1={cy} x2={cx - 3} y2={cy - 1.8} style={{ stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" }} />
      <line x1={cx} y1={cy} x2={cx + 4.8} y2={cy - 2.8} style={{ stroke: INK, strokeWidth: 1.1, strokeLinecap: "round" }} />
    </g>
  );
}

function ClockTowerArt() {
  const c = centreOf("clock-tower");
  const baseH = 14;
  const shaftH = 56;
  const top = baseH + shaftH;
  const apex = { x: c.x, y: c.y - top - 22 };
  const l = corner(c, 1, 1, -1, 1, top);
  const m = corner(c, 1, 1, 1, 1, top);
  const r = corner(c, 1, 1, 1, -1, top);
  return (
    <g>
      <ellipse cx={c.x} cy={c.y + 2} rx={22} ry={10} style={{ fill: INK, opacity: 0.18 }} />
      <Box c={c} a={1.3} b={1.3} h={baseH} fills={STONE} />
      <Box c={c} a={1} b={1} h={shaftH} z0={baseH} fills={WALL} />
      <ClockFace transform={leftFace(c, 1, 1, top - 4)} cx={10} cy={12} />
      <ClockFace transform={rightFace(c, 1, 1, top - 4)} cx={10} cy={12} />
      <polygon points={`${l} ${m} ${apex.x},${apex.y}`} style={{ fill: `color-mix(in srgb, ${S("roof-blue")} 72%, ${INK})`, stroke: INK, strokeWidth: 1, strokeLinejoin: "round" }} />
      <polygon points={`${m} ${r} ${apex.x},${apex.y}`} style={{ fill: S("roof-blue"), stroke: INK, strokeWidth: 1, strokeLinejoin: "round" }} />
    </g>
  );
}

function GatehouseArt() {
  const c = centreOf("gatehouse");
  const ey = { x: -20, y: 10 };
  const at = (k: number): Pt => ({ x: c.x + ey.x * k, y: c.y + ey.y * k });
  const gateH = 44;
  return (
    <g>
      <ellipse cx={c.x} cy={c.y + 4} rx={44} ry={20} style={{ fill: INK, opacity: 0.16 }} />
      <Box c={at(-1.725)} a={0.5} b={1.95} h={20} fills={STONE} />
      <Box c={c} a={1.3} b={1.5} h={gateH} fills={WALL} />
      <g transform={rightFace(c, 1.3, 1.5, gateH)}>
        <path d={`M9,${gateH} V28 Q9,20 15,20 Q21,20 21,28 V${gateH} Z`} style={{ fill: INK, stroke: INK, strokeWidth: 1 }} />
        <rect x={4} y={6} width={5} height={7} style={{ fill: S("window"), stroke: INK, strokeWidth: 1 }} />
        <rect x={21} y={6} width={5} height={7} style={{ fill: S("window"), stroke: INK, strokeWidth: 1 }} />
      </g>
      <Box c={c} a={1.6} b={1.8} h={6} z0={gateH} fills={ROOF} />
      <Box c={at(1.725)} a={0.5} b={1.95} h={20} fills={STONE} />
    </g>
  );
}

function NoticeBoardArt() {
  const c = centreOf("notice-board");
  const ey = { x: -20, y: 10 };
  const at = (k: number): Pt => ({ x: c.x + ey.x * k, y: c.y + ey.y * k });
  const boardZ = 18;
  const boardH = 32;
  const bw = 2.2;
  const top = boardZ + boardH;
  return (
    <g>
      <ellipse cx={c.x} cy={c.y + 3} rx={34} ry={15} style={{ fill: INK, opacity: 0.16 }} />
      <Box c={at(-0.95)} a={0.18} b={0.18} h={boardZ} fills={WOOD} />
      <Box c={at(0.95)} a={0.18} b={0.18} h={boardZ} fills={WOOD} />
      <Box c={c} a={0.2} b={bw} h={boardH} z0={boardZ} fills={WOOD} />
      <g transform={rightFace(c, 0.2, bw, top)}>
        <rect x={3} y={3} width={bw * 20 - 6} height={boardH - 6} style={{ fill: S("sign"), stroke: INK, strokeWidth: 1 }} />
        <rect x={7} y={7} width={10} height={9} style={{ fill: S("plate"), stroke: S("plate-edge"), strokeWidth: 1 }} />
        <rect x={21} y={7} width={12} height={7} style={{ fill: S("lamp-glow"), stroke: S("plate-edge"), strokeWidth: 1 }} />
        <rect x={8} y={19} width={11} height={7} style={{ fill: S("window"), stroke: S("plate-edge"), strokeWidth: 1 }} />
        <rect x={24} y={17} width={9} height={9} style={{ fill: S("plate"), stroke: S("plate-edge"), strokeWidth: 1 }} />
        {[12, 27, 13, 28].map((x, i) => (
          <circle key={i} cx={x} cy={i < 2 ? 8 : 20} r={1.2} style={{ fill: S("roof-red") }} />
        ))}
      </g>
      <Box c={c} a={0.7} b={bw + 0.3} h={4} z0={top + 1} fills={ROOF} />
    </g>
  );
}

/** Outlined "i" pin; `y` is the tip, the head sits above it. */
function Pin({ x, y, selected }: { x: number; y: number; selected: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className="bm-lm__pin">
      <path d="M0,0 L-5,-17 H5 Z" style={{ fill: S("plate"), stroke: selected ? "var(--bm-accent)" : S("plate-edge"), strokeWidth: 1.6, strokeLinejoin: "round" }} />
      <circle cx={0} cy={-26} r={12} style={{ fill: S("plate"), stroke: selected ? "var(--bm-accent)" : S("plate-edge"), strokeWidth: selected ? 2.4 : 1.8 }} />
      <text x={0} y={-26} textAnchor="middle" dominantBaseline="central" style={{ fill: S("sign-ink"), font: `700 14px var(--bm-font-body, sans-serif)`, pointerEvents: "none" }}>
        i
      </text>
    </g>
  );
}

function Landmark({
  id,
  selected,
  motion,
  onOpen,
  ring,
  children,
}: {
  id: ExplainerId;
  selected: boolean;
  motion: boolean;
  onOpen(id: ExplainerId): void;
  ring: ReactNode;
  children: ReactNode;
}) {
  const e = EXPLAINERS[id];
  const onKey = (ev: KeyboardEvent<SVGGElement>) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      ev.stopPropagation();
      onOpen(id);
    }
  };
  return (
    <g
      className="bm-lm"
      role="button"
      tabIndex={0}
      aria-label={`Explainer: ${e.title}`}
      aria-pressed={selected}
      data-selected={selected ? "true" : "false"}
      data-motion={motion ? "on" : "off"}
      data-explainer={id}
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen(id);
      }}
      onKeyDown={onKey}
    >
      <title>{`EXPLAINER: ${e.title}`}</title>
      {ring}
      {children}
    </g>
  );
}

const CSS = `
.bm-lm{cursor:pointer;outline:none;pointer-events:auto}
.bm-lm__ring{fill:none;stroke:var(--bm-accent);stroke-width:2.5;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;opacity:0;pointer-events:none}
.bm-lm:hover .bm-lm__ring{opacity:.55}
.bm-lm:focus-visible .bm-lm__ring,.bm-lm[data-selected="true"] .bm-lm__ring{opacity:1}
@keyframes bm-lm-pulse{0%,100%{opacity:1}50%{opacity:.6}}
.bm-lm[data-selected="true"][data-motion="on"] .bm-lm__ring{animation:bm-lm-pulse 2.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.bm-lm__ring{animation:none!important}}
`;

/** Slot-driven rear/front split with the same mask Scenery uses (defs live in the layer root). */
function rearMask(kind: LandmarkKind): string | undefined {
  return isRearObject(slotRect(kind)) ? `url(#${OCCLUSION_MASK_ID})` : undefined;
}

export default function Landmarks({ selected = null, onOpen, reducedMotion }: LandmarksProps) {
  const geo = useMemo(
    () => ({
      clock: { c: centreOf("clock-tower"), ring: footprint(slotRect("clock-tower")) },
      gate: { c: centreOf("gatehouse"), ring: footprint(slotRect("gatehouse")) },
      board: { c: centreOf("notice-board"), ring: footprint(slotRect("notice-board")) },
    }),
    [],
  );
  const wrap = (id: ExplainerId, ring: ReactNode, children: ReactNode) => (
    <Landmark id={id} selected={selected === id} motion={!reducedMotion} onOpen={onOpen} ring={ring}>
      {children}
    </Landmark>
  );
  const lh = LIGHTHOUSE_BASE;
  return (
    <g data-layer="landmarks" style={{ pointerEvents: "none" }}>
      <style>{CSS}</style>
        {wrap(
          "private-compute",
          <rect className="bm-lm__ring" x={lh.x - 15} y={lh.y - 66} width={30} height={74} rx={10} />,
          <>
            <rect x={lh.x - 11} y={lh.y - 62} width={22} height={68} style={{ fill: "transparent" }} />
            <Pin x={lh.x} y={lh.y - 62} selected={selected === "private-compute"} />
          </>,
        )}
        {wrap(
          "boundary",
          <polygon className="bm-lm__ring" points={geo.gate.ring} />,
          <>
            <g mask={rearMask("gatehouse")}>
              <GatehouseArt />
            </g>
            <Pin x={geo.gate.c.x} y={geo.gate.c.y - 58} selected={selected === "boundary"} />
          </>,
        )}
        {wrap(
          "native-expiry",
          <polygon className="bm-lm__ring" points={geo.clock.ring} />,
          <>
            <g mask={rearMask("clock-tower")}>
              <ClockTowerArt />
            </g>
            <Pin x={geo.clock.c.x} y={geo.clock.c.y - 98} selected={selected === "native-expiry"} />
          </>,
        )}
        {wrap(
          "how-it-works",
          <polygon className="bm-lm__ring" points={geo.board.ring} />,
          <>
            <NoticeBoardArt />
            <Pin x={geo.board.c.x} y={geo.board.c.y - 58} selected={selected === "how-it-works"} />
          </>,
        )}
    </g>
  );
}
