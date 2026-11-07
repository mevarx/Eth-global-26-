"use client";
// Per-viewer glass settings (reference GlassSettings, defaults and normalize), written as
// --gw-* CSS variables on the provider root. The "Adjust glass" popover keeps the reference
// controls; it is portalled to <body> with its own variable copy because glass ancestors
// (backdrop-filter) would trap a fixed popover and clip it inside a scrolling panel.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Layers, Settings2, X } from "lucide-react";
import {
  GLASS_DEFAULTS,
  glassCssVars,
  glassPresets,
  minOpacityForScope,
  normalizeGlass,
  parseStoredGlass,
  type GlassPreset,
  type GlassScope,
  type GlassSettings,
} from "./briefmint-panel-data";

export type { GlassScope, GlassSettings };
export const GLASS_STORAGE_KEY = "briefmint.glass.v1";

export interface GlassContextValue {
  settings: GlassSettings;
  update: (patch: Partial<GlassSettings>) => void;
  reset: () => void;
  applyPreset: (name: GlassPreset["name"]) => void;
  /** Lowest opacity the sliders and presets allow in this scope (text stays readable). */
  minOpacity: number;
  scope: GlassScope;
}

const FALLBACK_MIN = minOpacityForScope("city");
const FALLBACK: GlassContextValue = {
  settings: normalizeGlass(GLASS_DEFAULTS, FALLBACK_MIN),
  update: () => {},
  reset: () => {},
  applyPreset: () => {},
  minOpacity: FALLBACK_MIN,
  scope: "city",
};
const GlassContext = createContext<GlassContextValue>(FALLBACK);

export function useGlass(): GlassContextValue {
  return useContext(GlassContext);
}

// Module-level store so every provider (and tab) sees the same viewer settings. `memory` keeps
// them for this visit when storage is blocked; undefined means "ask storage".
const listeners = new Set<() => void>();
let memory: string | null | undefined;

