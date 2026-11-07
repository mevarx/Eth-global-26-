// Tool City game renderer (PixiJS 8): a full-screen isometric tile island you can
// pan and zoom. Everything is drawn procedurally, no external images or fonts.
// The engine only READS CityState; it never calls the API, the wallet or React state.
// Walks, stamps and pulses are decoration triggered by observed state changes.
import { Application, Container, Graphics, Text, type TextStyleFontWeight } from "pixi.js";
import type { CityState, QuestKind } from "../city-state";
import { isoGeometry, lerp, type IsoGeometry, type Pt } from "../iso-geometry";
import { keyBuildingDef } from "../iso-buildings";
import {
  GRID_N,
  KEY_BLOCKS,
  KEY_PLOTS,
  PLAZA_BLOCK,
  ROAD_LINES,
  SAND_RING,
  blockOrigin,
  doorFor,
  isRoadCell,
  isSandCell,
  isoRoute,
  toWorld,
  type GridPt,
} from "../iso-layout";
import { BUILDINGS, type BuildingDef, type BuildingId } from "../scene-config";
import { easeInOut } from "../walk-path";

export type MotionMode = "on" | "paused" | "off";
export interface CameraState {
  x: number;
  y: number;
  z: number;
}

const FONT = "system-ui, sans-serif";
const INK = 0x1b2a33;
const TAU = Math.PI * 2;
const WATER = 0x3a8fcc;
const DOOR_MS = 900;
const POP_MS = 420;
const STAMP_MS = 520;
const WALK_PX_PER_S = 95;
const BOUNDS = { minX: -GRID_N * 20 - 40, maxX: GRID_N * 20 + 40, minY: -140, maxY: GRID_N * 20 + 40 };

function shade(color: string | number, f: number): number {
  const n = typeof color === "number" ? color : parseInt(color.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255);
}

