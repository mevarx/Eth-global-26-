// ONE shared requestAnimationFrame ticker for all ambient decoration (boats,
// people, cars, scenery). Subscribers receive accumulated *visible* time in ms,
// so pausing (hidden tab, off-screen scene, reduced motion) never causes a jump.
// Entity positions must be pure functions of that time; nothing here is state.

export type TickFn = (timeMs: number) => void;

export interface ClockState {
  elapsed: number;
  last: number | null;
}

/** Pure clock step: advances only while running; a resume never adds the paused gap. */
export function stepClock(s: ClockState, now: number, running: boolean, maxStepMs = 100): ClockState {
  if (!running) return { elapsed: s.elapsed, last: null };
  if (s.last === null) return { elapsed: s.elapsed, last: now };
  return { elapsed: s.elapsed + Math.min(maxStepMs, Math.max(0, now - s.last)), last: now };
}

export interface AmbientTicker {
  subscribe(fn: TickFn): () => void;
  /** Current accumulated time (ms). */
  now(): number;
  /** Set by the scene from an IntersectionObserver. */
  setOnScreen(onScreen: boolean): void;
  /** prefers-reduced-motion: stop advancing; subscribers get one static call. */
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export function createAmbientTicker(): AmbientTicker {
  const subs = new Set<TickFn>();
  let clock: ClockState = { elapsed: 0, last: null };
  let onScreen = true;
  let reduced = false;
  let raf = 0;
  let disposed = false;
  const hidden = () => typeof document !== "undefined" && document.hidden;
  const running = () => !disposed && onScreen && !reduced && !hidden() && subs.size > 0;

  const frame = (now: number) => {
    raf = 0;
    clock = stepClock(clock, now, running());
    for (const fn of subs) fn(clock.elapsed);
    schedule();
  };
  const schedule = () => {
    if (raf || !running() || typeof requestAnimationFrame === "undefined") return;
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clock = { elapsed: clock.elapsed, last: null };
  };
  const refresh = () => (running() ? schedule() : halt());
  const onVisibility = () => refresh();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

  return {
    subscribe(fn) {
      subs.add(fn);
      fn(clock.elapsed);
      refresh();
      return () => {
        subs.delete(fn);
        refresh();
      };
    },
    now: () => clock.elapsed,
    setOnScreen(v) {
      onScreen = v;
      refresh();
    },
    setReducedMotion(v) {
      reduced = v;
      refresh();
      if (v) for (const fn of subs) fn(clock.elapsed);
    },
    dispose() {
      disposed = true;
      halt();
      subs.clear();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
