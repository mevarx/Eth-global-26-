"use client";
// Decorative scenery for the empty land blocks: original SVG in WORLD space (brief §6.5). The
// parent SVG applies the camera transform; this layer never subscribes to the camera. Presentation
// only: no state, no data meaning. Animated parts are driven by ONE ticker subscription that
// writes transform/opacity straight to the DOM (no React state); static under reduced motion.
import { useEffect, useMemo, useRef } from "react";
import type { AmbientTicker } from "./ambient-ticker";
import { OCCLUSION_MASK_ID } from "./OcclusionMask";
import { SCENERY_RENDERERS } from "./scenery-kinds";
import { animPose, sceneryDrawSlots, type AnimKind } from "./scenery-plan";
import { isRearObject } from "./scene-depth";

export { sceneryLabelSpecs } from "./scenery-plan";

export interface SceneryProps {
  ticker: AmbientTicker;
  reducedMotion: boolean;
}

interface Animated {
  el: SVGElement;
  kind: AnimKind;
  period: number;
  phase: number;
  amp: number;
}

function collect(root: SVGGElement): Animated[] {
  return Array.from(root.querySelectorAll<SVGElement>("[data-anim]")).map((el) => ({
    el,
    kind: el.getAttribute("data-anim") as AnimKind,
    period: Number(el.getAttribute("data-p")) || 4000,
    phase: Number(el.getAttribute("data-ph")) || 0,
    amp: Number(el.getAttribute("data-amp")) || 0,
  }));
}

function apply(list: Animated[], t: number) {
  for (const a of list) {
    const pose = animPose(a.kind, a.period, a.phase, a.amp, t);
    if (pose.transform !== undefined) a.el.style.transform = pose.transform;
    if (pose.opacity !== undefined) a.el.style.opacity = String(pose.opacity);
  }
}

export function Scenery({ ticker, reducedMotion }: SceneryProps) {
  const root = useRef<SVGGElement>(null);
  const slots = useMemo(() => sceneryDrawSlots(), []);
  // Rear objects (a key building stands in front of them) ride inside the building-occlusion
  // mask: the building hole reveals the canvas building, so rear art can never paint over it.
  const rear = useMemo(() => slots.filter((s) => isRearObject(s.rect)), [slots]);
  const front = useMemo(() => slots.filter((s) => !isRearObject(s.rect)), [slots]);
  const art = (s: (typeof slots)[number]) => {
    const Renderer = SCENERY_RENDERERS[s.scenery as keyof typeof SCENERY_RENDERERS];
    return (
      <g key={s.id} data-scenery-slot={s.id} data-rear={isRearObject(s.rect) ? "true" : undefined}>
        <Renderer rect={s.rect} />
      </g>
    );
  };

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const list = collect(g);
    if (reducedMotion) {
      apply(list, 0);
      return;
    }
    return ticker.subscribe((t) => apply(list, t));
  }, [ticker, reducedMotion]);

  return (
    <g ref={root} aria-hidden="true" pointerEvents="none" data-scenery="">
      <g mask={`url(#${OCCLUSION_MASK_ID})`}>{rear.map(art)}</g>
      {front.map(art)}
    </g>
  );
}
