"use client";

// Screen-space nameplates above buildings (and smaller plot/landmark/scenery labels).
// Layout is a pure function (label-layout.ts); this layer only measures plates once and
// writes transforms on camera changes. No React state per camera move.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Camera, CameraStore } from "./camera-store";
import { BUILDING_ARIA, labelFontPx, layoutLabels, type LabelSpec, type LayoutOptions, type Rect } from "./label-layout";
import type { BuildingId } from "./scene-config";

export type LabelTone = "info" | "ok" | "warn" | "muted";
export interface LabelTag {
  text: string;
  tone: LabelTone;
}

export interface BuildingLabelsProps {
  camera: CameraStore;
  specs: LabelSpec[];
  selectedId?: string | null;
  onActivate: (id: string) => void;
  /** HUD panel rectangles in client (viewport) coordinates; plates keep clear of them. */
  avoidRects?: () => Rect[];
  /** Second-line state tag per label id (building plates). */
  tags?: Record<string, LabelTag | null | undefined>;
  options?: LayoutOptions;
}

const GLYPH: Record<LabelTone, string> = { ok: "✓", warn: "⚠", info: "●", muted: "○" };
const LEADING_GLYPH = /^[✓⚠●○]\s*/;

const CSS = `
.bm-labels{position:absolute;inset:0;overflow:hidden;pointer-events:none;visibility:hidden;z-index:var(--z-labels);--bm-lfs-b:14px;--bm-lfs-s:12px}
.bm-pin,.bm-pin-dot{position:absolute;left:0;top:0;pointer-events:none;background:var(--bm-text-secondary);visibility:hidden}
.bm-pin{width:1px;height:1px;transform-origin:0 0;opacity:.85}
.bm-pin-dot{width:5px;height:5px;border-radius:50%}
.bm-pin[data-selected="true"],.bm-pin-dot[data-selected="true"]{background:var(--bm-accent)}
.bm-nameplate{position:absolute;left:0;top:0;pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:3px;margin:0;padding:7px 14px;
  border:1px solid var(--bm-line);border-radius:var(--bm-radius-sm,8px);background:var(--bm-bg-1);color:var(--bm-text-primary);
  font-family:var(--bm-font-body);font-weight:600;font-size:var(--bm-lfs-b);line-height:1.25;letter-spacing:.04em;white-space:nowrap;cursor:pointer;
  box-shadow:0 2px 8px color-mix(in srgb,var(--bm-bg-0) 70%,transparent);will-change:transform;visibility:hidden}
.bm-nameplate::after{content:"";position:absolute;inset:-4px}
.bm-nameplate[data-kind="plot"],.bm-nameplate[data-kind="landmark"],.bm-nameplate[data-kind="scenery"]{padding:4px 10px;border-radius:6px;font-size:var(--bm-lfs-s);letter-spacing:.02em}
.bm-nameplate[data-selected="true"]{border-color:var(--bm-accent);box-shadow:0 0 0 1px var(--bm-accent),0 2px 8px color-mix(in srgb,var(--bm-bg-0) 70%,transparent)}
.bm-nameplate:focus-visible{outline:var(--bm-focus-ring,2px solid var(--bm-accent));outline-offset:2px}
.bm-nameplate__tag{font-size:12px;font-weight:600;letter-spacing:0;line-height:1.25}
.bm-nameplate__tag[data-tone="info"]{color:var(--bm-info)}
.bm-nameplate__tag[data-tone="ok"]{color:var(--bm-success)}
.bm-nameplate__tag[data-tone="warn"]{color:var(--bm-warning)}
.bm-nameplate__tag[data-tone="muted"]{color:var(--bm-text-muted)}
`;

const px = (n: number) => Math.round(n);

