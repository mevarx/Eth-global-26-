// Pure WCAG contrast helpers and glass-opacity floors. No DOM, no React.

export type Rgb = readonly [number, number, number];

/** Backdrop palette for dashboard routes; SA-8's `--bm-sky-*` tokens mirror these. */
export const DASHBOARD_SKY = {
  top: "#1f5fa8",
  bottom: "#7ec0ee",
  cloud: "#f4f7fb",
  scrimAlpha: 0.12,
} as const;

/** Design-token values used for the worst-case checks (mirror `--bm-bg-1`, `--bm-text-*`). */
export const GLASS_PANEL_HEX = "#0b1b2e";
export const TEXT_PRIMARY_HEX = "#f1f5f9";
export const TEXT_SECONDARY_HEX = "#b4c3d4";

export const TEXT_PRIMARY_TARGET = 7;
export const TEXT_SECONDARY_TARGET = 4.5;

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function relativeLuminance(rgb: Rgb | string): number {
  const [r, g, b] = typeof rgb === "string" ? hexToRgb(rgb) : rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` at `alpha` composited over opaque `bg` (colors as RGB triplets or hex). */
export function composite(
  fg: Rgb | string,
  bg: Rgb | string,
  alpha: number,
): Rgb {
  const f = typeof fg === "string" ? hexToRgb(fg) : fg;
  const b = typeof bg === "string" ? hexToRgb(bg) : bg;
  const a = Math.min(1, Math.max(0, alpha));
  return [
    f[0] * a + b[0] * (1 - a),
    f[1] * a + b[1] * (1 - a),
    f[2] * a + b[2] * (1 - a),
  ];
}

/**
 * Smallest panel opacity (0..1, 0.01 steps) at which `text` reaches `target`
 * contrast on `panel` composited over `backdrop`. Null when even 1.0 fails.
 */
export function minGlassOpacity(input: {
  panel: string;
  backdrop: string;
  text: string;
  target: number;
}): number | null {
  for (let i = 0; i <= 100; i++) {
    const alpha = i / 100;
    const surface = composite(input.panel, input.backdrop, alpha);
    if (contrastRatio(input.text, surface) >= input.target) return alpha;
  }
  return null;
}

const floorFor = (
  backdrop: string,
  checks: ReadonlyArray<{ text: string; target: number }>,
) => {
  let worst = 0;
  for (const c of checks) {
    const m = minGlassOpacity({
      panel: GLASS_PANEL_HEX,
      backdrop,
      text: c.text,
      target: c.target,
    });
    worst = Math.max(worst, m ?? 1);
  }
  return Math.ceil(worst * 100 - 1e-9) / 100;
};

/** Worst case: brightest backdrop pixel is the cloud color, ignoring blur. */
export const DASHBOARD_MIN_TEXT_GLASS_OPACITY = floorFor(DASHBOARD_SKY.cloud, [
  { text: TEXT_PRIMARY_HEX, target: TEXT_PRIMARY_TARGET },
  { text: TEXT_SECONDARY_HEX, target: TEXT_SECONDARY_TARGET },
]);

/** Minimum city HUD glass opacity for `textHex` at 4.5:1 over the brightest scene pixel. */
export function CITY_MIN_GLASS_OPACITY_FOR(
  textHex: string,
  brightestSceneHex: string,
): number {
  return floorFor(brightestSceneHex, [
    { text: textHex, target: TEXT_SECONDARY_TARGET },
  ]);
}