/** Deterministic decoration placement (never used for state). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function label(s: string, size: number, fill: string, weight: TextStyleFontWeight = "700", halo = true): Text {
  const t = new Text({
    text: s,
    resolution: 3,
    style: {
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      fill,
      letterSpacing: 0.6,
      ...(halo ? { stroke: { color: "#fbf8ef", width: 4, join: "round" as const } } : {}),
    },
  });
  t.anchor.set(0.5);
  return t;
}

const easeOutBack = (x: number) => 1 + 2.6 * Math.pow(x - 1, 3) + 1.6 * Math.pow(x - 1, 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function tile(gx: number, gy: number): Pt[] {
  return [toWorld({ gx, gy }), toWorld({ gx: gx + 1, gy }), toWorld({ gx: gx + 1, gy: gy + 1 }), toWorld({ gx, gy: gy + 1 })];
}

function winPts(a: Pt, b: Pt, t0: number, t1: number, lift: number, h = 12): Pt[] {
  const x0 = lerp(a.x, b.x, t0);
  const x1 = lerp(a.x, b.x, t1);
  const y0 = lerp(a.y, b.y, t0);
  const y1 = lerp(a.y, b.y, t1);
  return [
    { x: x0, y: y0 - lift - h },
    { x: x1, y: y1 - lift - h },
    { x: x1, y: y1 - lift },
    { x: x0, y: y0 - lift },
  ];
}

function inset(ps: Pt[], f: number): Pt[] {
  const c = ps.reduce((s, p) => ({ x: s.x + p.x / ps.length, y: s.y + p.y / ps.length }), { x: 0, y: 0 });
  return ps.map((p) => ({ x: lerp(p.x, c.x, f), y: lerp(p.y, c.y, f) }));
}

/** Dashed closed polyline; `offset` (px) shifts the dash pattern; `upTo` (0..1) draws it in. */
function dashedPoly(g: Graphics, ps: Pt[], dash: number, gap: number, offset = 0, upTo = 1) {
  const segs = ps.map((a, i) => {
    const b = ps[(i + 1) % ps.length];
    return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const total = segs.reduce((s, x) => s + x.len, 0);
  const limit = total * upTo;
  const period = dash + gap;
  let start = -(((offset % period) + period) % period);
  let acc = 0;
  for (const s of segs) {
    for (let d = start; d < s.len; d += period) {
      const d0 = Math.max(0, d);
      const d1 = Math.min(s.len, d + dash);
      if (d1 <= d0 || acc + d0 > limit) continue;
      const e = Math.min(d1, limit - acc);
      g.moveTo(lerp(s.a.x, s.b.x, d0 / s.len), lerp(s.a.y, s.b.y, d0 / s.len)).lineTo(
        lerp(s.a.x, s.b.x, e / s.len),
        lerp(s.a.y, s.b.y, e / s.len),
      );
    }
    start = ((start - s.len) % period + period) % period - period;
    acc += s.len;
  }
}

function dashedCircle(g: Graphics, cx: number, cy: number, r: number, n = 12) {
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * TAU;
    const a1 = a0 + (0.6 / n) * TAU;
    g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    for (let s = 1; s <= 3; s++) {
      const a = lerp(a0, a1, s / 3);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }
}

interface BuildingView {
  def: BuildingDef;
  geo: IsoGeometry;
  index: number;
  root: Container;
  body: Container;
  shadow: Graphics;
  lit: Graphics[];
  door: Graphics;
  decor: Container;
  under: Container;
  hover: number;
  press: number;
  doorStart: number | null;
}

interface Decor {
  puffs: Graphics[];
  dish: Graphics | null;
  dataDots: Graphics[];
  amber: Graphics | null;
  emblem: Container | null;
  stamp: Container | null;
  stampOut: Graphics | null;
  orbit: Graphics | null;
  scan: Graphics | null;
  boxes: Container | null;
}

const emptyDecor = (): Decor => ({
  puffs: [],
  dish: null,
  dataDots: [],
  amber: null,
  emblem: null,
  stamp: null,
  stampOut: null,
  orbit: null,
  scan: null,
  boxes: null,
});

export class CityEngine {
  private app: Application;
  private host: HTMLElement;
  private world = new Container();
  private ground = new Container();
  private depth = new Container();
  private overlayLayer = new Container();
  private ui = new Container();
  private views = new Map<BuildingId, BuildingView>();
  private decor = emptyDecor();
  private mode: MotionMode = "on";
  private t = 0;
  private city: CityState | null = null;
  private selected: BuildingId | null = null;
  private selStart = -1e9;
  private hovered: BuildingId | null = null;
  private ripples: Array<{ g: Graphics; start: number }> = [];
  private stampStart = -1e9;
  private stampOutStart = -1e9;
  private scanStart = -1e9;
  private boxesStart = -1e9;
  private resizeObs: ResizeObserver | null = null;
  private cleanup: Array<() => void> = [];

  // camera
  private cam: CameraState = { x: 0, y: 0, z: 1 };
  private fitZ = 1;
  private userMoved = false;
  private onCamera: ((c: CameraState) => void) | null;
  private drag: { id: number; sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null;
  private pinch: { d: number; z: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private suppressClick = false;

  // scenery
  private waves: Array<{ g: Graphics; x: number; y: number; p: number }> = [];
  private foam!: Graphics;
  private trees: Array<{ c: Container; p: number }> = [];
  private glows: Graphics[] = [];
  private jet!: Graphics;
  private fountainRipples: Graphics[] = [];
  private clouds: Array<{ g: Graphics; speed: number; off: number; y: number }> = [];
  private birds!: Container;
  private birdWings: Graphics[] = [];
  private beam!: Graphics;
  private selRing = new Graphics();
  private quest = new Container();
  private questBg = new Graphics();
  private questText = label("!", 15, "#3d2c05", "700", false);

  // worker
  private worker = new Container();
  private wFace = new Container();
  private wBody = new Container();
  private wLegL = new Graphics();
  private wLegR = new Graphics();
  private wArmL = new Graphics();
  private wArmR = new Graphics();
  private wHead = new Container();
  private wCarry = new Container();
  private wAlert = new Container();
  private wWait = new Container();
  private wWaitDots: Graphics[] = [];
  private wGrid: GridPt = doorFor("home");
  private walk: { path: GridPt[]; world: Pt[]; lens: number[]; total: number; start: number; dur: number; to: BuildingId | null } | null = null;
  private stride = 0;

  private constructor(app: Application, host: HTMLElement, onCamera: ((c: CameraState) => void) | null, private reservedWidth: () => number) {
    this.app = app;
    this.host = host;
    this.onCamera = onCamera;
  }

  static async create(host: HTMLElement, opts: { onCamera?: (c: CameraState) => void; reservedWidth?: () => number } = {}): Promise<CityEngine> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      antialias: true,
      background: WATER,
      autoDensity: true,
      preference: "webgl",
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    const engine = new CityEngine(app, host, opts.onCamera ?? null, opts.reservedWidth ?? (() => 0));
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.display = "block";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    engine.build();
    engine.fit();
    engine.resizeObs = new ResizeObserver(() => {
      app.resize();
      if (!engine.userMoved) engine.fit();
      else engine.applyCamera();
    });
    engine.resizeObs.observe(host);
    engine.bindInput();
    app.ticker.add((tk) => engine.update(tk.deltaMS));
    return engine;
  }

  destroy() {
    this.resizeObs?.disconnect();
    this.cleanup.forEach((f) => f());
    this.app.destroy({ removeView: true }, { children: true });
  }

  // camera

  private viewport() {
    const w = this.host.clientWidth || 800;
    const h = this.host.clientHeight || 600;
    const reserve = this.reservedWidth();
    return { w, h, reserve };
  }

  /** Fit the island in the area left of the console window. */
  fit() {
    const { w, h, reserve } = this.viewport();
    const bw = BOUNDS.maxX - BOUNDS.minX;
    const bh = BOUNDS.maxY - BOUNDS.minY;
    const z = Math.min((w - reserve) / bw, h / bh) * 0.98;
    this.fitZ = z;
    // Phones start closer in; the whole island is one pinch away.
    const z0 = clamp(z * (w < 700 ? 1.9 : 1.08), z * 0.8, z * 4);
    this.cam = {
      z: z0,
      x: (w - reserve) / 2 - ((BOUNDS.minX + BOUNDS.maxX) / 2) * z0,
      y: h / 2 - ((BOUNDS.minY + BOUNDS.maxY) / 2) * z0,
    };
    this.userMoved = false;
    this.applyCamera();
  }

  zoomBy(f: number, sx?: number, sy?: number) {
    const { w, h, reserve } = this.viewport();
    const px = sx ?? (w - reserve) / 2;
    const py = sy ?? h / 2;
    const z = clamp(this.cam.z * f, this.fitZ * 0.8, this.fitZ * 4);
    const k = z / this.cam.z;
    this.cam = { z, x: px - (px - this.cam.x) * k, y: py - (py - this.cam.y) * k };
    this.userMoved = true;
    this.applyCamera();
  }

  private applyCamera() {
    const { w, h } = this.viewport();
    const z = this.cam.z;
    // Keep part of the island on screen.
    this.cam.x = clamp(this.cam.x, -BOUNDS.maxX * z + 120, w - BOUNDS.minX * z - 120);
    this.cam.y = clamp(this.cam.y, -BOUNDS.maxY * z + 120, h - BOUNDS.minY * z - 120);
    this.world.position.set(this.cam.x, this.cam.y);
    this.world.scale.set(z);
    this.onCamera?.({ ...this.cam });
    this.requestRender();
  }

  camera(): CameraState {
    return { ...this.cam };
  }

  /** True once if the last pointer gesture was a drag (so the click should be ignored). */
  consumeDrag(): boolean {
    const v = this.suppressClick;
    this.suppressClick = false;
    return v;
  }

  private bindInput() {
    const el = this.host;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z };
        this.drag = null;
        return;
      }
      this.suppressClick = false;
      this.drag = { id: e.pointerId, sx: p.x, sy: p.y, cx: this.cam.x, cy: this.cam.y, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const target = this.pinch.z * (d / Math.max(1, this.pinch.d));
        this.zoomBy(target / this.cam.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.suppressClick = true;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      el.dataset.dragging = "true";
      this.cam.x = d.cx + dx;
      this.cam.y = d.cy + dy;
      this.userMoved = true;
      this.applyCamera();
    };
    const onUp = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.drag && this.drag.id === e.pointerId) {
        if (this.drag.moved) this.suppressClick = true;
        this.drag = null;
        delete el.dataset.dragging;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    this.cleanup.push(() => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    });
  }

  // public API (presentation only)

  setMotion(mode: MotionMode) {
    this.mode = mode;
    if (mode === "on") {
      this.app.ticker.start();
    } else {
      this.app.ticker.stop();
      if (mode === "off") this.renderStatic();
    }
  }

  setState(city: CityState) {
    const prev = this.city;
    this.city = city;
    const animate = this.mode === "on";
    const sameBrief = prev !== null && city.briefId !== null && prev.briefId === city.briefId;
    const target = doorFor(city.worker.building ?? "home");

    // First render, a different brief, or motion not running: jump, no travel or replay.
    if (!sameBrief || !animate) {
      this.walk = null;
      this.wGrid = { ...target };
    } else if (Math.abs(target.gx - this.wGrid.gx) + Math.abs(target.gy - this.wGrid.gy) > 0.01) {
      const path = isoRoute(this.wGrid, target);
      const world = path.map(toWorld);
      const lens = world.slice(1).map((p, i) => Math.hypot(p.x - world[i].x, p.y - world[i].y));
      const total = lens.reduce((a, b) => a + b, 0);
      const dur = clamp((total / WALK_PX_PER_S) * 1000, 600, 4500);
      this.walk = { path, world, lens, total, start: this.t, dur, to: city.worker.building };
    }

    if (sameBrief && animate && prev) {
      if (prev.release !== "approved" && city.release === "approved") this.stampStart = this.t;
      if (prev.release === "approved" && city.release !== "approved") this.stampOutStart = this.t;
      if (
        prev.registry === "live" &&
        city.registry === "live" &&
        city.registryObservedAt !== null &&
        prev.registryObservedAt !== city.registryObservedAt
      ) {
        this.scanStart = this.t;
      }
    }
    if (animate && prev && prev.briefId === null && city.briefId !== null) this.boxesStart = this.t;
    if (!animate) this.stampStart = this.stampOutStart = this.scanStart = this.boxesStart = -1e9;

    this.buildDecor(city);
    this.drawWorkerProps(city);
    this.drawQuest(city.quest);
    this.renderStatic();
  }

  setSelected(id: BuildingId | null) {
    if (id === this.selected) return;
    this.selected = id;
    this.selStart = this.mode === "on" ? this.t : -1e9;
    this.renderStatic();
  }

  setHover(id: BuildingId | null) {
    this.hovered = id;
    this.renderStatic();
  }

  /** Click feedback: squash + ground ripple. Cosmetic only. */
  ping(id: BuildingId) {
    if (this.mode !== "on") return;
    const v = this.views.get(id);
    if (!v) return;
    v.press = 1;
    const g = new Graphics();
    this.overlayLayer.addChild(g);
    g.position.set(v.def.cx, v.def.cy);
    this.ripples.push({ g, start: this.t });
  }

  // scene construction

  private build() {
    this.app.stage.addChild(this.world);
    this.world.addChild(this.ground, this.overlayLayer, this.depth, this.ui);
    this.depth.sortableChildren = true;
    this.buildSea();
    this.buildIsland();
    this.buildPlaza();
    this.buildTreesAndLamps();
    BUILDINGS.forEach((b, i) => this.buildKeyBuilding(keyBuildingDef(b.id), i));
    this.buildWorker();
    this.buildSky();
    this.overlayLayer.addChild(this.selRing);
    this.quest.addChild(this.questBg, this.questText);
    this.ui.addChild(this.quest);
  }

  private buildSea() {
    const r = seeded(7);
    for (let i = 0; i < 140; i++) {
      const x = -1400 + r() * 2800;
      const y = -700 + r() * 2000;
      const p = toWorld({ gx: 0, gy: 0 });
      const inIsland = Math.abs(x - p.x) / (GRID_N * 20 + 60) + Math.abs(y - GRID_N * 10) / (GRID_N * 10 + 30) < 1;
      if (inIsland) continue;
      const w = new Graphics();
      w.moveTo(-7, 0).lineTo(7, 0).stroke({ width: 2, color: 0xbfe3f5, alpha: 0.9, cap: "round" });
      w.position.set(x, y);
      this.ground.addChild(w);
      this.waves.push({ g: w, x, y, p: r() });
    }
  }

  private buildIsland() {
    const g = new Graphics();
    // shallow water halo
    const N = GRID_N;
    const halo = [toWorld({ gx: -2.5, gy: -2.5 }), toWorld({ gx: N + 2.5, gy: -2.5 }), toWorld({ gx: N + 2.5, gy: N + 2.5 }), toWorld({ gx: -2.5, gy: N + 2.5 })];
    g.poly(halo).fill({ color: 0x5fb6e0, alpha: 0.75 });
    const halo2 = [toWorld({ gx: -1, gy: -1 }), toWorld({ gx: N + 1, gy: -1 }), toWorld({ gx: N + 1, gy: N + 1 }), toWorld({ gx: -1, gy: N + 1 })];
    g.poly(halo2).fill({ color: 0x7cc8e8, alpha: 0.8 });
    this.foam = new Graphics();
    this.foam.poly([toWorld({ gx: -0.4, gy: -0.4 }), toWorld({ gx: N + 0.4, gy: -0.4 }), toWorld({ gx: N + 0.4, gy: N + 0.4 }), toWorld({ gx: -0.4, gy: N + 0.4 })]).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });

    const r = seeded(19);
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        const edge = Math.min(gx, gy, N - 1 - gx, N - 1 - gy);
        if (edge === 0 && r() < 0.35) continue; // ragged coast
        const ps = tile(gx, gy);
        if (isSandCell(gx, gy)) {
          g.poly(ps).fill((gx + gy) % 2 ? 0xead7a4 : 0xe1cc95);
        } else if (isRoadCell(gx, gy)) {
          g.poly(ps).fill(0x9aa3ab);
        } else {
          const v = r();
          const base = (gx + gy) % 2 ? 0x7fc35f : 0x76b956;
          g.poly(ps).fill(v < 0.12 ? shade(base, 1.06) : v > 0.92 ? shade(base, 0.95) : base);
        }
      }
    }
    // road edges + centre dashes
    const lines = ROAD_LINES as readonly number[];
    for (const c of lines) {
      for (let k = SAND_RING; k < N - SAND_RING; k++) {
        if (lines.includes(k)) continue;
        // column road c (varying gy)
        const a = toWorld({ gx: c + 0.5, gy: k + 0.2 });
        const b = toWorld({ gx: c + 0.5, gy: k + 0.6 });
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.6, color: 0xf4f1e6, alpha: 0.9 });
        const a2 = toWorld({ gx: k + 0.2, gy: c + 0.5 });
        const b2 = toWorld({ gx: k + 0.6, gy: c + 0.5 });
        g.moveTo(a2.x, a2.y).lineTo(b2.x, b2.y).stroke({ width: 1.6, color: 0xf4f1e6, alpha: 0.9 });
      }
      // kerbs
      for (const off of [0, 1]) {
        const p0 = toWorld({ gx: c + off, gy: SAND_RING });
        const p1 = toWorld({ gx: c + off, gy: N - SAND_RING });
        g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 1.2, color: 0xd9dde0, alpha: 0.9 });
        const q0 = toWorld({ gx: SAND_RING, gy: c + off });
        const q1 = toWorld({ gx: N - SAND_RING, gy: c + off });
        g.moveTo(q0.x, q0.y).lineTo(q1.x, q1.y).stroke({ width: 1.2, color: 0xd9dde0, alpha: 0.9 });
      }
    }
    // crosswalk squares at intersections
    for (const a of lines)
      for (const b of lines) {
        const c = toWorld({ gx: a + 0.5, gy: b + 0.5 });
        g.poly([{ x: c.x, y: c.y - 4 }, { x: c.x + 8, y: c.y }, { x: c.x, y: c.y + 4 }, { x: c.x - 8, y: c.y }]).fill({ color: 0xffffff, alpha: 0.35 });
      }
    this.ground.addChild(g, this.foam);
  }

  private buildPlaza() {
    const o = blockOrigin(PLAZA_BLOCK.bx, PLAZA_BLOCK.by);
    const g = new Graphics();
    for (let x = 0; x < 6; x++)
      for (let y = 0; y < 6; y++) {
        const ring = x === 0 || y === 0 || x === 5 || y === 5;
        g.poly(tile(o.gx + x, o.gy + y)).fill(ring ? 0x7fc35f : (x + y) % 2 ? 0xe9e2d0 : 0xdcd3bd);
      }
    const c = toWorld({ gx: o.gx + 3, gy: o.gy + 3 });
    const f = new Container();
    f.position.set(c.x, c.y);
    for (let k = 0; k < 2; k++) {
      const rp = new Graphics().ellipse(0, 0, 18, 9).stroke({ width: 1.4, color: 0xe8f4f7 });
      this.fountainRipples.push(rp);
      f.addChild(rp);
    }
    const basin = new Graphics();
    basin.ellipse(0, 3, 24, 12).fill(0x9a8f78);
    basin.ellipse(0, 0, 22, 11).fill(0xbfb59c);
    basin.ellipse(0, 0, 18, 9).fill(0x6fb8d6);
    this.jet = new Graphics().roundRect(-2, -18, 4, 18, 2).fill(0xdff1f7);
    f.addChild(basin, this.jet);
    f.zIndex = c.y;
    this.ground.addChild(g);
    this.depth.addChild(f);
  }

  private addTree(p: Pt, s: number, phase: number) {
    const c = new Container();
    c.position.set(p.x, p.y);
    c.scale.set(s);
    c.zIndex = p.y;
    const sh = new Graphics().ellipse(0, 0, 10, 5).fill({ color: 0x000000, alpha: 0.18 });
    const crown = new Container();
    const g = new Graphics();
    g.rect(-2, -12, 4, 12).fill(0x7a5a3a);
    g.circle(0, -20, 10).fill(0x3f8a3a);
    g.circle(-5, -16, 6).fill(0x4f9a46);
    g.circle(4, -24, 5.5).fill(0x67b05a);
    crown.addChild(g);
    c.addChild(sh, crown);
    this.depth.addChild(c);
    this.trees.push({ c: crown, p: phase });
  }

  private buildTreesAndLamps() {
    const r = seeded(43);
    // ring trees around key plots and the plaza
    for (const id of Object.keys(KEY_BLOCKS) as BuildingId[]) {
      const o = blockOrigin(KEY_BLOCKS[id].bx, KEY_BLOCKS[id].by);
      for (const [x, y] of [
        [0, 0],
        [5, 0],
        [0, 5],
        [5, 5],
        [0, 2.5],
        [2.5, 0],
      ])
        this.addTree(toWorld({ gx: o.gx + x + 0.5, gy: o.gy + y + 0.5 }), 0.85 + r() * 0.3, r() * TAU);
    }
    const po = blockOrigin(PLAZA_BLOCK.bx, PLAZA_BLOCK.by);
    for (const [x, y] of [
      [0, 0],
      [5, 0],
      [0, 5],
      [5, 5],
    ])
      this.addTree(toWorld({ gx: po.gx + x + 0.5, gy: po.gy + y + 0.5 }), 1, r() * TAU);
    // street lamps at intersections around the plaza
    const lines = ROAD_LINES as readonly number[];
    for (const [a, b] of [
      [lines[1], lines[1]],
      [lines[2], lines[1]],
      [lines[1], lines[2]],
      [lines[2], lines[2]],
    ]) {
      const p = toWorld({ gx: a + 0.08, gy: b + 0.08 });
      const c = new Container();
      c.position.set(p.x, p.y);
      c.zIndex = p.y;
      const glow = new Graphics().circle(0, -22, 9).fill(0xffe7a3);
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(0, -20).stroke({ width: 2, color: 0x3a3f44 });
      g.circle(0, -22, 3).fill(0xfff4cc).stroke({ width: 1, color: 0x3a3f44 });
      c.addChild(glow, g);
      this.glows.push(glow);
      this.depth.addChild(c);
    }
    // lighthouse on the left coast
    const lp = toWorld({ gx: 0.9, gy: 22.5 });
    const lh = new Container();
    lh.position.set(lp.x, lp.y);
    lh.zIndex = lp.y;
    const lg = new Graphics();
    lg.ellipse(0, 0, 10, 5).fill({ color: 0x000000, alpha: 0.2 });
    lg.poly([{ x: -7, y: 0 }, { x: 7, y: 0 }, { x: 5, y: -42 }, { x: -5, y: -42 }]).fill(0xf4f1ea).stroke({ width: 1.4, color: INK });
    lg.poly([{ x: -6.4, y: -12 }, { x: 6.4, y: -12 }, { x: 6, y: -20 }, { x: -6, y: -20 }]).fill(0xc9442f);
    lg.poly([{ x: -5.6, y: -28 }, { x: 5.6, y: -28 }, { x: 5.3, y: -35 }, { x: -5.3, y: -35 }]).fill(0xc9442f);
    lg.rect(-6, -50, 12, 8).fill(0x2f3a44);
    lg.poly([{ x: -7, y: -50 }, { x: 7, y: -50 }, { x: 0, y: -57 }]).fill(0xc9442f).stroke({ width: 1.2, color: INK });
    this.beam = new Graphics().circle(0, -46, 5).fill(0xffe48a);
    lh.addChild(lg, this.beam);
    this.depth.addChild(lh);
  }

  private buildKeyBuilding(def: BuildingDef, index: number) {
    const geo = isoGeometry(def);
    const { cx, cy, hw, wallH, roof, roofColor } = def;
    const { hh, roofH, L, B, R, Lt, Bt, Rt, Tt, apex } = geo;
    const studio = def.id === "studio";
    const wallL = studio ? 0xe6f2ee : 0xf6f1e6;
    const wallR = studio ? 0xc6ddd5 : 0xdcd2bf;

    const root = new Container();
    root.zIndex = cy;
    const under = new Container();
    const shadow = new Graphics().ellipse(0, 0, hw * 1.05, hh * 0.65).fill({ color: 0x000000, alpha: 0.16 });
    shadow.position.set(cx, cy + 6);
    const body = new Container();
    body.pivot.set(cx, B.y);
    body.position.set(cx, B.y);

    const g = new Graphics();
    // plinth
    const pad = (p: Pt, d: number) => ({ x: cx + (p.x - cx) * d, y: cy + (p.y - cy) * d });
    g.poly([pad(L, 1.08), pad(B, 1.08), pad(R, 1.08), pad(geo.T, 1.08)]).fill(0xd9d4c7).stroke({ width: 1.2, color: INK, alpha: 0.6 });
    g.poly([L, B, Bt, Lt]).fill(wallL).stroke({ width: 2, color: INK, join: "round" });
    g.poly([R, B, Bt, Rt]).fill(wallR).stroke({ width: 2, color: INK, join: "round" });
    const up = (p: Pt, d: number) => ({ x: p.x, y: p.y - d });
    g.poly([L, B, up(B, 7), up(L, 7)]).fill(shade(wallL, 0.8));
    g.poly([B, R, up(R, 7), up(B, 7)]).fill(shade(wallR, 0.8));
    g.moveTo(Lt.x, Lt.y).lineTo(Bt.x, Bt.y).lineTo(Rt.x, Rt.y).stroke({ width: 2, color: INK });

    const lift = wallH * 0.42;
    const wins = [
      winPts(L, B, 0.12, 0.3, lift, 14),
      winPts(L, B, 0.42, 0.6, lift, 14),
      winPts(L, B, 0.72, 0.9, lift, 14),
      winPts(R, B, 0.1, 0.26, lift, 14),
      winPts(R, B, 0.74, 0.9, lift, 14),
    ];
    const lit: Graphics[] = [];
    for (const w of wins) {
      g.poly(w).fill(0xfff4dc).stroke({ width: 1.2, color: INK, alpha: 0.8 });
      const glass = inset(w, 0.22);
      g.poly(glass).fill(0x3d5a6c);
      g.moveTo(w[3].x - 1, w[3].y + 1.5).lineTo(w[2].x + 1, w[2].y + 1.5).stroke({ width: 2, color: 0x8a7a5c });
      const l = new Graphics().poly(glass).fill(0xf6d27a);
      l.alpha = 0;
      lit.push(l);
    }

    // door on the front-right wall, facing the worker's road
    const dh = Math.min(22, wallH * 0.3);
    const p0 = { x: lerp(B.x, R.x, 0.42), y: lerp(B.y, R.y, 0.42) };
    const p1 = { x: lerp(B.x, R.x, 0.58), y: lerp(B.y, R.y, 0.58) };
    g.poly([p0, p1, up(p1, dh + 2), up(p0, dh + 2)]).fill(0x2f2a22);
    const door = new Graphics();
    const rel = (p: Pt) => ({ x: p.x - p0.x, y: p.y - p0.y });
    door.poly([rel(p0), rel(p1), rel(up(p1, dh)), rel(up(p0, dh))]).fill(0x9a6a43).stroke({ width: 1, color: 0x5c3a22 });
    door.circle(rel(p1).x - 3, rel(p1).y - dh / 2, 1.2).fill(0xe8c33a);
    door.position.set(p0.x, p0.y);

    const r = new Graphics();
    const eaveY = cy - wallH;
    const o = (p: Pt) => ({ x: cx + (p.x - cx) * 1.08, y: eaveY + (p.y - eaveY) * 1.08 + 1.5 });
    if (roof === "hip") {
      const [oL, oB, oR] = [o(Lt), o(Bt), o(Rt)];
      r.poly([apex, oL, oB]).fill(roofColor).stroke({ width: 2, color: INK, join: "round" });
      r.poly([apex, oB, oR]).fill(shade(roofColor, 0.82)).stroke({ width: 2, color: INK, join: "round" });
      for (const f of [0.22, 0.44, 0.66]) {
        for (const [a, b] of [
          [oL, oB],
          [oB, oR],
        ] as const) {
          r.moveTo(lerp(a.x, apex.x, f), lerp(a.y, apex.y, f))
            .lineTo(lerp(b.x, apex.x, f), lerp(b.y, apex.y, f))
            .stroke({ width: 1.2, color: 0x000000, alpha: 0.16 });
        }
      }
      r.moveTo(apex.x, apex.y).lineTo(oB.x, oB.y).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
      if (def.id === "home") {
        const x0 = cx + hw * 0.28;
        const top = apex.y + roofH * 0.3;
        r.rect(x0, top, 10, 28).fill(0x9a8a6c).stroke({ width: 1.5, color: INK });
        r.poly([{ x: x0, y: top }, { x: x0 + 5, y: top - 2.5 }, { x: x0 + 15, y: top - 2.5 }, { x: x0 + 10, y: top }]).fill(0x5c564a);
      }
    } else {
      const lift6 = (p: Pt) => up(p, 7);
      r.poly([Lt, Bt, lift6(Bt), lift6(Lt)]).fill(shade(roofColor, 0.82)).stroke({ width: 1.5, color: INK });
      r.poly([Bt, Rt, lift6(Rt), lift6(Bt)]).fill(shade(roofColor, 0.68)).stroke({ width: 1.5, color: INK });
      r.poly([lift6(Lt), lift6(Tt), lift6(Rt), lift6(Bt)]).fill(roofColor).stroke({ width: 2, color: INK, join: "round" });
      r.poly(inset([lift6(Lt), lift6(Tt), lift6(Rt), lift6(Bt)], 0.16)).fill(shade(roofColor, 1.15));
    }

    const decor = new Container();
    body.addChild(g, ...lit, door, r, decor);
    root.addChild(shadow, under, body);
    this.depth.addChild(root);

    const v: BuildingView = {
      def,
      geo,
      index,
      root,
      body,
      shadow,
      lit,
      door,
      decor,
      under,
      hover: 0,
      press: 0,
      doorStart: null,
    };
    this.views.set(def.id, v);
  }

  private buildSky() {
    for (const [y, rx, ry, speed, off] of [
      [80, 120, 44, 9, 0.2],
      [320, 160, 52, 7, 0.65],
      [520, 100, 36, 11, 0.9],
    ] as const) {
      const g = new Graphics().ellipse(0, 0, rx, ry).fill({ color: 0x0b1a10, alpha: 0.08 });
      this.clouds.push({ g, speed, off, y });
      this.ui.addChild(g);
    }
    this.birds = new Container();
    for (let k = 0; k < 3; k++) {
      const b = new Graphics();
      b.moveTo(-5, 0).quadraticCurveTo(-2.5, -3, 0, 0).quadraticCurveTo(2.5, -3, 5, 0).stroke({ width: 1.4, color: 0x2a2f2a, cap: "round" });
      b.position.set(k * 11, k === 1 ? -6 : 0);
      this.birdWings.push(b);
      this.birds.addChild(b);
    }
    this.ui.addChild(this.birds);
  }

  private buildWorker() {
    const w = this.worker;
    const shadow = new Graphics().ellipse(0, 0, 11, 4.5).fill({ color: 0x000000, alpha: 0.3 });
    const leg = (g: Graphics) => g.roundRect(-2, 0, 4, 11, 2).fill(0x2b2f36);
    leg(this.wLegL).position.set(-3, -11);
    leg(this.wLegR).position.set(3, -11);
    const arm = (g: Graphics) => g.roundRect(-1.8, 0, 3.6, 10, 1.8).fill(0xc9761f);
    arm(this.wArmL).position.set(-7.5, -23);
    arm(this.wArmR).position.set(7.5, -23);
    const torso = new Graphics();
    torso.roundRect(-7.5, -25, 15, 16, 4).fill(0xf0a92b).stroke({ width: 1.5, color: 0x7a4d0e });
    torso.rect(-7.5, -18, 15, 2).fill(0xfff2c8);
    torso.rect(-7.5, -13, 15, 2.5).fill(0x3b3226);
    const head = this.wHead;
    head.position.set(0, -31);
    const hg = new Graphics();
    hg.circle(0, 0, 6.5).fill(0xf0c49a).stroke({ width: 1.5, color: 0x8a5a3b });
    hg.circle(2.6, -0.5, 1).fill(0x2e2a24);
    hg.circle(-0.6, -0.5, 1).fill(0x2e2a24);
    hg.poly([{ x: -7.5, y: -3 }, { x: 7.5, y: -3 }, { x: 5, y: -9 }, { x: -5, y: -9 }]).fill(0xf2c53d).stroke({ width: 1.2, color: 0x7a5c0e });
    hg.rect(-8.5, -4, 17, 2).fill(0xe0b13a);
    head.addChild(hg);
    this.wCarry.position.set(9, -24);
    this.wBody.addChild(this.wArmL, torso, head, this.wCarry, this.wArmR);
    this.wFace.addChild(this.wLegL, this.wLegR, this.wBody);

    const ab = new Graphics();
    ab.circle(0, 0, 8.5).fill(0xe8a33a).stroke({ width: 1.5, color: 0x7a4d0e });
    this.wAlert.addChild(ab, label("!", 12, "#3d2c05", "700", false));
    this.wAlert.position.set(14, -46);
    const wb = new Graphics();
    wb.roundRect(-13, -8, 26, 15, 7).fill(0xffffff).stroke({ width: 1.2, color: 0x6b665c });
    wb.circle(-6, 10, 2).fill(0xffffff).stroke({ width: 1, color: 0x6b665c });
    this.wWait.addChild(wb);
    for (let k = 0; k < 3; k++) {
      const d = new Graphics().circle(-6 + k * 6, -0.5, 1.8).fill(0x1f4f7a);
      this.wWaitDots.push(d);
      this.wWait.addChild(d);
    }
    this.wWait.position.set(14, -48);
    w.addChild(shadow, this.wFace, this.wAlert, this.wWait);
    w.scale.set(1.25);
    this.depth.addChild(w);
  }

  private drawWorkerProps(city: CityState) {
    this.wCarry.removeChildren().forEach((c) => c.destroy());
    const carry = city.worker.carry;
    if (carry !== "none") {
      const g = new Graphics();
      g.roundRect(0, 0, 11, 14, 1.5).fill(0xfdfbf3).stroke({ width: 1.5, color: 0x5c564a });
      if (carry === "notes") {
        // private notes: lock icon only, never note text
        g.roundRect(2.5, 6.5, 6, 5, 1).fill(0x5c564a);
        g.moveTo(3.8, 6.5).lineTo(3.8, 4.8).arc(5.5, 4.8, 1.7, Math.PI, 0).lineTo(7.2, 6.5).stroke({ width: 1.2, color: 0x5c564a });
      } else {
        g.moveTo(2.5, 7).lineTo(5, 9.5).lineTo(9, 4.5).stroke({ width: 1.6, color: 0x1f7a4d, cap: "round" });
      }
      this.wCarry.addChild(g);
    }
    this.wAlert.visible = city.worker.unresolved;
    this.wWait.visible = city.worker.pose === "waiting";
  }

  private questBase(id: BuildingId): Pt {
    const v = this.views.get(id)!;
    return { x: v.def.cx, y: v.geo.apex.y - (id === "registry" ? 52 : id === "treasury" ? 44 : 22) };
  }

  private drawQuest(q: CityState["quest"]) {
    this.quest.visible = q !== null;
    if (!q) return;
    const colors: Record<QuestKind, [number, string, string]> = {
      action: [0xf2c14e, "#3d2c05", "!"],
      wait: [0x5b8fd6, "#ffffff", "…"],
      warn: [0xe8a33a, "#3d2c05", "!"],
    };
    const [bg, fg, sym] = colors[q.kind];
    this.questBg.clear();
    this.questBg.poly([{ x: -5, y: 9 }, { x: 5, y: 9 }, { x: 0, y: 16 }]).fill(bg).stroke({ width: 1.5, color: INK });
    this.questBg.rect(-10, -11, 20, 21).fill(bg).stroke({ width: 2, color: INK });
    this.questText.text = sym;
    this.questText.style.fill = fg;
    this.questText.y = sym === "…" ? -4 : -0.5;
    const p = this.questBase(q.building);
    this.quest.position.set(p.x, p.y);
  }

  private buildDecor(city: CityState) {
    for (const v of this.views.values()) {
      v.decor.removeChildren().forEach((c) => c.destroy({ children: true }));
      v.under.removeChildren().forEach((c) => c.destroy({ children: true }));
    }
    const d = emptyDecor();

    // Planning Desk: chimney smoke + private parcel (lock icon only)
    {
      const v = this.views.get("home")!;
      for (let k = 0; k < 3; k++) {
        const p = new Graphics().circle(0, 0, 4 + k).fill(0xeeeae2);
        d.puffs.push(p);
        v.decor.addChild(p);
      }
      if (city.planning.privateParcel) {
        const g = new Graphics();
        const x = v.geo.R.x - 6;
        const y = v.geo.R.y + 4;
        g.rect(x, y, 16, 12).fill(0xc9a26b).stroke({ width: 1.2, color: 0x5c3a22 });
        g.rect(x + 4.5, y + 5, 7, 5.5).fill(0x5c564a);
        g.moveTo(x + 6, y + 5).lineTo(x + 6, y + 3.4).arc(x + 8, y + 3.4, 2, Math.PI, 0).lineTo(x + 10, y + 5).stroke({ width: 1.2, color: 0x5c564a });
        v.decor.addChild(g);
      }
    }

    // AI Studio: dish, data dots while running, amber pulse when stalled
    {
      const v = this.views.get("studio")!;
      const { def, geo } = v;
      const dx = geo.apex.x + 24;
      const dy = geo.apex.y + 18;
      const base = new Graphics().moveTo(dx, dy).lineTo(dx, dy - 10).stroke({ width: 2, color: 0x3a3f44 });
      const dish = new Graphics();
      dish.ellipse(0, 0, 9, 5).fill(0xe8f1ee).stroke({ width: 1.4, color: 0x3a3f44 });
      dish.circle(0, 0, 1.5).fill(0x3a3f44);
      dish.position.set(dx, dy - 13);
      v.decor.addChild(base, dish);
      d.dish = dish;
      if (city.studio === "running") {
        for (let k = 0; k < 5; k++) {
          const dot = new Graphics().rect(0, 0, k % 2 ? 4 : 2.5, 2).fill(0x1f7a70);
          dot.position.set(geo.apex.x - 12 + k * 6, geo.apex.y - 4);
          d.dataDots.push(dot);
          v.decor.addChild(dot);
        }
      }
      if (city.studio === "failed" || city.studio === "interrupted") {
        const amber = new Graphics().ellipse(0, 0, def.hw * 1.15, geo.hh * 1.15).fill(0xe8a33a);
        amber.position.set(def.cx, def.cy);
        v.under.addChild(amber);
        d.amber = amber;
      }
    }

    // Release Desk: neutral approval emblem (document + check), stamp on approval
    {
      const v = this.views.get("treasury")!;
      const x = v.geo.apex.x - 8;
      const y = v.geo.apex.y - 30;
      const post = new Graphics().moveTo(x + 8, y + 20).lineTo(x + 8, v.geo.apex.y + 2).stroke({ width: 2, color: 0x6e3a22 });
      const emblem = new Container();
      const e = new Graphics();
      e.rect(x, y, 16, 20).fill(0xfdfbf3).stroke({ width: 1.5, color: 0x5c564a });
      e.moveTo(x + 3, y + 5).lineTo(x + 13, y + 5).stroke({ width: 1.2, color: 0x9a917f });
      e.moveTo(x + 4, y + 12).lineTo(x + 7, y + 15).lineTo(x + 12, y + 9).stroke({ width: 1.6, color: 0x5c564a, cap: "round" });
      emblem.addChild(e);
      v.decor.addChild(post, emblem);
      d.emblem = emblem;
      if (city.release === "approved") {
        const s = new Container();
        const sg = new Graphics();
        sg.circle(0, 0, 7.5).fill(0x2f8a57).stroke({ width: 1.5, color: 0x1d5a38 });
        sg.moveTo(-3.5, 0).lineTo(-1, 2.5).lineTo(3.5, -2.5).stroke({ width: 1.8, color: 0xffffff, cap: "round" });
        s.addChild(sg);
        s.position.set(x + 18, y + 2);
        v.decor.addChild(s);
        d.stamp = s;
      } else {
        const so = new Graphics().circle(0, 0, 7.5).fill(0x8a8a80);
        so.position.set(x + 18, y + 2);
        so.alpha = 0;
        v.decor.addChild(so);
        d.stampOut = so;
      }
    }

    // Registry Hall: antenna states
    {
      const v = this.views.get("registry")!;
      const { geo } = v;
      const ax = geo.apex.x;
      const top = geo.apex.y - 26;
      const reg = city.registry;
      const hall = [geo.L, geo.B, geo.R, geo.Rt, geo.apex, geo.Lt];
      if (reg === "expired") {
        const grey = new Graphics().poly(hall).fill(0x7d7d76);
        grey.alpha = 0.55;
        v.decor.addChild(grey);
      }
      if (reg === "unavailable") {
        const m = new Graphics().poly(hall).fill({ color: 0xf3efe6, alpha: 0.6 });
        dashedPoly(m, hall, 5, 4);
        m.stroke({ width: 2, color: 0x6b665c });
        v.decor.addChild(m);
      }
      v.decor.addChild(new Graphics().moveTo(ax, geo.apex.y).lineTo(ax, top + 4).stroke({ width: 2.5, color: 0x3a3f44 }));
      if (reg === "pending") {
        const orbit = new Graphics();
        dashedCircle(orbit, 0, 0, 11);
        orbit.stroke({ width: 2, color: 0x1a5fb4, cap: "round" });
        orbit.position.set(ax, top);
        v.decor.addChild(orbit);
        d.orbit = orbit;
      }
      if (reg === "live" || reg === "stale") {
        const b = new Graphics();
        b.circle(0, 0, 10).fill({ color: 0x7fd6c4, alpha: 0.45 });
        b.circle(0, 0, 5.5).fill(reg === "stale" ? 0x9a9a90 : 0x1f9d7a).stroke({ width: 1.2, color: 0x145c48 });
        b.position.set(ax, top);
        b.alpha = reg === "stale" ? 0.45 : 1;
        v.decor.addChild(b);
      }
      if (reg === "live") {
        const scan = new Graphics().circle(0, 0, 10).stroke({ width: 2, color: 0x1f9d7a });
        scan.position.set(ax, top);
        scan.alpha = 0;
        v.decor.addChild(scan);
        d.scan = scan;
      }
      if (reg === "unavailable") {
        const u = new Graphics();
        dashedCircle(u, ax, top, 5.5, 8);
        u.stroke({ width: 1.5, color: 0x6b665c });
        v.decor.addChild(u);
      }
      if (reg === "expired") v.decor.addChild(new Graphics().circle(ax, top, 5.5).fill(0x9a9a90).stroke({ width: 1.2, color: 0x5c5a52 }));
      if (reg === "closed") {
        const f = new Graphics();
        f.poly([{ x: ax + 1, y: geo.apex.y - 12 }, { x: ax + 15, y: geo.apex.y - 9 }, { x: ax + 1, y: geo.apex.y - 4 }]).fill(0xc96f4a).stroke({ width: 1, color: 0x6e3a22 });
        f.circle(ax, top + 3, 2.5).fill(0x3a3f44);
        v.decor.addChild(f);
      }
    }

    // Archive: stack of boxes once a private brief exists
    if (city.archive.boxes) {
      const v = this.views.get("archive")!;
      const x = v.geo.R.x - 10;
      const y = v.geo.R.y + 8;
      const c = new Container();
      const box = (bx: number, by: number) => {
        const g = new Graphics();
        g.poly([{ x: 0, y: 0 }, { x: 8, y: -4 }, { x: 16, y: 0 }, { x: 8, y: 4 }]).fill(0xd8b98a).stroke({ width: 1, color: 0x6e5a3a });
        g.poly([{ x: 0, y: 0 }, { x: 8, y: 4 }, { x: 8, y: 12 }, { x: 0, y: 8 }]).fill(0xc39c66).stroke({ width: 1, color: 0x6e5a3a });
        g.poly([{ x: 16, y: 0 }, { x: 8, y: 4 }, { x: 8, y: 12 }, { x: 16, y: 8 }]).fill(0xa8824f).stroke({ width: 1, color: 0x6e5a3a });
        g.position.set(bx, by);
        c.addChild(g);
      };
      box(x, y);
      box(x + 14, y + 6);
      box(x + 6, y - 8);
      v.decor.addChild(c);
      d.boxes = c;
    }
    this.decor = d;
  }

  // frame update (writes display objects only)

  private requestRender() {
    if (this.mode !== "on") this.app.render();
  }

  private renderStatic() {
    if (this.mode === "on") return;
    this.update(0);
    this.app.render();
  }

  private update(dt: number) {
    const anim = this.mode === "on";
    if (anim) this.t += dt;
    const now = this.t;
    const t = now / 1000;
    const wave = (period: number, phase = 0) => (anim ? Math.sin((t / period + phase) * TAU) : 0);
    const loop = (period: number, phase = 0) => (anim ? (((t / period + phase) % 1) + 1) % 1 : 0);

    // A. ambient
    for (const w of this.waves) {
      w.g.x = w.x + wave(6, w.p) * 7;
      w.g.alpha = 0.25 + 0.55 * (anim ? (wave(3.4, w.p) + 1) / 2 : 0.5);
    }
    this.foam.alpha = 0.45 + 0.35 * (anim ? (wave(4.5) + 1) / 2 : 0.5);
    this.trees.forEach((tr) => {
      tr.c.skew.x = wave(5.5, tr.p / TAU) * 0.04;
    });
    this.glows.forEach((g, i) => {
      g.alpha = 0.22 + 0.22 * (anim ? (wave(4.2, i * 0.27) + 1) / 2 : 0.5);
    });
    this.jet.scale.y = anim ? 0.85 + 0.15 * wave(0.9) : 1;
    this.fountainRipples.forEach((r, k) => {
      const f = loop(2.6, k * 0.5);
      r.scale.set(0.5 + f);
      r.alpha = anim ? 0.8 * (1 - f) : 0;
    });
    this.beam.alpha = anim ? 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6)) : 1;
    this.clouds.forEach((c) => {
      c.g.position.set(-900 + (anim ? ((t / (140 / c.speed) + c.off) % 1) * 1900 : c.off * 1900), c.y);
      c.g.visible = anim;
    });
    const bf = loop(48, 0.3);
    this.birds.position.set(-700 + bf * 1500, 80 - bf * 160);
    this.birds.visible = anim;
    this.birdWings.forEach((b, k) => {
      b.scale.y = anim ? 0.35 + 0.65 * Math.abs(Math.sin(t * 5 + k)) : 1;
    });

    // C. building states
    const city = this.city;
    const d = this.decor;
    const home = this.views.get("home")!;
    const chimX = home.def.cx + home.def.hw * 0.28 + 5;
    const chimY = home.geo.apex.y + home.geo.roofH * 0.3 - 4;
    d.puffs.forEach((p, k) => {
      const f = loop(4.2, k / 3);
      p.position.set(chimX + f * 9, chimY - f * 28);
      p.scale.set(0.6 + f * 0.9);
      p.alpha = anim ? (f < 0.15 ? (f / 0.15) * 0.75 : 0.75 * (1 - (f - 0.15) / 0.85)) : 0;
    });
    const running = city?.studio === "running";
    if (d.dish) d.dish.scale.x = running && anim ? Math.cos(t * 2.6) : 1;
    const studioApex = this.views.get("studio")!.geo.apex.y;
    d.dataDots.forEach((dot, k) => {
      const f = loop(2.2, k / 5);
      dot.y = studioApex - 4 - f * 20;
      dot.alpha = anim ? (f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8) * 0.9 : 0.6;
    });
    if (d.amber) d.amber.alpha = 0.3 + 0.18 * wave(4.8);
    for (const v of this.views.values()) {
      const lit = v.def.id === "home" ? city?.planning.lit === true : false;
      v.lit.forEach((l, i) => {
        if (v.def.id === "studio" && running) l.alpha = anim ? 0.35 + 0.6 * ((wave(1.6, -i * 0.25) + 1) / 2) : 0.8;
        else l.alpha = lit ? 0.9 : 0;
      });
    }
    if (d.emblem) d.emblem.y = city?.release === "awaiting" ? wave(4.4) * -2.5 - (anim ? 1.25 : 0) : 0;
    if (d.stamp) {
      const f = clamp01((now - this.stampStart) / STAMP_MS);
      const s = f < 1 ? (f < 0.6 ? lerp(1.8, 0.92, f / 0.6) : lerp(0.92, 1, (f - 0.6) / 0.4)) : 1;
      d.stamp.scale.set(s);
      d.stamp.alpha = f < 1 ? Math.min(1, f / 0.6) : 1;
    }
    if (d.stampOut) d.stampOut.alpha = 0.8 * (1 - clamp01((now - this.stampOutStart) / 450));
    if (d.orbit) d.orbit.rotation = anim ? t * (TAU / 3.2) : 0;
    if (d.scan) {
      const f = clamp01((now - this.scanStart) / 1200);
      d.scan.scale.set(0.6 + f * 1.8);
      d.scan.alpha = f < 1 ? 0.8 * (1 - f) : 0;
    }
    if (d.boxes) {
      const f = clamp01((now - this.boxesStart) / 600);
      d.boxes.y = (1 - easeInOut(f)) * -12;
      d.boxes.alpha = f;
    }

    // D/E. hover, press, pop-in, doors
    for (const v of this.views.values()) {
      const target = this.hovered === v.def.id ? 1 : 0;
      v.hover += (target - v.hover) * (anim ? Math.min(1, dt / 90) : 1);
      v.press = anim ? Math.max(0, v.press - dt / 220) : 0;
      const popF = anim ? clamp01((now - v.index * 90) / POP_MS) : 1;
      const pop = popF >= 1 ? 1 : easeOutBack(popF);
      const p = Math.sin(v.press * Math.PI);
      v.body.scale.set((0.86 + 0.14 * pop) * (1 + 0.04 * p), (0.86 + 0.14 * pop) * (1 - 0.06 * p));
      v.body.y = v.geo.B.y - 5 * v.hover + (1 - pop) * 8;
      v.root.alpha = popF;
      v.shadow.scale.set(1 + 0.08 * v.hover);
      let open = 0;
      if (v.doorStart !== null) {
        const f = (now - v.doorStart) / DOOR_MS;
        open = f >= 1 ? 0 : f < 0.25 ? f / 0.25 : f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
        if (f >= 1) v.doorStart = null;
      }
      v.door.scale.x = 1 - 0.8 * open;
    }

    // selection: amber dashed diamond that draws in, then crawls slowly
    this.selRing.clear();
    if (this.selected) {
      const p = KEY_PLOTS[this.selected];
      const m = 0.45;
      const ring = [
        toWorld({ gx: p.gx - m, gy: p.gy - m }),
        toWorld({ gx: p.gx + p.size + m, gy: p.gy - m }),
        toWorld({ gx: p.gx + p.size + m, gy: p.gy + p.size + m }),
        toWorld({ gx: p.gx - m, gy: p.gy + p.size + m }),
      ];
      this.selRing.poly(ring).fill({ color: 0xf0a92b, alpha: 0.16 });
      dashedPoly(this.selRing, ring, 10, 6, anim ? t * 6 : 0, clamp01((now - this.selStart) / 650));
      this.selRing.stroke({ width: 3, color: 0xf0a92b, cap: "round" });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const f = (now - r.start) / 600;
      r.g.clear();
      if (f >= 1) {
        r.g.destroy();
        this.ripples.splice(i, 1);
        continue;
      }
      r.g.ellipse(0, 0, 50 + f * 70, 25 + f * 35).stroke({ width: 3, color: 0xffffff, alpha: 0.8 * (1 - f) });
    }

    if (this.quest.visible && city?.quest) {
      const base = this.questBase(city.quest.building);
      const bounce = city.quest.kind === "action" ? Math.abs(wave(1.4)) * 6 : wave(3) * 2;
      this.quest.y = base.y - bounce;
      this.quest.alpha = anim ? clamp01((now - 500) / 400) : 1;
    }

    this.updateWorker(anim, t);
  }

  private updateWorker(anim: boolean, t: number) {
    const city = this.city;
    let moving = false;
    let pos = toWorld(this.wGrid);
    if (this.walk) {
      const w = this.walk;
      const f = anim ? clamp01((this.t - w.start) / w.dur) : 1;
      let dist = easeInOut(f) * w.total;
      let k = 0;
      while (k < w.lens.length - 1 && dist > w.lens[k]) dist -= w.lens[k++];
      const seg = w.lens[k] || 1;
      const u = clamp01(dist / seg);
      const a = w.world[k];
      const b = w.world[k + 1] ?? a;
      const ga = w.path[k];
      const gb = w.path[k + 1] ?? ga;
      const next = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
      if (Math.abs(b.x - a.x) > 0.01) this.wFace.scale.x = b.x < a.x ? -1 : 1;
      this.stride += Math.hypot(next.x - pos.x, next.y - pos.y);
      pos = next;
      this.wGrid = { gx: lerp(ga.gx, gb.gx, u), gy: lerp(ga.gy, gb.gy, u) };
      moving = f < 1;
      if (f >= 1) {
        this.wGrid = { ...w.path[w.path.length - 1] };
        if (w.to && anim) this.views.get(w.to)!.doorStart = this.t;
        this.walk = null;
      }
    }
    this.worker.position.set(pos.x, pos.y);
    this.worker.zIndex = pos.y + 1;

    const pose = city?.worker.pose ?? "idle";
    const stalled = pose === "stalled";
    if (moving) {
      const s = Math.sin(this.stride / 4.2);
      this.wLegL.rotation = s * 0.5;
      this.wLegR.rotation = -s * 0.5;
      this.wArmL.rotation = -s * 0.6;
      this.wArmR.rotation = s * 0.6;
      this.wBody.y = -Math.abs(Math.cos(this.stride / 4.2)) * 1.6;
      this.wBody.rotation = 0;
      this.wHead.x = 0;
    } else {
      this.wLegL.rotation = this.wLegR.rotation = 0;
      this.wBody.y = anim && !stalled ? Math.sin(t * 2) * 0.6 : 0;
      this.wArmL.rotation = stalled ? 0.2 : 0.08;
      this.wArmR.rotation = stalled ? -0.2 : pose === "working" && anim ? -0.3 + Math.sin(t * 3) * 0.15 : -0.08;
      this.wBody.rotation = stalled ? -0.16 : 0;
      this.wHead.x = anim && !stalled && (t % 9) / 9 > 0.78 ? Math.sin(((t % 9) - 7) * 3) * 1.6 : 0;
      this.wHead.y = stalled ? -29.5 : -31;
    }
    this.wAlert.alpha = 0.7 + 0.3 * (anim ? (Math.sin(t * 1.3) + 1) / 2 : 1);
    this.wWaitDots.forEach((dot, k) => {
      dot.alpha = anim ? 0.3 + 0.7 * clamp01(Math.sin(t * 4.2 - k * 0.9)) : 1;
    });
  }
}