export function BuildingLabels({ camera, specs, selectedId = null, onActivate, avoidRects, tags, options }: BuildingLabelsProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [plates] = useState(() => new Map<string, HTMLButtonElement>());
  const [pins] = useState(() => new Map<string, HTMLSpanElement>());
  const [dots] = useState(() => new Map<string, HTMLSpanElement>());
  const [sizes] = useState(() => new Map<string, { w: number; h: number }>());
  const fonts = useRef({ b: 0, s: 0 });
  const live = useRef({ specs, avoidRects, options });
  useLayoutEffect(() => {
    live.current = { specs, avoidRects, options };
  });

  const measure = useCallback(() => {
    for (const [id, el] of plates) sizes.set(id, { w: el.offsetWidth, h: el.offsetHeight });
  }, [plates, sizes]);

  const relayout = useCallback(() => {
    const layer = layerRef.current;
    const cam: Camera | null = camera.get();
    if (!layer || !cam) return;
    const vw = layer.clientWidth;
    const vh = layer.clientHeight;
    if (!vw || !vh) return;
    const { specs: ss, avoidRects: getAvoid, options: opts } = live.current;

    const fb = labelFontPx(cam.z, "building");
    const fs = labelFontPx(cam.z, "plot");
    if (fb !== fonts.current.b || fs !== fonts.current.s) {
      fonts.current = { b: fb, s: fs };
      layer.style.setProperty("--bm-lfs-b", `${fb}px`);
      layer.style.setProperty("--bm-lfs-s", `${fs}px`);
      measure();
    }

    const origin = layer.getBoundingClientRect();
    const avoid = (getAvoid?.() ?? []).map((r) => ({ x: r.x - origin.left, y: r.y - origin.top, w: r.w, h: r.h }));
    const sized = ss.map((s) => {
      const m = sizes.get(s.id);
      return m && m.w > 0 ? { ...s, width: m.w, height: m.h } : s;
    });
    const out = layoutLabels(sized, cam, { w: vw, h: vh }, avoid, opts);
    layer.style.visibility = "visible";
    for (const p of out) {
      const plate = plates.get(p.id);
      const pin = pins.get(p.id);
      const dot = dots.get(p.id);
      const vis = p.hidden ? "hidden" : "visible";
      if (plate) {
        plate.style.visibility = vis;
        plate.style.transform = `translate3d(${px(p.x)}px, ${px(p.y)}px, 0)`;
      }
      if (pin) {
        const dx = p.pinTo.x - p.pinFrom.x;
        const dy = p.pinTo.y - p.pinFrom.y;
        const len = Math.hypot(dx, dy);
        pin.style.visibility = p.hidden || len < 2 ? "hidden" : "visible";
        pin.style.transform = `translate(${p.pinFrom.x.toFixed(1)}px, ${p.pinFrom.y.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${len.toFixed(1)})`;
      }
      if (dot) {
        dot.style.visibility = vis;
        dot.style.transform = `translate(${(p.pinTo.x - 2.5).toFixed(1)}px, ${(p.pinTo.y - 2.5).toFixed(1)}px)`;
      }
    }
  }, [camera, measure, plates, pins, dots, sizes]);

  // Camera, container size and viewport changes.
  useEffect(() => {
    const unsub = camera.subscribe(() => relayout());
    const layer = layerRef.current;
    const ro = typeof ResizeObserver !== "undefined" && layer ? new ResizeObserver(() => relayout()) : null;
    if (ro && layer) ro.observe(layer);
    window.addEventListener("resize", relayout);
    return () => {
      unsub();
      ro?.disconnect();
      window.removeEventListener("resize", relayout);
    };
  }, [camera, relayout]);

  // Plates must not start a map pan or zoom. The engine listens natively on the scene host,
  // so the events are stopped natively here, before they bubble that far.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const stop = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("button.bm-nameplate")) e.stopPropagation();
    };
    layer.addEventListener("pointerdown", stop);
    layer.addEventListener("wheel", stop, { passive: true });
    return () => {
      layer.removeEventListener("pointerdown", stop);
      layer.removeEventListener("wheel", stop);
    };
  }, []);

  // Re-measure when content changes, when plates resize (font load, tag change) and after fonts settle.
  useLayoutEffect(() => {
    measure();
    relayout();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { measure(); relayout(); }) : null;
    for (const el of plates.values()) ro?.observe(el);
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      measure();
      relayout();
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [specs, tags, measure, relayout, plates]);

  const setRef = <T extends HTMLElement>(map: Map<string, T>, id: string) => (el: T | null) => {
    if (el) map.set(id, el);
    else map.delete(id);
  };

  return (
    <div className="bm-labels" ref={layerRef} data-testid="building-labels">
      <style>{CSS}</style>
      {specs.map((s) => (
        <span key={`pin-${s.id}`} aria-hidden="true">
          <span className="bm-pin" data-selected={selectedId === s.id} ref={setRef(pins, s.id)} />
          <span className="bm-pin-dot" data-selected={selectedId === s.id} ref={setRef(dots, s.id)} />
        </span>
      ))}
      {[...specs].sort((a, b) => a.priority - b.priority).map((s) => {
        const tag = s.kind === "building" ? tags?.[s.id] : null;
        const tagText = tag?.text.replace(LEADING_GLYPH, "");
        const purpose = s.ariaLabel ?? BUILDING_ARIA[s.id as BuildingId] ?? s.text;
        const selected = selectedId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            className="bm-nameplate"
            data-kind={s.kind}
            data-selected={selected}
            aria-pressed={selected}
            aria-label={tag ? `${purpose}. Current state: ${tagText}.` : purpose}
            ref={setRef(plates, s.id)}
            onClick={() => onActivate(s.id)}
          >
            <span>{s.text}</span>
            {tag && (
              <span className="bm-nameplate__tag" data-tone={tag.tone}>
                <span aria-hidden="true">{GLYPH[tag.tone]} </span>
                {tagText}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
