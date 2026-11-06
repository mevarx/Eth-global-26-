// Original SVG art for the scenery blocks, one renderer per SceneryKind. Everything is drawn in
// WORLD pixels (iso-layout toWorld) from slot-relative tile coordinates (u along gx, v along gy),
// so nothing leaves its slot. Colours come from --bm-scene-* tokens only; no text, no state
// glyphs. Animated parts carry data-anim attributes that Scenery.tsx drives from one ticker.
import { Fragment, type ReactNode } from "react";
import { toWorld } from "./iso-layout";
import type { AnimKind, RenderableSceneryKind } from "./scenery-plan";
import type { GridRect } from "./slots";

interface Pt {
  x: number;
  y: number;
}
type P3 = readonly [number, number, number?];

const S = (v: string) => `var(--bm-scene-${v})`;
const INK = S("ink");
const mix = (a: string, b: string, pct: number) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;
const shade = (c: string) => mix(c, INK, 72);
const tint = (c: string) => mix(c, S("sign"), 78);
const EDGE = { stroke: INK, strokeOpacity: 0.4, strokeWidth: 0.8, strokeLinejoin: "round" } as const;
/** iso ellipse semi-axes for a circle of radius 1 tile */
const RX = 28.28;
const RY = 14.14;
const f1 = (n: number) => n.toFixed(1);

function frame(r: GridRect) {
  const at = (u: number, v: number, z = 0): Pt => {
    const p = toWorld({ gx: r.gx + u, gy: r.gy + v });
    return { x: p.x, y: p.y - z };
  };
  const pts = (list: readonly P3[]) =>
    list
      .map(([u, v, z]) => at(u, v, z ?? 0))
      .map((p) => `${f1(p.x)},${f1(p.y)}`)
      .join(" ");
  const d = (list: readonly P3[], close = true) =>
    list
      .map(([u, v, z], i) => {
        const p = at(u, v, z ?? 0);
        return `${i ? "L" : "M"}${f1(p.x)},${f1(p.y)}`;
      })
      .join("") + (close ? "Z" : "");
  return { at, pts, d, w: r.w, h: r.h };
}
type F = ReturnType<typeof frame>;
interface KP {
  rect: GridRect;
}

export function animAttrs(kind: AnimKind, period: number, phase = 0, amp = 0) {
  return { "data-anim": kind, "data-p": period, "data-ph": phase, "data-amp": amp };
}

// ---------- primitives ----------
function Poly({ f, pts, fill, line = true, opacity }: { f: F; pts: readonly P3[]; fill: string; line?: boolean; opacity?: number }) {
  return <polygon points={f.pts(pts)} style={{ fill, opacity, ...(line ? EDGE : null) }} />;
}

function Ground({ f, fill, inset = 0.04 }: { f: F; fill: string; inset?: number }) {
  const a = inset;
  return <Poly f={f} pts={[[a, a], [f.w - a, a], [f.w - a, f.h - a], [a, f.h - a]]} fill={fill} line={false} />;
}

interface Fills {
  top: string;
  right: string;
  left: string;
}
const fillsOf = (base: string): Fills => ({ top: tint(base), right: base, left: shade(base) });

function Box({ f, u0, v0, u1, v1, z0 = 0, h, fills }: { f: F; u0: number; v0: number; u1: number; v1: number; z0?: number; h: number; fills: Fills }) {
  const t = z0 + h;
  return (
    <>
      <Poly f={f} pts={[[u0, v1, z0], [u1, v1, z0], [u1, v1, t], [u0, v1, t]]} fill={fills.left} />
      <Poly f={f} pts={[[u1, v0, z0], [u1, v1, z0], [u1, v1, t], [u1, v0, t]]} fill={fills.right} />
      <Poly f={f} pts={[[u0, v0, t], [u1, v0, t], [u1, v1, t], [u0, v1, t]]} fill={fills.top} />
    </>
  );
}

function IsoEllipse({ f, u, v, r, z = 0, fill, style }: { f: F; u: number; v: number; r: number; z?: number; fill: string; style?: object }) {
  const c = f.at(u, v, z);
  return <ellipse cx={f1(c.x)} cy={f1(c.y)} rx={f1(r * RX)} ry={f1(r * RY)} style={{ fill, ...style }} />;
}

