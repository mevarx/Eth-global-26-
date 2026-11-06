// Original SVG sprites for ambient life (boats, pedestrians, cars, bench, traffic light).
// Drawn in world pixels around their ground point; colours come from --bm-* tokens only.
// Animated parts carry data-part names that AmbientLife writes transforms to directly.
import type { Ref } from "react";
import type { BoatStyle, Bench, CarShape, PedOutfit } from "./ambient-routes";

const INK = "var(--bm-scene-ink)";
const CREAM = "var(--bm-scene-sign)";
const LIGHT = "var(--bm-scene-wall-light)";
const SHADE = "var(--bm-scene-wall-shade)";
const WOOD = "var(--bm-scene-wood)";
const WOOD_DARK = "var(--bm-scene-wood-dark)";
const GLASS = "var(--bm-scene-window)";
const LAMP = "var(--bm-scene-lamp-glow)";
const STONE = "var(--bm-scene-stone)";
const RED = "var(--bm-scene-roof-red)";
const BLUE = "var(--bm-scene-roof-blue)";
const OUTLINE = { stroke: INK, strokeWidth: 0.9, strokeLinejoin: "round" as const };

// ───────────────────────── boats (top-down, bow +x, ~40 px) ─────────────────────────

function Hull({ d, fill }: { d: string; fill: string }) {
  return <path d={d} fill={fill} {...OUTLINE} />;
}

function BoatArt({ style }: { style: BoatStyle }) {
  switch (style) {
    case "sailboat":
      return (
        <>
          <Hull d="M-17,-4.5 L6,-5 Q18,-3 21,0 Q18,3 6,5 L-17,4.5 Z" fill={LIGHT} />
          <rect x={-13} y={-1.2} width={20} height={2.4} rx={1.2} fill={WOOD} />
          <path d="M3,0 C-3,-8 -11,-9 -17,-7 C-12,-3 -6,-1 3,0 Z" fill={CREAM} {...OUTLINE} />
          <path d="M4,0 L17,-0.2 L5,-4 Z" fill={LIGHT} {...OUTLINE} />
          <circle cx={3} cy={0} r={1.3} fill={WOOD_DARK} />
        </>
      );
    case "ferry":
      return (
        <>
          <Hull d="M-23,-6.5 L9,-6.5 Q22,-5 25,0 Q22,5 9,6.5 L-23,6.5 Z" fill={LIGHT} />
          <rect x={-23} y={-6.5} width={32} height={2} fill={BLUE} />
          <rect x={-23} y={4.5} width={32} height={2} fill={BLUE} />
          <rect x={-16} y={-4} width={24} height={8} rx={1.5} fill={SHADE} {...OUTLINE} />
          {[-12, -6, 0, 5].map((x) => (
            <rect key={x} x={x} y={-2.6} width={3.6} height={5.2} rx={0.8} fill={GLASS} />
          ))}
          <circle cx={-18} cy={0} r={2.6} fill={RED} {...OUTLINE} />
        </>
      );
    case "fishing":
      return (
        <>
          <Hull d="M-19,-5.5 L6,-6 Q17,-3.5 20,0 Q17,3.5 6,6 L-19,5.5 Z" fill="var(--bm-scene-court)" />
          <rect x={-15} y={-4} width={10} height={8} rx={1.2} fill={LIGHT} {...OUTLINE} />
          <rect x={-13} y={-2.4} width={4} height={4.8} rx={0.8} fill={GLASS} />
          <path d="M3,0 L3,-1 M-1,-5 L-9,-12 M-1,5 L-9,12" stroke={WOOD_DARK} strokeWidth={1.2} strokeLinecap="round" fill="none" />
          <circle cx={-9} cy={-12} r={1.4} fill={RED} />
          <circle cx={-9} cy={12} r={1.4} fill={RED} />
          <circle cx={3} cy={0} r={1.3} fill={WOOD_DARK} />
        </>
      );
    case "kayak":
      return (
        <>
          <Hull d="M-16,0 Q-14,-3.2 0,-3.2 Q13,-3.2 18,0 Q13,3.2 0,3.2 Q-14,3.2 -16,0 Z" fill={RED} />
          <ellipse cx={-1} cy={0} rx={3.2} ry={2.4} fill="var(--bm-scene-solar-panel)" />
          <circle cx={0.5} cy={0} r={2} fill="var(--bm-scene-path)" {...OUTLINE} />
          <path d="M-1,-10 L2,10" stroke={WOOD_DARK} strokeWidth={1.2} strokeLinecap="round" fill="none" />
          <ellipse cx={-1.2} cy={-10} rx={1.2} ry={2.4} fill={WOOD} />
          <ellipse cx={2.2} cy={10} rx={1.2} ry={2.4} fill={WOOD} />
        </>
      );
    case "dinghy":
      return (
        <>
          <Hull d="M-15,-4.2 L8,-4.6 Q16,-2.2 18,0 Q16,2.2 8,4.6 L-15,4.2 Z" fill={WOOD} />
          <path d="M2,0 L-12,-8 L-12,0 Z" fill={CREAM} {...OUTLINE} />
          <path d="M2,0 L-12,0" stroke={INK} strokeWidth={0.9} />
          <circle cx={2} cy={0} r={1.2} fill={WOOD_DARK} />
        </>
      );
  }
}

