"use client";
// World-space SVG <g> for one boat that can be picked up and dropped on water.
// Idle: sails route(t). Dropped: stays and bobs. Dragging: follows the pointer.
// Transforms are written straight to refs from the shared ticker (no per-frame state).
import { useEffect, useRef, type ReactNode } from "react";
import type { AmbientTicker } from "./ambient-ticker";
import { screenToWorld, type CameraStore } from "./camera-store";
import { nearestWater, type Pt } from "./water-bounds";

export interface BoatRoutePoint {
  x: number;
  y: number;
  /** Radians; the sprite's bow points +x. */
  heading: number;
}

export interface DraggableBoatProps {
  id: string;
  label?: string;
  ticker: AmbientTicker;
  camera: CameraStore;
  getHostRect: () => DOMRect | null;
  route: (timeMs: number) => BoatRoutePoint;
  reducedMotion: boolean;
  children: ReactNode;
}

type Mode = "idle" | "dropped" | "dragging";

const STORAGE_PREFIX = "briefmint.boat.";
const STEP = 24;
const STEP_BIG = 96;
const MOVE_THRESHOLD_PX = 4;
const LIFT_PX = 6;
const LIFT_MS = 150;
const SETTLE_MS = 240;
const RIPPLE_MS = 900;
const RIPPLE_GAP_MS = 220;

function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6283) / 1000;
}

function lerpAngle(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

function readStored(id: string): Pt | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Pt> | null;
    if (v && typeof v.x === "number" && typeof v.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y)) {
      return { x: v.x, y: v.y };
    }
  } catch {
    /* storage blocked or corrupt */
  }
  return null;
}

function writeStored(id: string, p: Pt | null) {
  try {
    if (p) window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({ x: p.x, y: p.y }));
    else window.localStorage.removeItem(STORAGE_PREFIX + id);
  } catch {
    /* storage blocked */
  }
}

