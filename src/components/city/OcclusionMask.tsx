"use client";
// Shared mask that hides rear scenery/landmark art wherever a key building paint-overs it:
// the Pixi canvas below already carries the buildings, so punching building-shaped holes in
// the SVG object layer restores the painter's order (a building in front covers what is behind).
// Geometry comes from scene-depth.buildingOccluders() in world px; the camera transform of the
// parent SVG applies to the mask too, so it holds at every zoom.
import { useMemo } from "react";
import { buildingOccluders } from "./scene-depth";

export const OCCLUSION_MASK_ID = "bm-building-occlusion";

/** White cover (world bounds of the whole island incl. water) with the buildings cut out. */
const COVER = { x: -900, y: -260, w: 2700, h: 1500 };

export default function BuildingOcclusionMask() {
  const polys = useMemo(() => buildingOccluders().flatMap((o) => o.polys), []);
  return (
    <defs aria-hidden="true">
      <mask id={OCCLUSION_MASK_ID} maskUnits="userSpaceOnUse" x={COVER.x} y={COVER.y} width={COVER.w} height={COVER.h}>
        <rect x={COVER.x} y={COVER.y} width={COVER.w} height={COVER.h} fill="#fff" />
        {polys.map((points, i) => (
          <polygon key={i} points={points} fill="#000" />
        ))}
      </mask>
    </defs>
  );
}
