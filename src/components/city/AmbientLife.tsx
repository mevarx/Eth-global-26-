"use client";
// Ambient life as world-space SVG <g> layers (drawn in world pixels inside the shared
// camera-transformed svg). Two components so the scene can order its layers:
//   AmbientWater   - boats (draggable, each wrapped by DraggableBoat)
//   AmbientStreets - pedestrians, cars, benches and the main-crossing traffic light
// One ticker subscription per component; positions are pure functions of ticker time and
// transforms are written straight to the DOM (no React state per frame). Decoration only.
import { useEffect, useMemo, useRef } from "react";
import type { AmbientTicker } from "./ambient-ticker";
import type { CameraStore } from "./camera-store";
import DraggableBoat from "./DraggableBoat";
import {
  TRAFFIC_LIGHT_AT,
  benches,
  boatRoutes,
  cars,
  parkedCar,
  sampleBoat,
  sampleCar,
  sampleWalker,
  standingWalker,
  trafficLightState,
  walkers,
  type CarSample,
  type PedSample,
} from "./ambient-routes";
import { BoatSprite, CarSprite, ParkBenchSprite, PedestrianSprite, TrafficLightSprite } from "./ambient-sprites";
import { toWorld } from "./iso-layout";

export interface AmbientLifeProps {
  ticker: AmbientTicker;
  camera: CameraStore;
  getHostRect: () => DOMRect | null;
  reducedMotion: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const TAU = Math.PI * 2;
const part = (root: Element, name: string) => root.querySelector<SVGGElement>(`[data-part="${name}"]`);

// ───────────────────────── water ─────────────────────────

export function AmbientWater({ ticker, camera, getHostRect, reducedMotion }: AmbientLifeProps) {
  const bobs = useRef<Array<SVGGElement | null>>([]);
  const wakes = useRef<Array<SVGGElement | null>>([]);

  // Boats stay put under reduced motion; the route itself is the only source of position.
  const routes = useMemo(
    () => boatRoutes.map((b) => (reducedMotion ? () => sampleBoat(b, 0) : (t: number) => sampleBoat(b, t))),
    [reducedMotion],
  );

  useEffect(() => {
    const reset = () => {
      for (const el of bobs.current) el?.removeAttribute("transform");
      for (const el of wakes.current) el?.setAttribute("opacity", "0.5");
    };
    if (reducedMotion) {
      reset();
      return;
    }
    const unsubscribe = ticker.subscribe((t) => {
      boatRoutes.forEach((_, i) => {
        const ph = (t / (2600 + i * 370)) * TAU + i * 1.7;
        bobs.current[i]?.setAttribute("transform", `translate(0 ${r2(Math.sin(ph) * 0.9)}) rotate(${r2(Math.sin(ph * 0.8 + 1) * 1.8)})`);
        wakes.current[i]?.setAttribute("opacity", String(r2(0.42 + 0.14 * Math.sin(ph * 0.6))));
      });
    });
    return () => {
      unsubscribe();
      reset();
    };
  }, [ticker, reducedMotion]);

  return (
    <g data-layer="ambient-water">
      {boatRoutes.map((b, i) => (
        <DraggableBoat
          key={b.id}
          id={b.id}
          label={b.label}
          ticker={ticker}
          camera={camera}
          getHostRect={getHostRect}
          route={routes[i]}
          reducedMotion={reducedMotion}
        >
          <BoatSprite
            style={b.style}
            bobRef={(el) => {
              bobs.current[i] = el;
            }}
            wakeRef={(el) => {
              wakes.current[i] = el;
            }}
          />
        </DraggableBoat>
      ))}
    </g>
  );
}

// ───────────────────────── streets ─────────────────────────

interface CarEls {
  root: SVGGElement;
  orient: SVGGElement | null;
  glow: SVGGElement | null;
}

interface PedEls {
  root: SVGGElement;
  flip: SVGGElement | null;
  lift: SVGGElement | null;
  legL: SVGGElement | null;
  legR: SVGGElement | null;
  armL: SVGGElement | null;
  armR: SVGGElement | null;
  head: SVGGElement | null;
}

const orientOf = (s: CarSample) => `matrix(${s.mirror} ${r2(s.slope * s.mirror)} 0 1 0 0)`;
const placeAt = (x: number, y: number) => `translate(${r2(x)} ${r2(y)})`;

function applyCar(e: CarEls, s: CarSample, glow: number) {
  e.root.setAttribute("transform", placeAt(s.x, s.y));
  e.orient?.setAttribute("transform", orientOf(s));
  e.glow?.setAttribute("opacity", String(r2(glow)));
}

function applyPed(e: PedEls, s: PedSample, t: number) {
  e.root.setAttribute("transform", placeAt(s.x, s.y));
  e.flip?.setAttribute("transform", `scale(${s.facing} 1)`);
  let legs = 0;
  let armL = 0;
  let armR = 0;
  let head = 0;
  let lift = 0;
  if (s.pose === "walk") {
    const a = Math.sin(s.phase * TAU);
    legs = a * 32 * s.speedFrac;
    armL = -legs * 0.75;
    armR = legs * 0.75;
    lift = -Math.abs(Math.cos(s.phase * TAU)) * 0.9 * s.speedFrac;
  } else if (s.pose === "look") {
    head = Math.sin(t / 650) * 14;
  } else if (s.pose === "chat") {
    armR = -50 + Math.sin(t / 260) * 14;
    head = Math.sin(t / 900) * 6;
  } else if (s.pose === "sit") {
    legs = -84;
    lift = 6;
  }
  const sitting = s.pose === "sit";
  e.legL?.setAttribute("transform", `translate(-2.4 -11) rotate(${r2(legs)})`);
  e.legR?.setAttribute("transform", `translate(2.4 -11) rotate(${r2(sitting ? legs : -legs)})`);
  e.armL?.setAttribute("transform", `translate(-6.2 -23.5) rotate(${r2(armL)})`);
  e.armR?.setAttribute("transform", `translate(6.2 -23.5) rotate(${r2(armR)})`);
  e.head?.setAttribute("transform", `translate(0 -30.5) rotate(${r2(head)})`);
  e.lift?.setAttribute("transform", `translate(0 ${r2(lift)})`);
}

function setLight(root: SVGGElement | null, state: ReturnType<typeof trafficLightState>) {
  if (!root) return;
  for (const name of ["red", "amber", "green"] as const) part(root, name)?.setAttribute("opacity", name === state ? "1" : "0.25");
}

type StreetProps = Pick<AmbientLifeProps, "ticker" | "reducedMotion"> & Partial<Pick<AmbientLifeProps, "camera" | "getHostRect">>;

export function AmbientStreets({ ticker, reducedMotion }: StreetProps) {
  const carRoots = useRef<Array<SVGGElement | null>>([]);
  const pedRoots = useRef<Array<SVGGElement | null>>([]);
  const light = useRef<SVGGElement>(null);

  useEffect(() => {
    const carEls: CarEls[] = [];
    const pedEls: PedEls[] = [];
    carRoots.current.forEach((root) => {
      if (root) carEls.push({ root, orient: part(root, "orient"), glow: part(root, "glow") });
    });
    pedRoots.current.forEach((root) => {
      if (root)
        pedEls.push({
          root,
          flip: part(root, "flip"),
          lift: part(root, "lift"),
          legL: part(root, "legL"),
          legR: part(root, "legR"),
          armL: part(root, "armL"),
          armR: part(root, "armR"),
          head: part(root, "head"),
        });
    });

    if (reducedMotion) {
      // Cars parked at the kerb, people standing, light idle: one static placement.
      cars.forEach((c, i) => applyCar(carEls[i], parkedCar(c), 0.35));
      walkers.forEach((w, i) => applyPed(pedEls[i], standingWalker(w), 0));
      setLight(light.current, "green");
      return;
    }

    return ticker.subscribe((t) => {
      cars.forEach((c, i) => applyCar(carEls[i], sampleCar(c, t), 0.45 + 0.15 * Math.sin(t / 900 + i)));
      walkers.forEach((w, i) => applyPed(pedEls[i], sampleWalker(w, t), t));
      setLight(light.current, trafficLightState(t));
    });
  }, [ticker, reducedMotion]);

  const pole = toWorld(TRAFFIC_LIGHT_AT);
  return (
    <g data-layer="ambient-streets" aria-hidden="true" style={{ pointerEvents: "none" }}>
      {benches.map((b) => {
        const p = toWorld(b.at);
        return (
          <g key={b.id} transform={placeAt(p.x, p.y)}>
            <ParkBenchSprite axis={b.axis} />
          </g>
        );
      })}
      {cars.map((c, i) => {
        const s = reducedMotion ? parkedCar(c) : sampleCar(c, 0);
        return (
          <g
            key={c.id}
            ref={(el) => {
              carRoots.current[i] = el;
            }}
            transform={placeAt(s.x, s.y)}
          >
            <CarSprite shape={c.shape} body={c.body} accent={c.accent} orient={orientOf(s)} />
          </g>
        );
      })}
      {walkers.map((w, i) => {
        const s = reducedMotion ? standingWalker(w) : sampleWalker(w, 0);
        return (
          <g
            key={w.id}
            ref={(el) => {
              pedRoots.current[i] = el;
            }}
            transform={placeAt(s.x, s.y)}
          >
            <PedestrianSprite outfit={w.outfit} facing={s.facing} />
          </g>
        );
      })}
      <g ref={light} transform={placeAt(pole.x, pole.y)}>
        <TrafficLightSprite />
      </g>
    </g>
  );
}