function Tree({ p, s = 1 }: { p: Pt; s?: number }) {
  return (
    <g transform={`translate(${f1(p.x)} ${f1(p.y)}) scale(${s})`}>
      <ellipse rx={10} ry={5} style={{ fill: INK, opacity: 0.18 }} />
      <rect x={-2} y={-12} width={4} height={12} style={{ fill: S("trunk") }} />
      <path d="M-10,-19a10,10 0 1,0 20,0a10,10 0 1,0 -20,0Z" style={{ fill: S("foliage-dark") }} />
      <path d="M-9.5,-23a5.5,5.5 0 1,0 11,0a5.5,5.5 0 1,0 -11,0ZM1,-17a4.5,4.5 0 1,0 9,0a4.5,4.5 0 1,0 -9,0Z" style={{ fill: S("foliage") }} />
    </g>
  );
}

function Bush({ p, s = 1 }: { p: Pt; s?: number }) {
  return <ellipse cx={f1(p.x)} cy={f1(p.y - 3 * s)} rx={f1(7 * s)} ry={f1(4.5 * s)} style={{ fill: S("foliage-dark"), stroke: S("foliage"), strokeWidth: 1.2 }} />;
}

/** Seat along `axis`, centred on (u, v); backrest on the +across side when back > 0. */
function Bench({ f, u, v, axis, back }: { f: F; u: number; v: number; axis: "u" | "v"; back: 1 | -1 }) {
  const m = (a: number, b: number, z: number): P3 => (axis === "u" ? [u + a, v + b, z] : [u + b, v + a, z]);
  const L = 0.34;
  const D = 0.11;
  const wood = S("wood");
  const rest = (
    <Poly f={f} pts={[m(-L, back * D, 5), m(L, back * D, 5), m(L, back * D, 11), m(-L, back * D, 11)]} fill={S("wood-dark")} />
  );
  const seat = (
    <>
      <Poly f={f} pts={[m(-L, D, 3), m(L, D, 3), m(L, D, 5), m(-L, D, 5)]} fill={shade(wood)} />
      <Poly f={f} pts={[m(-L, -D, 5), m(L, -D, 5), m(L, D, 5), m(-L, D, 5)]} fill={wood} />
    </>
  );
  return back < 0 ? (
    <>
      {rest}
      {seat}
    </>
  ) : (
    <>
      {seat}
      {rest}
    </>
  );
}

function Flag({ f, u, v, z0 = 0, h = 38, color = S("roof-red"), period = 3600 }: { f: F; u: number; v: number; z0?: number; h?: number; color?: string; period?: number }) {
  const base = f.at(u, v, z0);
  const top = f.at(u, v, z0 + h);
  return (
    <>
      <line x1={f1(base.x)} y1={f1(base.y)} x2={f1(top.x)} y2={f1(top.y)} style={{ stroke: S("wood-dark"), strokeWidth: 1.6, strokeLinecap: "round" }} />
      <g transform={`translate(${f1(top.x)} ${f1(top.y + 1)})`}>
        <g {...animAttrs("flag", period, 0.2, 0.1)}>
          <polygon points="0,0 15,1.5 13,5 15,8.5 0,8" style={{ fill: color, ...EDGE }} />
        </g>
      </g>
    </>
  );
}

interface Item {
  d: number;
  node: ReactNode;
}
const sorted = (items: Item[]) => [...items].sort((a, b) => a.d - b.d).map((it, i) => <Fragment key={i}>{it.node}</Fragment>);

const dotsPath = (pts: Pt[], r: number) => pts.map((p) => `M${f1(p.x - r)},${f1(p.y)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`).join("");