export default function DraggableBoat({
  id,
  label = "Boat, drag or use arrow keys to move",
  ticker,
  camera,
  getHostRect,
  route,
  reducedMotion,
  children,
}: DraggableBoatProps) {
  const rootRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const wakeRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const ringsRef = useRef<SVGGElement>(null);
  const focusRef = useRef<SVGEllipseElement>(null);
  const hitRef = useRef<SVGEllipseElement>(null);

  const refreshRef = useRef<() => void>(() => {});
  const live = useRef({ route, reducedMotion, getHostRect, camera, ticker });
  useEffect(() => {
    live.current = { route, reducedMotion, getHostRect, camera, ticker };
  });

  useEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const wake = wakeRef.current;
    const shadow = shadowRef.current;
    const rings = ringsRef.current;
    const focusRing = focusRef.current;
    const hit = hitRef.current;
    if (!root || !body || !wake || !shadow || !rings || !focusRing || !hit) return;
    const ripples = Array.from(rings.children) as SVGElement[];
    const phase = hashPhase(id);

    let mode: Mode = "idle";
    let pos: Pt = { x: 0, y: 0 };
    let heading = 0;
    let dragT0 = 0;
    let releaseT = Number.NEGATIVE_INFINITY;
    let rippleT = Number.NEGATIVE_INFINITY;
    let wakeLevel = 0;
    let last: Pt | null = null;

    // Drag session
    let pointerId: number | null = null;
    let grab: Pt = { x: 0, y: 0 };
    let startPx: Pt = { x: 0, y: 0 };
    let moved = false;
    let before: { mode: Mode; pos: Pt; heading: number } | null = null;
    let headingAnchor: Pt = { x: 0, y: 0 };

    const nowT = () => live.current.ticker.now();

    const apply = (t: number) => {
      const reduced = live.current.reducedMotion;
      let p: Pt;
      let h = heading;
      let bobY = 0;
      let rock = 0;
      let lift = 0;
      let target = 0;

      if (mode === "idle") {
        const r = live.current.route(t);
        p = { x: r.x, y: r.y };
        h = r.heading;
        target = reduced ? 0 : 0.4;
      } else if (mode === "dragging") {
        p = pos;
        h = heading;
        lift = reduced ? 1 : Math.min(1, Math.max(0, (t - dragT0) / LIFT_MS));
        if (last && !reduced) target = Math.min(1, Math.hypot(p.x - last.x, p.y - last.y) / 1.5);
      } else {
        p = pos;
        const settle = reduced ? 1 : Math.min(1, Math.max(0, (t - releaseT) / SETTLE_MS));
        lift = reduced ? 0 : 1 - settle;
        if (!reduced) {
          bobY = Math.sin(t * 0.0016 + phase) * 1.5 * settle;
          rock = Math.sin(t * 0.0011 + phase) * 2.5 * settle;
        }
      }
      last = p;
      wakeLevel += (target - wakeLevel) * 0.15;
      if (target === 0 && wakeLevel < 0.02) wakeLevel = 0;

      root.setAttribute("transform", `translate(${p.x.toFixed(2)} ${(p.y + bobY).toFixed(2)})`);
      body.setAttribute(
        "transform",
        `translate(0 ${(-lift * LIFT_PX).toFixed(2)}) rotate(${((h * 180) / Math.PI + rock).toFixed(2)}) scale(${(1 + 0.06 * lift).toFixed(3)})`,
      );
      shadow.setAttribute("opacity", (0.22 * lift).toFixed(3));
      shadow.setAttribute("transform", `scale(${(1 + 0.1 * lift).toFixed(3)})`);
      wake.setAttribute("opacity", wakeLevel.toFixed(3));
      wake.setAttribute("transform", `scale(${(1 + 0.12 * Math.sin(t * 0.005)).toFixed(3)} 1)`);

      ripples.forEach((el, i) => {
        const prog = reduced ? 2 : (t - rippleT - i * RIPPLE_GAP_MS) / RIPPLE_MS;
        if (prog < 0 || prog > 1) {
          el.setAttribute("opacity", "0");
          return;
        }
        el.setAttribute("opacity", (0.5 * (1 - prog)).toFixed(3));
        el.setAttribute("transform", `scale(${(0.5 + 1.3 * prog).toFixed(3)})`);
      });
      root.removeAttribute("visibility");
      root.dataset.mode = mode;
    };

    const refresh = () => apply(nowT());
    refreshRef.current = refresh;

    const startRipples = () => {
      rippleT = nowT();
      releaseT = rippleT;
    };

    const toWorld = (e: { clientX: number; clientY: number }): Pt | null => {
      const rect = live.current.getHostRect();
      const cam = live.current.camera.get();
      if (!rect || !cam) return null;
      return screenToWorld(cam, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const currentPos = (): Pt => {
      if (mode === "idle") {
        const r = live.current.route(nowT());
        return { x: r.x, y: r.y };
      }
      return pos;
    };

    const drop = (p: Pt, h: number, persist: boolean) => {
      mode = "dropped";
      pos = nearestWater(p);
      heading = h;
      if (persist) writeStored(id, pos);
      startRipples();
      refresh();
    };

    const toRoute = () => {
      mode = "idle";
      writeStored(id, null);
      startRipples();
      refresh();
    };

    // --- pointer drag ---
    const endSession = () => {
      if (pointerId !== null && hit.hasPointerCapture?.(pointerId)) {
        try {
          hit.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
      }
      pointerId = null;
      before = null;
      hit.style.cursor = "grab";
      window.removeEventListener("keydown", onWindowKey, true);
    };

    const cancelDrag = () => {
      if (!before) return endSession();
      mode = before.mode;
      pos = before.pos;
      heading = before.heading;
      endSession();
      refresh();
    };

    function onWindowKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pointerId === null) return;
      e.preventDefault();
      e.stopPropagation();
      cancelDrag();
    }

    const onDown = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (pointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const w = toWorld(e);
      if (!w) return;
      try {
        hit.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      const start = currentPos();
      before = { mode, pos: start, heading: mode === "idle" ? live.current.route(nowT()).heading : heading };
      pointerId = e.pointerId;
      grab = { x: start.x - w.x, y: start.y - w.y };
      startPx = { x: e.clientX, y: e.clientY };
      headingAnchor = start;
      moved = false;
      hit.style.cursor = "grabbing";
      window.addEventListener("keydown", onWindowKey, true);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !before) return;
      e.stopPropagation();
      if (!moved && Math.hypot(e.clientX - startPx.x, e.clientY - startPx.y) < MOVE_THRESHOLD_PX) return;
      const w = toWorld(e);
      if (!w) return;
      if (!moved) {
        moved = true;
        mode = "dragging";
        pos = before.pos;
        heading = before.heading;
        dragT0 = nowT();
      }
      pos = nearestWater({ x: w.x + grab.x, y: w.y + grab.y });
      const dx = pos.x - headingAnchor.x;
      const dy = pos.y - headingAnchor.y;
      if (Math.hypot(dx, dy) > 3) {
        heading = lerpAngle(heading, Math.atan2(dy, dx), 0.35);
        headingAnchor = pos;
      }
      refresh();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.stopPropagation();
      const wasMoved = moved && mode === "dragging";
      const h = heading;
      const p = pos;
      if (e.type === "pointercancel") return cancelDrag();
      endSession();
      if (wasMoved) drop(p, h, true);
    };

    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onDouble = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (mode === "dragging") return;
      toRoute();
    };

    // --- keyboard ---
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") {
        if (pointerId !== null) {
          e.preventDefault();
          e.stopPropagation();
          cancelDrag();
        }
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        if (mode !== "idle") toRoute();
        return;
      }
      const step = e.shiftKey ? STEP_BIG : STEP;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      e.stopPropagation();
      if (pointerId !== null) return;
      const from = currentPos();
      const h = mode === "idle" ? live.current.route(nowT()).heading : heading;
      drop({ x: from.x + dx, y: from.y + dy }, lerpAngle(h, Math.atan2(dy, dx), 0.6), true);
    };
    const onFocus = () => {
      let visible = false;
      try {
        visible = root.matches(":focus-visible");
      } catch {
        visible = true;
      }
      focusRing.setAttribute("opacity", visible ? "1" : "0");
    };
    const onBlur = () => focusRing.setAttribute("opacity", "0");

    // Initial state: stored position (snapped to water) or the idle route.
    const saved = readStored(id);
    if (saved) {
      mode = "dropped";
      pos = nearestWater(saved);
      heading = live.current.route(nowT()).heading;
    }
    hit.style.cursor = "grab";

    const unsub = live.current.ticker.subscribe(apply);
    refresh();

    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", onUp);
    hit.addEventListener("pointercancel", onUp);
    hit.addEventListener("lostpointercapture", onLost);
    hit.addEventListener("wheel", onWheel, { passive: false });
    hit.addEventListener("click", onClick);
    hit.addEventListener("dblclick", onDouble);
    root.addEventListener("keydown", onKey);
    root.addEventListener("focus", onFocus);
    root.addEventListener("blur", onBlur);

    function onLost(e: PointerEvent) {
      // Capture lost without up/cancel (element removed, browser takeover): abandon safely.
      if (e.pointerId === pointerId) cancelDrag();
    }

    return () => {
      unsub();
      window.removeEventListener("keydown", onWindowKey, true);
      hit.removeEventListener("pointerdown", onDown);
      hit.removeEventListener("pointermove", onMove);
      hit.removeEventListener("pointerup", onUp);
      hit.removeEventListener("pointercancel", onUp);
      hit.removeEventListener("lostpointercapture", onLost);
      hit.removeEventListener("wheel", onWheel);
      hit.removeEventListener("click", onClick);
      hit.removeEventListener("dblclick", onDouble);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("focus", onFocus);
      root.removeEventListener("blur", onBlur);
    };
  }, [id]);

  // The ticker may be paused when motion preference flips: redraw the static pose.
  useEffect(() => {
    live.current.reducedMotion = reducedMotion;
    refreshRef.current();
  }, [reducedMotion]);

  return (
    <g
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-boat-id={id}
      visibility="hidden"
      style={{ outline: "none" }}
    >
      <g ref={ringsRef} fill="none" stroke="var(--bm-scene-sign)" strokeWidth={1.5} pointerEvents="none">
        <ellipse rx={24} ry={12} opacity={0} />
        <ellipse rx={24} ry={12} opacity={0} />
      </g>
      <ellipse ref={shadowRef} rx={20} ry={8} cy={8} fill="var(--bm-scene-ink)" opacity={0} pointerEvents="none" />
      <g ref={bodyRef}>
        <g ref={wakeRef} opacity={0} fill="var(--bm-scene-sign)" pointerEvents="none">
          <ellipse cx={-30} cy={-5} rx={14} ry={3} opacity={0.55} />
          <ellipse cx={-30} cy={5} rx={14} ry={3} opacity={0.55} />
          <ellipse cx={-40} cy={0} rx={10} ry={2} opacity={0.35} />
        </g>
        <g pointerEvents="none">{children}</g>
      </g>
      <ellipse
        ref={focusRef}
        rx={34}
        ry={19}
        fill="none"
        stroke="var(--bm-focus-ring)"
        strokeWidth={2}
        opacity={0}
        pointerEvents="none"
      />
      <ellipse
        ref={hitRef}
        rx={30}
        ry={16}
        fill="transparent"
        style={{ pointerEvents: "all", touchAction: "none" }}
      />
    </g>
  );
}