function getRaw(): string | null {
  if (memory !== undefined) return memory;
  try {
    return window.localStorage.getItem(GLASS_STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeRaw(raw: string | null) {
  memory = raw;
  try {
    if (raw === null) window.localStorage.removeItem(GLASS_STORAGE_KEY);
    else window.localStorage.setItem(GLASS_STORAGE_KEY, raw);
  } catch {
    /* storage blocked: settings still apply for this visit */
  }
  listeners.forEach((l) => l());
}
function subscribeRaw(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== GLASS_STORAGE_KEY) return;
    memory = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
const getServerRaw = (): string | null => null;

interface GlassProviderProps {
  children: ReactNode;
  scope: GlassScope;
  as?: "div" | "section" | "main" | "aside";
  className?: string;
  style?: CSSProperties;
}

export function GlassProvider({ children, scope, as = "div", className, style }: GlassProviderProps) {
  const Root: ElementType = as;
  const minOpacity = minOpacityForScope(scope);
  // Server and first client render use defaults (no hydration mismatch); stored settings apply right after.
  const raw = useSyncExternalStore(subscribeRaw, getRaw, getServerRaw);
  const stored = useMemo(() => parseStoredGlass(raw), [raw]);
  const settings = useMemo(() => normalizeGlass(stored, minOpacity), [stored, minOpacity]);

  const update = useCallback(
    (patch: Partial<GlassSettings>) => writeRaw(JSON.stringify(normalizeGlass({ ...settings, ...patch }, minOpacity))),
    [settings, minOpacity],
  );
  const reset = useCallback(() => writeRaw(null), []);
  const applyPreset = useCallback(
    (name: GlassPreset["name"]) => {
      const preset = glassPresets(minOpacity).find((p) => p.name === name);
      if (preset) update(preset.value);
    },
    [minOpacity, update],
  );

  const value = useMemo<GlassContextValue>(
    () => ({ settings, update, reset, applyPreset, minOpacity, scope }),
    [settings, update, reset, applyPreset, minOpacity, scope],
  );

  return (
    <GlassContext.Provider value={value}>
      <Root className={className} data-glass-scope={scope} style={{ ...glassCssVars(settings), ...style }}>
        {children}
      </Root>
    </GlassContext.Provider>
  );
}

/* --------------------------------------------------------- Adjust glass */

const POPOVER_STYLES = `
aside.bmg-pop {
  position: fixed;
  z-index: 90;
  width: min(320px, calc(100vw - 16px));
  overflow: auto;
  scrollbar-width: thin;
  padding: var(--bm-space-4);
  border-radius: var(--bm-radius-lg);
  background-image: linear-gradient(color-mix(in srgb, var(--bm-bg-1) 55%, transparent), color-mix(in srgb, var(--bm-bg-1) 55%, transparent));
  color: var(--bm-text-primary);
  font: 400 var(--bm-text-sm)/var(--bm-leading) var(--bm-font-body);
  pointer-events: auto;
}
.bmg-pop *, .bmg-pop *::before, .bmg-pop *::after { box-sizing: border-box; }
.bmg-pop-title { display: flex; align-items: center; justify-content: space-between; gap: var(--bm-space-2); }
.bmg-pop-title > div { display: flex; align-items: center; gap: var(--bm-space-2); }
.bmg-pop h2 { margin: 0; font: 600 var(--bm-text-lg)/1.3 var(--bm-font-heading); }
.bmg-pop > p { margin: var(--bm-space-2) 0 var(--bm-space-3); }
.bmg-pop button { font: inherit; color: inherit; cursor: pointer; }
.bmg-pop-close {
  display: grid; place-items: center; width: var(--bm-touch); height: var(--bm-touch);
  border: 0; border-radius: var(--bm-radius-sm); background: none;
}
.bmg-pop-close:hover, .bmg-pop-presets button:hover, .bmg-pop-reset:hover {
  background: color-mix(in srgb, var(--bm-text-primary) 10%, transparent);
}
.bmg-pop-sample {
  display: flex; align-items: center; justify-content: center; gap: var(--bm-space-3);
  height: 80px; margin-bottom: var(--bm-space-3); border-radius: var(--bm-radius-md);
  background: color-mix(in srgb, var(--gw-tint) calc(var(--gw-opacity) * 100%), transparent);
  backdrop-filter: blur(var(--gw-blur));
  -webkit-backdrop-filter: blur(var(--gw-blur));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bm-text-primary) calc(var(--gw-edge) * 100%), transparent);
  font-size: var(--bm-text-xs);
}
.bmg-pop-presets { display: flex; gap: var(--bm-space-2); margin-bottom: var(--bm-space-3); }
.bmg-pop-presets button, .bmg-pop-reset {
  min-height: var(--bm-touch); border: 1px solid var(--bm-line-strong); border-radius: var(--bm-radius-sm);
  background: none; font-size: var(--bm-text-sm); font-weight: 600;
}
.bmg-pop-presets button { flex: 1; }
.bmg-pop-range { display: block; margin: var(--bm-space-3) 0; }
.bmg-pop-range > span { display: flex; justify-content: space-between; font-size: var(--bm-text-sm); }
.bmg-pop-range output { font-size: var(--bm-text-xs); font-family: var(--bm-font-mono); }
.bmg-pop-range input { width: 100%; height: 20px; margin: var(--bm-space-2) 0 0; accent-color: var(--bm-accent); cursor: pointer; }
.bmg-pop-tint { display: flex; align-items: center; justify-content: space-between; margin-top: var(--bm-space-3); font-size: var(--bm-text-sm); }
.bmg-pop-tint input {
  width: 48px; height: 32px; padding: 2px; background: none; cursor: pointer;
  border: 1px solid var(--bm-line-strong); border-radius: var(--bm-radius-sm);
}
.bmg-pop-reset { width: 100%; margin-top: var(--bm-space-4); }
.bmg-pop :focus-visible { outline: var(--bm-focus-ring); outline-offset: var(--bm-focus-offset); }
`;

interface PopoverPosition {
  top: number;
  right: number;
  maxHeight: number;
}

export function AdjustGlassControl({ className = "" }: { className?: string }) {
  const { settings, update, reset, applyPreset, minOpacity, scope } = useGlass();
  const id = useId().replace(/:/g, "");
  const popId = `${id}-material`;
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const open = pos !== null;

  const place = useCallback((): PopoverPosition | null => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return null;
    const top = Math.max(8, rect.bottom + 8);
    return {
      top,
      right: Math.max(8, window.innerWidth - rect.right),
      maxHeight: Math.max(240, window.innerHeight - top - 12),
    };
  }, []);

  const close = useCallback((refocus: boolean) => {
    setPos(null);
    if (refocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const reposition = () => setPos((p) => (p ? (place() ?? p) : p));
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !trigger.current?.contains(t)) setPos(null);
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, place]);

  const onEscape = (e: ReactKeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation(); // do not also close an enclosing overlay
    close(true);
  };

  const sliders = [
    { key: "blur", label: "Blur", min: 0, max: 40, step: 1, value: `${Math.round(settings.blur)} px` },
    { key: "opacity", label: "Opacity", min: minOpacity, max: 0.9, step: 0.01, value: `${Math.round(settings.opacity * 100)}%` },
    { key: "saturation", label: "Saturation", min: 0.5, max: 2, step: 0.05, value: `${Math.round(settings.saturation * 100)}%` },
    { key: "edge", label: "Edge light", min: 0, max: 1, step: 0.05, value: `${Math.round(settings.edge * 100)}%` },
  ] as const;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`bm-btn bm-btn--ghost ${className}`.trim()}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setPos(open ? null : place())}
        onKeyDown={onEscape}
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>Adjust glass</span>
      </button>
      {pos &&
        createPortal(
          <aside
            ref={pop}
            id={popId}
            className="bmg-pop bm-glass bm-glass--text"
            data-glass-scope={scope}
            aria-label="Glass appearance"
            style={{ ...glassCssVars(settings), top: pos.top, right: pos.right, maxHeight: pos.maxHeight }}
            onKeyDown={onEscape}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <style>{POPOVER_STYLES}</style>
            <div className="bmg-pop-title">
              <div>
                <Settings2 size={18} aria-hidden="true" />
                <h2>Glass appearance</h2>
              </div>
              <button type="button" className="bmg-pop-close" aria-label="Close glass settings" onClick={() => close(true)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>Adjust the material across the city HUD.</p>
            <div className="bmg-pop-sample" aria-hidden="true">
              <Layers size={28} strokeWidth={1.1} />
              <span>Live material preview</span>
            </div>
            <div className="bmg-pop-presets" role="group" aria-label="Glass presets">
              {glassPresets(minOpacity).map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p.name)}>
                  {p.name}
                </button>
              ))}
            </div>
            {sliders.map((c) => (
              <label className="bmg-pop-range" key={c.key}>
                <span>
                  {c.label}
                  <output>{c.value}</output>
                </span>
                <input
                  type="range"
                  aria-label={c.label}
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={settings[c.key]}
                  onChange={(e) => update({ [c.key]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label className="bmg-pop-tint">
              Glass tint
              <input type="color" value={settings.tint} onChange={(e) => update({ tint: e.target.value })} />
            </label>
            <button type="button" className="bmg-pop-reset" onClick={reset}>
              Reset appearance
            </button>
          </aside>,
          document.body,
        )}
    </>
  );
}