// ---------- park (6x6) ----------
function Park({ rect }: KP) {
  const f = frame(rect);
  const pond = f.at(3, 3);
  const pads = [f.at(2.45, 3.35), f.at(3.6, 2.55)];
  const benchSpots = [1.7, 4.3];
  const items: Item[] = [];
  for (const k of benchSpots) {
    items.push({ d: k + 0.4, node: <Bench f={f} u={k} v={0.4} axis="u" back={1} /> });
    items.push({ d: k + 5.6, node: <Bench f={f} u={k} v={5.6} axis="u" back={-1} /> });
    items.push({ d: k + 0.4, node: <Bench f={f} u={0.4} v={k} axis="v" back={1} /> });
    items.push({ d: k + 5.6, node: <Bench f={f} u={5.6} v={k} axis="v" back={-1} /> });
  }
  for (const [u, v, s] of [[0.85, 0.85, 1], [1.7, 1.7, 0.95], [4.3, 1.7, 1.05], [1.7, 4.3, 1], [5.15, 0.85, 0.95], [0.85, 5.15, 1.05], [5.15, 5.15, 1]] as const)
    items.push({ d: u + v, node: <Tree p={f.at(u, v)} s={s} /> });
  const patch = (u: number, v: number): Pt[] => [f.at(u, v), f.at(u + 0.22, v + 0.05), f.at(u - 0.1, v + 0.2), f.at(u + 0.12, v + 0.28), f.at(u + 0.3, v + 0.18)];
  return (
    <>
      <Ground f={f} fill={mix(S("grass"), S("sign"), 88)} />
      <path d={`${f.d([[0.3, 0.3], [5.7, 0.3], [5.7, 5.7], [0.3, 5.7]])}${f.d([[0.75, 0.75], [5.25, 0.75], [5.25, 5.25], [0.75, 5.25]])}`} fillRule="evenodd" style={{ fill: mix(S("path"), S("sand"), 62) }} />
      <path d={[[2.75, 0.75, 3.25, 1.65], [2.75, 4.35, 3.25, 5.25], [0.75, 2.75, 1.65, 3.25], [4.35, 2.75, 5.25, 3.25]].map(([a, b, c, d]) => f.d([[a, b], [c, b], [c, d], [a, d]])).join("")} style={{ fill: mix(S("path"), S("sand"), 62) }} />
      <IsoEllipse f={f} u={3} v={3} r={1.6} fill={S("stone")} style={EDGE} />
      <IsoEllipse f={f} u={3} v={3} r={1.38} fill={S("water")} />
      <IsoEllipse f={f} u={3} v={3} r={0.95} fill={S("water-deep")} style={{ opacity: 0.45 }} />
      {pads.map((p, i) => (
        <ellipse key={i} cx={f1(p.x)} cy={f1(p.y)} rx={6} ry={3} style={{ fill: S("foliage") }} />
      ))}
      {[0, 0.5].map((ph) => (
        <g key={ph} transform={`translate(${f1(pond.x)} ${f1(pond.y)})`}>
          <ellipse rx={f1(RX * 1.2)} ry={f1(RY * 1.2)} vectorEffect="non-scaling-stroke" style={{ fill: "none", stroke: S("sign"), strokeWidth: 1.2, opacity: 0.3 }} {...animAttrs("ripple", 4200, ph)} />
        </g>
      ))}
      <path d={dotsPath([...patch(2.1, 0.95), ...patch(3.7, 5.0)], 1.9)} style={{ fill: S("roof-red") }} />
      <path d={dotsPath([...patch(0.95, 3.7), ...patch(5.0, 2.1)], 1.9)} style={{ fill: S("lamp-glow") }} />
      {sorted(items)}
      <Flag f={f} u={4.3} v={4.3} h={42} />
    </>
  );
}

// ---------- market (6x2) ----------
function Market({ rect }: KP) {
  const f = frame(rect);
  const stalls = [0, 1, 2, 3, 4].map((i) => {
    const u0 = 0.25 + 1.1 * i;
    const u1 = u0 + 0.9;
    const col = i % 2 ? S("roof-blue") : S("roof-red");
    const seg = (k: number) => u0 + ((u1 - u0) * k) / 4;
    const awn = (a: number, b: number): P3[] => [[seg(a), 0.45, 24], [seg(b), 0.45, 24], [seg(b), 1.35, 17], [seg(a), 1.35, 17]];
    return (
      <Fragment key={i}>
        <path d={`${f.d([[u0 + 0.05, 0.5, 0], [u0 + 0.05, 0.5, 23]], false)}${f.d([[u1 - 0.05, 0.5, 0], [u1 - 0.05, 0.5, 23]], false)}${f.d([[u0 + 0.05, 1.25, 0], [u0 + 0.05, 1.25, 18]], false)}${f.d([[u1 - 0.05, 1.25, 0], [u1 - 0.05, 1.25, 18]], false)}`} style={{ stroke: S("wood-dark"), strokeWidth: 1.2, fill: "none" }} />
        <Box f={f} u0={u0 + 0.08} v0={0.85} u1={u1 - 0.08} v1={1.2} h={7} fills={fillsOf(S("wood"))} />
        <path d={dotsPath([f.at(u0 + 0.25, 1.0, 9), f.at(u0 + 0.45, 1.0, 9), f.at(u0 + 0.65, 1.0, 9)], 2)} style={{ fill: i % 2 ? S("lamp-glow") : S("foliage") }} />
        <Poly f={f} pts={awn(0, 4)} fill={col} />
        <Poly f={f} pts={awn(0, 1)} fill={S("sign")} />
        <Poly f={f} pts={awn(2, 3)} fill={S("sign")} />
      </Fragment>
    );
  });
  return (
    <>
      <Ground f={f} fill={mix(S("path"), S("sand"), 50)} />
      {stalls}
      <Box f={f} u0={1.0} v0={1.55} u1={1.4} v1={1.9} h={6} fills={fillsOf(S("crate"))} />
      <Box f={f} u0={3.4} v0={1.6} u1={3.8} v1={1.95} h={6} fills={fillsOf(S("crate"))} />
    </>
  );
}

