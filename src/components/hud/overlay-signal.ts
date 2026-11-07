// Between the BriefMint Expand overlay (hud) and the city scene (this fix pass's stacking
// contract): while the overlay is open the scene and its labels become inert, focus is trapped
// in the dialog, and the label layer stays below --z-scrim. No component props cross pages.
export const CITY_OVERLAY_EVENT = "city-overlay";

export interface CityOverlayDetail {
  open: boolean;
}

export function dispatchCityOverlay(open: boolean): void {
  window.dispatchEvent(new CustomEvent<CityOverlayDetail>(CITY_OVERLAY_EVENT, { detail: { open } }));
}

export function onCityOverlay(handler: (detail: CityOverlayDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<CityOverlayDetail>).detail ?? { open: false });
  window.addEventListener(CITY_OVERLAY_EVENT, listener);
  return () => window.removeEventListener(CITY_OVERLAY_EVENT, listener);
}