const WAKE_LENGTH: Record<BoatStyle, number> = { sailboat: 26, ferry: 34, fishing: 24, kayak: 16, dinghy: 20 };

export interface BoatSpriteProps {
  style: BoatStyle;
  /** Group the ticker tilts and lifts gently (bobbing). */
  bobRef?: Ref<SVGGElement>;
  /** Group whose opacity pulses softly (wake). */
  wakeRef?: Ref<SVGGElement>;
}

/** Boat at the origin, bow toward +x, with a soft wake trailing behind. */
export function BoatSprite({ style, bobRef, wakeRef }: BoatSpriteProps) {
  const wl = WAKE_LENGTH[style];
  const stern = style === "ferry" ? -23 : -17;
  return (
    <>
      <g ref={wakeRef} opacity={0.5} fill="none" stroke={LIGHT} strokeWidth={1.2} strokeLinecap="round">
        <path d={`M${stern},-4 Q${stern - wl / 2},-6 ${stern - wl},-${wl / 2.2}`} />
        <path d={`M${stern},4 Q${stern - wl / 2},6 ${stern - wl},${wl / 2.2}`} />
        <path d={`M${stern - 2},0 L${stern - wl * 0.8},0`} strokeDasharray="2 4" opacity={0.7} />
      </g>
      <ellipse cx={0} cy={1} rx={style === "ferry" ? 24 : 19} ry={7.5} fill={INK} opacity={0.14} />
      <g ref={bobRef}>
        <BoatArt style={style} />
      </g>
    </>
  );
}

// ───────────────────────── cars (side view, skewed onto the street axes) ─────────────────────────

export interface CarSpriteProps {
  shape: CarShape;
  body: string;
  accent: string;
  /** Initial matrix transform for the orient group (AmbientLife rewrites it per frame). */
  orient: string;
}

const CAR_HALF: Record<CarShape, number> = { hatchback: 15, van: 18, bus: 24 };

function Wheel({ x, r = 3 }: { x: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={-r} r={r} fill={INK} />
      <circle cx={x} cy={-r} r={r * 0.4} fill={STONE} />
    </>
  );
}