// ---------- court (6x2) ----------
function Court({ rect }: KP) {
  const f = frame(rect);
  const line = { fill: "none", stroke: S("sign"), strokeWidth: 1, strokeLinejoin: "round" } as const;
  const hoop = (u: number, dir: 1 | -1) => (
    <>
      <line x1={f1(f.at(u, 1).x)} y1={f1(f.at(u, 1).y)} x2={f1(f.at(u, 1, 24).x)} y2={f1(f.at(u, 1, 24).y)} style={{ stroke: S("stone"), strokeWidth: 1.6 }} />
      <Poly f={f} pts={[[u, 0.78, 17], [u, 1.22, 17], [u, 1.22, 26], [u, 0.78, 26]]} fill={S("sign")} />
      <IsoEllipse f={f} u={u + dir * 0.18} v={1} z={17} r={0.12} fill="none" style={{ stroke: S("roof-red"), strokeWidth: 1.4 }} />
    </>
  );
  return (
    <>
      <Ground f={f} fill={S("grass")} />
      <Poly f={f} pts={[[0.45, 0.2], [5.55, 0.2], [5.55, 1.8], [0.45, 1.8]]} fill={S("court")} />
      <path d={`${f.d([[0.6, 0.35], [5.4, 0.35], [5.4, 1.65], [0.6, 1.65]])}${f.d([[3, 0.35], [3, 1.65]], false)}${f.d([[0.6, 0.65], [1.5, 0.65], [1.5, 1.35], [0.6, 1.35]])}${f.d([[5.4, 0.65], [4.5, 0.65], [4.5, 1.35], [5.4, 1.35]])}`} style={line} />
      <IsoEllipse f={f} u={3} v={1} r={0.3} fill="none" style={line} />
      <path d={`${f.d([[0.45, 0.1], [5.55, 0.1]], false)}${f.d([[0.45, 0.1, 9], [5.55, 0.1, 9]], false)}${[0.45, 1.3, 2.15, 3.0, 3.85, 4.7, 5.55].map((u) => f.d([[u, 0.1], [u, 0.1, 10]], false)).join("")}`} style={{ fill: "none", stroke: S("stone"), strokeWidth: 0.9 }} />
      {hoop(0.3, 1)}
      {hoop(5.7, -1)}
    </>
  );
}

// ---------- solar (6x2) ----------
function Solar({ rect }: KP) {
  const f = frame(rect);
  const rows = [[0.25, 0.75], [1.0, 1.5]] as const;
  const panels: ReactNode[] = [];
  rows.forEach(([v0, v1], r) =>
    [0, 1, 2, 3, 4].forEach((i) => {
      const u0 = 0.3 + i;
      const u1 = u0 + 0.85;
      const um = (u0 + u1) / 2;
      const vm = (v0 + v1) / 2;
      panels.push(
        <Fragment key={`${r}-${i}`}>
          <Poly f={f} pts={[[u0, v0, 9], [u1, v0, 9], [u1, v1, 4], [u0, v1, 4]]} fill={S("solar-panel")} />
          <path d={`${f.d([[u0, vm, 6.5], [u1, vm, 6.5]], false)}${f.d([[um, v0, 9], [um, v1, 4]], false)}`} style={{ fill: "none", stroke: S("sign"), strokeOpacity: 0.3, strokeWidth: 0.6 }} />
        </Fragment>,
      );
    }),
  );
  const glint = (u0: number, v0: number, v1: number, ph: number) => (
    <polygon
      key={`${u0}-${v0}`}
      points={f.pts([[u0 + 0.1, v0, 9], [u0 + 0.3, v0, 9], [u0 + 0.5, v1, 4], [u0 + 0.3, v1, 4]])}
      style={{ fill: S("sign"), opacity: 0.2 }}
      {...animAttrs("glint", 6400, ph)}
    />
  );
  return (
    <>
      <Ground f={f} fill={mix(S("grass"), S("sand"), 68)} />
      {panels.slice(0, 5)}
      {panels.slice(5)}
      {glint(1.3, 1.0, 1.5, 0)}
      {glint(3.3, 1.0, 1.5, 0.5)}
      <Box f={f} u0={5.3} v0={0.35} u1={5.8} v1={0.85} h={12} fills={fillsOf(S("wall-light"))} />
    </>
  );
}

