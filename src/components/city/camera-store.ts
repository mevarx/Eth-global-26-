// Camera contract shared by the Pixi engine and every DOM/SVG overlay layer.
// World pixels come from iso-layout toWorld(); screen = world * z + (x, y), in px
// relative to the scene host's top-left corner. No React state per frame:
// layers subscribe and write transforms directly.

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface Pt {
  x: number;
  y: number;
}

export function worldToScreen(c: Camera, p: Pt): Pt {
  return { x: c.x + p.x * c.z, y: c.y + p.y * c.z };
}

export function screenToWorld(c: Camera, p: Pt): Pt {
  return { x: (p.x - c.x) / c.z, y: (p.y - c.y) / c.z };
}

/** CSS transform that maps world pixels onto the host for a layer with transform-origin 0 0. */
export function worldTransform(c: Camera): string {
  return `translate(${c.x}px, ${c.y}px) scale(${c.z})`;
}

export interface CameraStore {
  get(): Camera | null;
  set(c: Camera): void;
  /** Calls fn immediately when a camera exists; returns an unsubscribe function. */
  subscribe(fn: (c: Camera) => void): () => void;
}

export function createCameraStore(): CameraStore {
  let current: Camera | null = null;
  const subs = new Set<(c: Camera) => void>();
  return {
    get: () => current,
    set(c) {
      current = { x: c.x, y: c.y, z: c.z };
      for (const fn of subs) fn(current);
    },
    subscribe(fn) {
      subs.add(fn);
      if (current) fn(current);
      return () => {
        subs.delete(fn);
      };
    },
  };
}