function CarArt({ shape, body, accent }: Omit<CarSpriteProps, "orient">) {
  if (shape === "hatchback")
    return (
      <>
        <rect x={-15} y={-10} width={30} height={7} rx={2.5} fill={body} {...OUTLINE} />
        <path d="M-10,-10 L-8,-16 L4,-16 L9,-10 Z" fill={body} {...OUTLINE} />
        <path d="M-7.6,-10.8 L-6.4,-15 L3.4,-15 L7,-10.8 Z" fill={GLASS} />
        <rect x={-15} y={-7.6} width={30} height={1.4} fill={accent} opacity={0.55} />
        <Wheel x={-9} />
        <Wheel x={9} />
        <rect x={13} y={-8.4} width={2} height={2.2} rx={0.8} fill={LAMP} />
        <rect x={-15.4} y={-8.4} width={1.6} height={2.2} rx={0.6} fill={RED} />
      </>
    );
  if (shape === "van")
    return (
      <>
        <rect x={-18} y={-17} width={36} height={14} rx={3} fill={body} {...OUTLINE} />
        <path d="M9,-15 L9,-9 L16.5,-9 L13.5,-15 Z" fill={GLASS} />
        <rect x={-6} y={-14} width={10} height={5} rx={1} fill={GLASS} />
        <rect x={-18} y={-8} width={36} height={2.2} fill={accent} opacity={0.8} />
        <Wheel x={-11} />
        <Wheel x={11} />
        <rect x={16} y={-9} width={2} height={2.2} rx={0.8} fill={LAMP} />
        <rect x={-18.4} y={-9} width={1.6} height={2.2} rx={0.6} fill={RED} />
      </>
    );
  return (
    <>
      <rect x={-24} y={-21} width={48} height={18} rx={4} fill={body} {...OUTLINE} />
      {[-20, -11, -2, 7].map((x) => (
        <rect key={x} x={x} y={-18} width={7} height={6.5} rx={1.2} fill={GLASS} />
      ))}
      <path d="M16,-18 L16,-11.5 L22.4,-11.5 Q23.4,-11.5 23.4,-13 L23.4,-17 Q23.4,-18 22,-18 Z" fill={GLASS} />
      <rect x={-24} y={-9.6} width={48} height={2.4} fill={accent} opacity={0.85} />
      <Wheel x={-14} r={3.4} />
      <Wheel x={14} r={3.4} />
      <rect x={22} y={-8} width={2} height={2.4} rx={0.8} fill={LAMP} />
      <rect x={-24.4} y={-8} width={1.6} height={2.4} rx={0.6} fill={RED} />
    </>
  );
}

/** Car at its ground point; bow toward +x before the orient matrix is applied. */
export function CarSprite({ shape, body, accent, orient }: CarSpriteProps) {
  const half = CAR_HALF[shape];
  return (
    <g data-part="orient" transform={orient}>
      <ellipse cx={0} cy={0.5} rx={half + 2} ry={3.6} fill={INK} opacity={0.2} />
      <ellipse data-part="glow" cx={half + 6} cy={-6} rx={9} ry={3.4} fill={LAMP} opacity={0.4} />
      <CarArt shape={shape} body={body} accent={accent} />
    </g>
  );
}

// ───────────────────────── pedestrians ─────────────────────────

export interface PedestrianSpriteProps {
  outfit: PedOutfit;
  /** Initial screen facing (1 right, -1 left); AmbientLife rewrites it per frame. */
  facing: 1 | -1;
}

function Hair({ outfit }: { outfit: PedOutfit }) {
  const hair = outfit.hair;
  switch (outfit.hairStyle) {
    case "bald":
      return null;
    case "long":
      return (
        <>
          <rect x={-6.4} y={-2} width={5.4} height={11} rx={2.6} fill={hair} />
          <circle cx={-0.4} cy={-0.8} r={6} fill={hair} />
        </>
      );
    case "bun":
      return (
        <>
          <circle cx={-0.4} cy={-0.8} r={6} fill={hair} />
          <circle cx={-5.2} cy={-5.4} r={2.4} fill={hair} />
        </>
      );
    case "cap":
      return (
        <>
          <circle cx={-0.4} cy={-0.8} r={6} fill={hair} />
          <path d="M-5.6,-2.2 A6,6 0 0 1 5.8,-2.2 L9.2,-1.4 L9.2,0.2 L-5.6,0.2 Z" fill={outfit.pants} stroke={INK} strokeWidth={0.7} />
        </>
      );
    default:
      return <circle cx={-0.4} cy={-0.8} r={6} fill={hair} />;
  }
}