// ---------- wind (6x2) ----------
const BLADES = [0, 120, 240]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    const rot = (x: number, y: number) => `${f1(x * Math.cos(a) - y * Math.sin(a))},${f1(x * Math.sin(a) + y * Math.cos(a))}`;
    return `M0,0L${rot(-2, -3)}L${rot(-1, -17)}L${rot(1, -17)}L${rot(2, -3)}Z`;
  })
  .join("");

function Wind({ rect }: KP) {
  const f = frame(rect);
  return (
    <>
      <Ground f={f} fill={mix(S("grass"), S("sand"), 85)} />
      {[1.0, 3.0, 5.0].map((u, i) => {
        const b = f.at(u, 1.0);
        const top = { x: b.x, y: b.y - 44 };
        return (
          <Fragment key={i}>
            <ellipse cx={f1(b.x)} cy={f1(b.y)} rx={9} ry={4.5} style={{ fill: INK, opacity: 0.18 }} />
            <polygon points={`${f1(b.x - 2.6)},${f1(b.y)} ${f1(b.x + 2.6)},${f1(b.y)} ${f1(top.x + 1.2)},${f1(top.y)} ${f1(top.x - 1.2)},${f1(top.y)}`} style={{ fill: S("wall-light"), ...EDGE }} />
            <ellipse cx={f1(top.x)} cy={f1(top.y)} rx={4.5} ry={2.8} style={{ fill: S("wall-shade"), ...EDGE }} />
            <g transform={`translate(${f1(top.x + 1)} ${f1(top.y + 1)}) matrix(1 0.5 0 1 0 0)`}>
              <g {...animAttrs("spin", 9000 + i * 1300, i * 0.31)}>
                <path d={BLADES} style={{ fill: S("sign"), ...EDGE }} />
                <circle r={2.2} style={{ fill: S("wall-shade"), ...EDGE }} />
              </g>
            </g>
          </Fragment>
        );
      })}
    </>
  );
}

// ---------- garden (6x2) ----------
function Garden({ rect }: KP) {
  const f = frame(rect);
  const beds: ReactNode[] = [];
  [0.2, 1.05].forEach((v0, r) =>
    [0, 1, 2].forEach((i) => {
      const u0 = 0.3 + 1.9 * i;
      const u1 = u0 + 1.6;
      const kind = (i + r) % 3;
      beds.push(
        <Fragment key={`${r}-${i}`}>
          <Poly f={f} pts={[[u0, v0, 1], [u1, v0, 1], [u1, v0 + 0.55, 1], [u0, v0 + 0.55, 1]]} fill={mix(S("wood-dark"), S("path"), 70)} />
          <path
            d={`${f.d([[u0 + 0.12, v0 + 0.15, 2], [u1 - 0.12, v0 + 0.15, 2]], false)}${f.d([[u0 + 0.12, v0 + 0.4, 2], [u1 - 0.12, v0 + 0.4, 2]], false)}`}
            style={{ fill: "none", strokeLinecap: "round", stroke: kind === 2 ? S("roof-red") : kind === 1 ? mix(S("foliage"), S("grass"), 60) : S("foliage"), strokeWidth: kind === 2 ? 3.4 : 3.2, strokeDasharray: kind === 2 ? "0.1 5.4" : "3.4 2.2" }}
          />
        </Fragment>,
      );
    }),
  );
  const stems = [0.4, 1.3, 2.2, 3.1, 4.0, 4.9].map((u) => f.at(u, 0.1));
  return (
    <>
      <Ground f={f} fill={S("grass")} />
      <path d={stems.map((p) => `M${f1(p.x)},${f1(p.y)}v-9`).join("")} style={{ stroke: S("foliage-dark"), strokeWidth: 1.2, fill: "none" }} />
      <path d={dotsPath(stems.map((p) => ({ x: p.x, y: p.y - 10 })), 2.6)} style={{ fill: S("lamp-glow"), ...EDGE }} />
      {beds}
      <IsoEllipse f={f} u={2.05} v={0.95} z={7} r={0.14} fill={S("water-deep")} style={EDGE} />
    </>
  );
}

