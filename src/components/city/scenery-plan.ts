// Pure plan for the scenery layer: which slots get art, their name-plate inputs and the
// animation pose maths. No React, no randomness; poses are pure functions of ticker time.
import { sortSceneObjects, type GroundObject } from "./scene-depth";
import { toWorld } from "./iso-layout";
import { SLOTS, rectCentre, type SceneryKind, type ScenerySlot } from "./slots";

export type RenderableSceneryKind = Exclude<SceneryKind, "plaza">;

/** Every kind Scenery draws; the plaza is existing Pixi art. */
export const SCENERY_RENDERABLE_KINDS: readonly RenderableSceneryKind[] = [
  "park",
  "market",
  "court",
  "solar",
  "wind",
  "garden",
  "bus-station",
  "playground",
  "amphitheater",
  "dock",
  "grove",
];

function toGroundObject(s: ScenerySlot): ScenerySlot & GroundObject {
  return { ...s, heightPx: SCENERY_ART_HEIGHT[s.scenery as RenderableSceneryKind] ?? 0 };
}

/** Scenery slots to draw, by the SHARED depth key (front gx+gy corner, then height): so tall
 * props never paint over a neighbour that stands in front of them, city-wide. */
export function sceneryDrawSlots(): (ScenerySlot & GroundObject)[] {
  return sortSceneObjects(SLOTS.filter((s): s is ScenerySlot => s.role === "scenery-block" && !s.existing).map(toGroundObject));
}

/** Approximate art height of each renderer in world px (tiebreak for equal ground depth). */
export const SCENERY_ART_HEIGHT: Record<RenderableSceneryKind, number> = {
  park: 56,
  market: 24,
  court: 26,
  solar: 12,
  wind: 62,
  garden: 10,
  "bus-station": 30,
  playground: 26,
  amphitheater: 24,
  dock: 46,
  grove: 26,
};


/** Name-plate inputs for the label layer; anchor is a ground point in world px. */
export function sceneryLabelSpecs(): Array<{ id: string; text: string; anchor: { x: number; y: number } }> {
  return sceneryDrawSlots()
    .filter((s) => s.plate)
    .map((s) => {
      const c = rectCentre(s.rect);
      // the park's centre is its pond; put the plate on the front lawn instead
      const shift = s.scenery === "park" ? 1.3 : 0;
      const p = toWorld({ gx: c.gx + shift, gy: c.gy + shift });
      return { id: s.id, text: s.plate as string, anchor: { x: p.x, y: p.y + 10 } };
    });
}

export type AnimKind = "spin" | "ripple" | "flag" | "sway" | "glint";

export interface AnimPose {
  transform?: string;
  opacity?: number;
}

const TAU = Math.PI * 2;

/** period in ms, phase 0..1, amp kind-specific (degrees for sway, fraction for flag). */
export function animPose(kind: AnimKind, period: number, phase: number, amp: number, t: number): AnimPose {
  const f = (((t / period + phase) % 1) + 1) % 1;
  const s = Math.sin(f * TAU);
  switch (kind) {
    case "spin":
      return { transform: `rotate(${(f * 360).toFixed(2)}deg)` };
    case "ripple":
      return { transform: `scale(${(0.3 + 0.7 * f).toFixed(3)})`, opacity: Number((0.55 * (1 - f)).toFixed(3)) };
    case "flag":
      return { transform: `scale(${(1 + amp * s).toFixed(3)}, 1) skewY(${(amp * 30 * Math.sin(f * TAU * 2)).toFixed(2)}deg)` };
    case "sway":
      return { transform: `rotate(${(amp * s).toFixed(2)}deg)` };
    case "glint":
      return { opacity: Number((0.1 + 0.4 * (0.5 + 0.5 * s)).toFixed(3)) };
  }
}