/** Pedestrian standing at the origin, facing +x; legs, arms and head are animated by name. */
export function PedestrianSprite({ outfit, facing }: PedestrianSpriteProps) {
  const legFill = outfit.skirt ? outfit.skin : outfit.pants;
  const leg = (name: string, x: number) => (
    <g data-part={name} transform={`translate(${x} -11)`}>
      <rect x={-1.7} y={0} width={3.4} height={10} rx={1.4} fill={legFill} />
      <rect x={-1.7} y={9} width={5} height={2.4} rx={1.2} fill={INK} />
    </g>
  );
  const arm = (name: string, x: number) => (
    <g data-part={name} transform={`translate(${x} -23.5)`}>
      <rect x={-1.5} y={0} width={3} height={9.5} rx={1.5} fill={outfit.shirt} stroke={INK} strokeWidth={0.6} />
      <circle cx={0} cy={9.8} r={1.6} fill={outfit.skin} />
    </g>
  );
  return (
    <>
      <ellipse cx={0} cy={0.6} rx={8 * outfit.height} ry={3} fill={INK} opacity={0.2} />
      <g data-part="flip" transform={`scale(${facing} 1)`}>
        <g transform={`scale(${outfit.height})`}>
          <g data-part="lift">
            {leg("legL", -2.4)}
            {leg("legR", 2.4)}
            {arm("armL", -6.2)}
            <rect x={-5.6} y={-25} width={11.2} height={15} rx={3.5} fill={outfit.shirt} stroke={INK} strokeWidth={0.8} />
            {outfit.skirt && <path d="M-6,-13 L6,-13 L8.4,-5 L-8.4,-5 Z" fill={outfit.pants} stroke={INK} strokeWidth={0.7} />}
            {outfit.scarf && <rect x={-4.6} y={-26.4} width={9.2} height={3} rx={1.5} fill={outfit.scarf} />}
            <g data-part="head" transform="translate(0 -30.5)">
              <rect x={-1.6} y={3} width={3.2} height={3} fill={outfit.skin} />
              <Hair outfit={outfit} />
              <circle cx={0.9} cy={0.6} r={5.2} fill={outfit.skin} />
              {outfit.hairStyle === "bald" && <circle cx={-4.8} cy={0.8} r={1.1} fill={outfit.skin} />}
              <circle cx={3.2} cy={0.2} r={0.75} fill={INK} />
            </g>
            {arm("armR", 6.2)}
          </g>
        </g>
      </g>
    </>
  );
}

// ───────────────────────── street furniture ─────────────────────────

/** Park bench on the sidewalk edge, skewed onto its street axis. */
export function ParkBenchSprite({ axis }: { axis: Bench["axis"] }) {
  const skew = axis === "x" ? 0.5 : -0.5;
  return (
    <g transform={`matrix(1 ${skew} 0 1 0 0)`}>
      <ellipse cx={0} cy={0.6} rx={11} ry={2.6} fill={INK} opacity={0.18} />
      <rect x={-8} y={-5} width={2} height={5} fill={WOOD_DARK} />
      <rect x={6} y={-5} width={2} height={5} fill={WOOD_DARK} />
      <rect x={-10} y={-7} width={20} height={2.4} rx={0.8} fill={WOOD} {...OUTLINE} />
      <rect x={-10} y={-13} width={20} height={1.8} rx={0.7} fill={WOOD} {...OUTLINE} />
      <rect x={-8} y={-13} width={1.4} height={6} fill={WOOD_DARK} />
      <rect x={6.6} y={-13} width={1.4} height={6} fill={WOOD_DARK} />
    </g>
  );
}

/** Small traffic light; AmbientLife switches the lamp opacities by name (red, amber, green). */
export function TrafficLightSprite() {
  return (
    <>
      <ellipse cx={0} cy={0.6} rx={4} ry={1.8} fill={INK} opacity={0.2} />
      <rect x={-0.9} y={-30} width={1.8} height={30} fill={STONE} />
      <rect x={-4} y={-44} width={8} height={16} rx={2} fill={INK} />
      <circle data-part="red" cx={0} cy={-40} r={2.2} fill={RED} opacity={0.25} />
      <circle data-part="amber" cx={0} cy={-36} r={2.2} fill={LAMP} opacity={0.25} />
      <circle data-part="green" cx={0} cy={-32} r={2.2} fill="var(--bm-scene-foliage)" opacity={0.25} />
    </>
  );
}
