/** Reserve only the part of the map actually covered by the workbench. */
type ViewRect = { left: number; right: number; top: number; bottom: number };
export function workbenchInset(viewport: ViewRect, panel: ViewRect | null): number {
  if (!panel || panel.top >= viewport.bottom || panel.bottom <= viewport.top
    || panel.left >= viewport.right || panel.right <= viewport.left) return 0;
  return Math.min(Math.max(0, viewport.right - viewport.left - 240), Math.max(0, viewport.right - panel.left + 16));
}