// ---------- bus station (2x6) ----------
function BusStation({ rect }: KP) {
  const f = frame(rect);
  const pole = f.at(0.45, 3.5);
  const top = f.at(0.45, 3.5, 30);
  const lamp = f.at(0.4, 4.8, 28);
  return (
    <>
      <Ground f={f} fill={mix(S("stone"), S("sand"), 34)} />
      <Poly f={f} pts={[[0.1, 0.2, 0.5], [0.24, 0.2, 0.5], [0.24, 5.8, 0.5], [0.1, 5.8, 0.5]]} fill={S("stone")} />
      <Tree p={f.at(1.55, 0.5)} s={0.9} />
      <path d={[[0.55, 0.9], [0.55, 2.7], [1.45, 0.9], [1.45, 2.7]].map(([u, v]) => f.d([[u, v, 0], [u, v, 22]], false)).join("")} style={{ stroke: S("wood-dark"), strokeWidth: 1.4, fill: "none" }} />
      <Poly f={f} pts={[[1.45, 0.9, 3], [1.45, 2.7, 3], [1.45, 2.7, 21], [1.45, 0.9, 21]]} fill={S("window")} opacity={0.6} />
      <Bench f={f} u={1.25} v={1.8} axis="v" back={1} />
      <Box f={f} u0={0.4} v0={0.75} u1={1.6} v1={2.85} z0={21} h={2} fills={{ top: S("roof-blue"), right: shade(S("roof-blue")), left: shade(S("roof-blue")) }} />
      <line x1={f1(pole.x)} y1={f1(pole.y)} x2={f1(top.x)} y2={f1(top.y)} style={{ stroke: S("stone"), strokeWidth: 1.6 }} />
      <circle cx={f1(top.x)} cy={f1(top.y - 3)} r={5} style={{ fill: S("roof-blue"), ...EDGE }} />
      <circle cx={f1(top.x)} cy={f1(top.y - 3)} r={2.4} style={{ fill: S("sign") }} />
      <line x1={f1(f.at(0.4, 4.8).x)} y1={f1(f.at(0.4, 4.8).y)} x2={f1(lamp.x)} y2={f1(lamp.y)} style={{ stroke: INK, strokeWidth: 1.4 }} />
      <circle cx={f1(lamp.x)} cy={f1(lamp.y - 2)} r={3} style={{ fill: S("lamp-glow"), opacity: 0.85 }} />
      <path d={[1.0, 1.25, 1.5].map((u) => f.d([[u, 4.0, 0], [u, 4.0, 6], [u, 4.35, 6], [u, 4.35, 0]], false)).join("")} style={{ stroke: S("stone"), strokeWidth: 1.1, fill: "none" }} />
      <Tree p={f.at(1.5, 5.4)} s={1} />
    </>
  );
}

