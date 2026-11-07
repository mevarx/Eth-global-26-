"use client";
// Reusable isometric building: one diamond footprint, two visible walls,
// one hip/flat roof. Original geometry rendered with React + SVG only.
// Hover/focus lift, press squash and the selection ring are CSS-only (city.css).
import type { CSSProperties, ReactNode } from "react";
import { doorQuad, isoGeometry, pts, windowQuad } from "./iso-geometry";
import type { BuildingDef } from "./scene-config";

import type { BuildingTag } from "./scene-labels";

interface IsoBuildingProps {
  def: BuildingDef;
  selected: boolean;
  onSelect: () => void;
  /** Accessible state phrase appended to the name (real state only). */
  stateLabel?: string;
  /** Stagger index for the page-load pop-in. */
  index: number;
  /** Data attributes that drive state styling in city.css. */
  dataState?: Record<string, string>;
  tag?: BuildingTag | null;
  wallLeft?: string;
  wallRight?: string;
  chimney?: boolean;
  children?: ReactNode;
}

export default function IsoBuilding({
  def,
  selected,
  onSelect,
  stateLabel,
  index,
  dataState = {},
  tag = null,
  wallLeft = "#f3e6cf",
  wallRight = "#e2cba4",
  chimney = false,
  children,
}: IsoBuildingProps) {
  const { cx, cy, hw, wallH, roof, roofColor } = def;
  const g = isoGeometry(def);
  const { hh, roofH, R, B, L, Tt, Rt, Bt, Lt, apex } = g;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  const lift = wallH * 0.35;
  const windows = [
    windowQuad(L, B, 0.18, 0.38, lift),
    windowQuad(L, B, 0.6, 0.8, lift),
    windowQuad(R, B, 0.18, 0.38, lift),
    windowQuad(R, B, 0.6, 0.8, lift),
  ];
  const door = doorQuad(g, wallH);
  const data = Object.fromEntries(Object.entries(dataState).map(([k, v]) => [`data-${k}`, v]));
  const nameY = Math.min(apex.y, Tt.y - 7) - 42;

  return (
    <g
      className="tc-bldg"
      data-building={def.id}
      data-selected={selected ? "true" : "false"}
      {...data}
      role="button"
      tabIndex={0}
      aria-label={`${def.name}: ${def.description}${stateLabel ? ` Current state: ${stateLabel}.` : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{ "--i": index } as CSSProperties}
    >
      <title>{`${def.name}, ${def.description}`}</title>
      <g className="tc-bldg-pop">
        {/* ground shadow grows on hover via transform only */}
        <ellipse className="tc-bldg-shadow" cx={cx} cy={cy + hh * 0.55} rx={hw * 1.05} ry={hh * 0.6} fill="#00000022" />
        <ellipse
          className="tc-focus-ring"
          cx={cx}
          cy={cy + hh * 0.55}
          rx={hw * 1.24}
          ry={hh * 0.84}
          fill="none"
          stroke="#1a5fb4"
          strokeWidth={3}
        />
        {selected && (
          <g className="tc-sel" aria-hidden="true">
            <ellipse
              className="tc-sel-draw"
              cx={cx}
              cy={cy + hh * 0.55}
              rx={hw * 1.18}
              ry={hh * 0.78}
              pathLength={100}
              fill="none"
              stroke="#1a5fb4"
              strokeWidth={3}
            />
            <ellipse
              className="tc-sel-march"
              cx={cx}
              cy={cy + hh * 0.55}
              rx={hw * 1.18}
              ry={hh * 0.78}
              pathLength={96}
              fill="none"
              stroke="#1a5fb4"
              strokeWidth={3}
              strokeDasharray="4 2"
            />
          </g>
        )}
        <g className="tc-bldg-body">
          <polygon points={pts([L, B, Bt, Lt])} fill={wallLeft} stroke="#8a7a5c" strokeWidth={1.5} />
          <polygon points={pts([R, B, Bt, Rt])} fill={wallRight} stroke="#8a7a5c" strokeWidth={1.5} />
          {windows.map((w, k) => (
            <polygon key={`w${k}`} points={w} fill="#3d5a6c" />
          ))}
          {/* warm light overlays; opacity driven by state in city.css */}
          {windows.map((w, k) => (
            <polygon
              key={`l${k}`}
              className="tc-win-lit"
              points={w}
              fill="#f6d27a"
              style={{ "--wi": k } as CSSProperties}
            />
          ))}
          <polygon points={door} fill="#2f2a22" />
          <polygon className="tc-door" points={door} fill="#8a5a3b" stroke="#5c3a22" strokeWidth={1} />
          {roof === "hip" ? (
            <>
              <polygon points={pts([apex, Lt, Bt])} fill={roofColor} stroke="#6e3a22" strokeWidth={1.5} />
              <polygon
                points={pts([apex, Bt, Rt])}
                fill={roofColor}
                stroke="#6e3a22"
                strokeWidth={1.5}
                filter="brightness(0.88)"
              />
              {chimney && (
                <rect
                  x={cx + hw * 0.28}
                  y={apex.y + roofH * 0.25}
                  width={12}
                  height={26}
                  fill="#8a7a5c"
                  stroke="#5c564a"
                  strokeWidth={1.5}
                />
              )}
            </>
          ) : (
            <>
              {/* flat roof: thin parapet bands, then the slab */}
              <polygon points={pts([Lt, Bt, { x: Bt.x, y: Bt.y - 6 }, { x: Lt.x, y: Lt.y - 6 }])} fill="#a8562f" stroke="#6e3a22" strokeWidth={1} />
              <polygon points={pts([Bt, Rt, { x: Rt.x, y: Rt.y - 6 }, { x: Bt.x, y: Bt.y - 6 }])} fill="#8f4826" stroke="#6e3a22" strokeWidth={1} />
              <polygon
                points={pts([Lt, Tt, Rt, Bt].map((p) => ({ x: p.x, y: p.y - 6 })))}
                fill={roofColor}
                stroke="#6e3a22"
                strokeWidth={1.5}
              />
            </>
          )}
          {children}
        </g>
        <text x={cx} y={nameY} className="nameplate">
          {def.name}
        </text>
        {tag && (
          <text {...tagPos(def)} className={`tc-tag tc-tag-${tag.tone}`} aria-hidden="true">
            {tag.text}
          </text>
        )}
      </g>
    </g>
  );
}

/** State tags sit above the roofs (clear of the worker and of each other). */
function tagPos(def: BuildingDef): { x: number; y: number; textAnchor: "middle" | "end" } {
  if (def.id === "studio") return { x: def.cx, y: 30, textAnchor: "middle" };
  if (def.id === "registry") return { x: def.cx + 78, y: 9, textAnchor: "end" };
  return { x: def.cx, y: 12, textAnchor: "middle" };
}
