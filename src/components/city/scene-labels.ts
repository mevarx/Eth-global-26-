// Pure label helpers shared by the SVG fallback and the Pixi engine.
import type { CityState } from "./city-state";
import type { BuildingId } from "./scene-config";

export interface BuildingTag {
  text: string;
  tone: "info" | "ok" | "warn" | "muted";
}

export function tagFor(id: BuildingId, city: CityState, fixture: boolean): BuildingTag | null {
  const tag = baseTag(id, city, fixture);
  // Fixture previews never get success colouring.
  return tag && fixture && tag.tone === "ok" ? { ...tag, tone: "muted" } : tag;
}

function baseTag(id: BuildingId, city: CityState, fixture: boolean): BuildingTag | null {
  if (id === "studio") {
    if (city.studio === "running") return { text: "compiling…", tone: "info" };
    if (city.studio === "failed") return { text: "⚠ failed, unresolved", tone: "warn" };
    if (city.studio === "interrupted") return { text: "⚠ interrupted, unresolved", tone: "warn" };
  }
  if (id === "treasury") {
    if (city.release === "awaiting") return { text: "awaiting review", tone: "info" };
    if (city.release === "approved") return { text: "✓ approved", tone: "ok" };
  }
  if (id === "registry") {
    switch (city.registry) {
      case "pending":
        return { text: "waiting for confirmation", tone: "info" };
      case "live":
        // Fixture state never carries a live-looking label.
        return fixture ? { text: "fixture, not published", tone: "muted" } : { text: "live on Arkiv", tone: "ok" };
      case "closed":
        return { text: "closed", tone: "muted" };
      case "expired":
        return { text: "expired (confirmed)", tone: "muted" };
      case "stale":
        return { text: "stale read, not expired", tone: "warn" };
      case "unavailable":
        return { text: "read unavailable", tone: "warn" };
    }
  }
  return null;
}

export function stateLabelFor(id: BuildingId, city: CityState): string | undefined {
  if (id === "home") return city.planning.lit ? "draft saved" : undefined;
  if (id === "studio") return city.studio === "idle" ? undefined : city.studio;
  if (id === "treasury") {
    if (city.release === "idle") return undefined;
    return city.release === "awaiting" ? "awaiting review" : "current revision approved";
  }
  if (id === "registry") return city.registry === "none" ? undefined : city.registry;
  if (id === "archive") return city.archive.boxes ? "private brief saved" : undefined;
  return undefined;
}