// ---------- playground (2x6) ----------
function Playground({ rect }: KP) {
  const f = frame(rect);
  const swing = (v: number, ph: number) => {
    const p = f.at(1.0, v, 26);
    return (
      <g key={v} transform={`translate(${f1(p.x)} ${f1(p.y)})`}>
        <g {...animAttrs("sway", 3200, ph, 14)}>
          <path d="M-2.6,0V16M2.6,0V16" style={{ stroke: INK, strokeWidth: 0.7, fill: "none" }} />
          <rect x={-4} y={16} width={8} height={2.2} rx={0.8} style={{ fill: S("roof-red"), ...EDGE }} />
        </g>
      </g>
    );
  };
  return (
    <>
      <Ground f={f} fill={mix(S("sand"), S("grass"), 72)} />
      <Tree p={f.at(1.6, 0.4)} s={1} />
      <path d={`${[0.8, 1.9].map((v) => f.d([[0.75, v, 0], [1.0, v, 26], [1.25, v, 0]], false)).join("")}${f.d([[1.0, 0.8, 26], [1.0, 1.9, 26]], false)}`} style={{ stroke: S("wood-dark"), strokeWidth: 1.6, strokeLinejoin: "round", fill: "none" }} />
      {swing(1.1, 0)}
      {swing(1.6, 0.35)}
      <Box f={f} u0={0.5} v0={2.6} u1={0.9} v1={3.0} h={18} fills={fillsOf(S("wood"))} />
      <path d={`${f.d([[0.5, 3.0, 0], [0.5, 3.0, 17]], false)}${f.d([[0.9, 3.0, 0], [0.9, 3.0, 17]], false)}${[4, 8, 12].map((z) => f.d([[0.5, 3.0, z], [0.9, 3.0, z]], false)).join("")}`} style={{ stroke: S("wood-dark"), strokeWidth: 1, fill: "none" }} />
      <Poly f={f} pts={[[0.9, 2.65, 18], [0.9, 2.95, 18], [1.8, 2.95, 1], [1.8, 2.65, 1]]} fill={S("sign")} />
      <Poly f={f} pts={[[0.9, 4.0, 4], [1.1, 4.0, 4], [1.0, 4.0, 0]]} fill={S("wood-dark")} />
      <Poly f={f} pts={[[0.3, 3.93, 9], [1.7, 3.93, 3], [1.7, 4.07, 3], [0.3, 4.07, 9]]} fill={S("roof-blue")} />
      <Box f={f} u0={0.3} v0={4.7} u1={1.3} v1={5.6} h={3} fills={fillsOf(S("wood"))} />
      <Poly f={f} pts={[[0.38, 4.78, 3], [1.22, 4.78, 3], [1.22, 5.52, 3], [0.38, 5.52, 3]]} fill={S("sand")} line={false} />
      <Tree p={f.at(1.6, 5.6)} s={0.9} />
    </>
  );
}

// ---------- amphitheater (2x6) ----------
function Amphitheater({ rect }: KP) {
  const f = frame(rect);
  const cu = 1.0;
  const cv = 4.6;
  const arc = (au: number, bv: number, z: number) =>
    Array.from({ length: 13 }, (_, i): P3 => {
      const t = (i / 12) * Math.PI;
      return [cu + au * Math.cos(t), cv - bv * Math.sin(t), z];
    });
  const tiers = [3, 2, 1, 0].map((k) => {
    const au = 0.5 + 0.145 * k;
    const bv = 1.2 + 0.93 * k;
    const z = 4 * (k + 1);
    return (
      <Fragment key={k}>
        <Poly f={f} pts={arc(au, bv, z - 4)} fill={S("stone")} />
        <Poly f={f} pts={arc(au, bv, z)} fill={k % 2 ? mix(S("stone"), S("sign"), 66) : mix(S("stone"), S("sign"), 82)} />
      </Fragment>
    );
  });
  return (
    <>
      <Ground f={f} fill={S("grass")} />
      <Tree p={f.at(0.25, 0.35)} s={0.95} />
      <Tree p={f.at(1.75, 0.35)} s={0.95} />
      {tiers}
      <Flag f={f} u={1.0} v={0.75} z0={16} h={30} color={S("roof-blue")} period={4100} />
      <Box f={f} u0={0.3} v0={4.7} u1={1.7} v1={5.7} h={4} fills={fillsOf(S("wood"))} />
      <path d={[[0.35, 4.75], [1.65, 4.75], [0.35, 5.65], [1.65, 5.65]].map(([u, v]) => f.d([[u, v, 4], [u, v, 22]], false)).join("")} style={{ stroke: S("wood-dark"), strokeWidth: 1.3, fill: "none" }} />
      <Poly f={f} pts={[[0.2, 4.6, 22], [1.8, 4.6, 22], [1.8, 5.8, 22], [0.2, 5.8, 22]]} fill={S("roof-red")} />
    </>
  );
}

// ---------- dock (2x4) ----------
function Dock({ rect }: KP) {
  const f = frame(rect);
  const tip = f.at(1.7, 2.0, 44);
  const bar = (u: number, v: number, z = 0) => f.at(u, v, z);
  const items: Item[] = [
    { d: 1.0, node: <Box f={f} u0={0.3} v0={0.25} u1={0.8} v1={0.75} h={7} fills={fillsOf(S("crate"))} /> },
    { d: 1.2, node: <Box f={f} u0={0.35} v0={0.3} u1={0.75} v1={0.7} z0={7} h={6} fills={fillsOf(S("crate"))} /> },
    { d: 1.8, node: <Box f={f} u0={1.05} v0={0.3} u1={1.5} v1={0.75} h={7} fills={fillsOf(S("crate"))} /> },
    { d: 3.6, node: <Box f={f} u0={0.4} v0={3.15} u1={0.85} v1={3.65} h={7} fills={fillsOf(S("crate"))} /> },
    { d: 4.2, node: <Box f={f} u0={0.95} v0={3.25} u1={1.35} v1={3.65} h={6} fills={fillsOf(S("crate"))} /> },
    {
      d: 2.2,
      node: (
        <>
          <Box f={f} u0={0.5} v0={1.0} u1={0.95} v1={1.35} h={6} fills={fillsOf(S("stone"))} />
          <Box f={f} u0={0.65} v0={1.1} u1={0.8} v1={1.25} z0={6} h={40} fills={fillsOf(S("roof-red"))} />
          <path d={`${f.d([[0.3, 0.7, 44], [1.7, 2.0, 44]], false)}`} style={{ stroke: S("roof-red"), strokeWidth: 2.2, strokeLinecap: "round", fill: "none" }} />
          <g transform={`translate(${f1(tip.x)} ${f1(tip.y)})`}>
            <g {...animAttrs("sway", 4800, 0.1, 5)}>
              <line x1={0} y1={0} x2={0} y2={22} style={{ stroke: INK, strokeWidth: 0.9 }} />
              <rect x={-4.5} y={22} width={9} height={6.5} style={{ fill: S("crate"), ...EDGE }} />
            </g>
          </g>
        </>
      ),
    },
    {
      d: 3.4,
      node: (
        <>
          <line x1={f1(bar(1.9, 3.6).x)} y1={f1(bar(1.9, 3.6).y)} x2={f1(bar(1.9, 3.6, 26).x)} y2={f1(bar(1.9, 3.6, 26).y)} style={{ stroke: INK, strokeWidth: 1.4 }} />
          <circle cx={f1(bar(1.9, 3.6, 28).x)} cy={f1(bar(1.9, 3.6, 28).y)} r={3} style={{ fill: S("lamp-glow"), opacity: 0.85 }} />
        </>
      ),
    },
  ];
  return (
    <>
      <Ground f={f} fill={mix(S("sand-dark"), S("sand"), 60)} />
      <Box f={f} u0={0.15} v0={1.5} u1={1.95} v1={2.5} h={2} fills={fillsOf(S("wood"))} />
      <path d={[0.45, 0.75, 1.05, 1.35, 1.65].map((u) => f.d([[u, 1.5, 2], [u, 2.5, 2]], false)).join("")} style={{ stroke: S("wood-dark"), strokeWidth: 0.7, fill: "none" }} />
      {[1.5, 2.5].map((v) => (
        <circle key={v} cx={f1(bar(1.85, v, 4).x)} cy={f1(bar(1.85, v, 4).y)} r={2.2} style={{ fill: S("stone"), ...EDGE }} />
      ))}
      {sorted(items)}
    </>
  );
}

// ---------- grove ----------
function Grove({ rect }: KP) {
  const f = frame(rect);
  const big = rect.w * rect.h >= 8;
  const spots: Array<[number, number, number]> = big
    ? Array.from({ length: 9 }, (_, i): [number, number, number] => [0.5 + (i * 5) / 8, 0.55 + (((i * 7) % 5) / 5) * 0.9, 0.85 + ((i * 3) % 4) * 0.1])
    : [[0.55, 0.6, 1], [1.4, 0.9, 0.9], [0.8, 1.45, 0.95]];
  const bushes: Array<[number, number]> = big ? [[0.9, 1.7], [2.9, 0.4], [4.8, 1.6]] : [[1.5, 1.6]];
  const items: Item[] = [
    ...spots.map(([u, v, s]): Item => ({ d: u + v, node: <Tree p={f.at(u, v)} s={s} /> })),
    ...bushes.map(([u, v]): Item => ({ d: u + v, node: <Bush p={f.at(u, v)} /> })),
  ];
  return (
    <>
      <Ground f={f} fill={mix(S("grass"), S("grass-dark"), 60)} />
      {sorted(items)}
    </>
  );
}

export const SCENERY_RENDERERS: Record<RenderableSceneryKind, (p: KP) => ReactNode> = {
  park: Park,
  market: Market,
  court: Court,
  solar: Solar,
  wind: Wind,
  garden: Garden,
  "bus-station": BusStation,
  playground: Playground,
  amphitheater: Amphitheater,
  dock: Dock,
  grove: Grove,
};
