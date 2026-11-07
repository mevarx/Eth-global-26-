"use client";

import { useSyncExternalStore } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { DASHBOARD_SKY } from "@/lib/ui/contrast";

const NARROW_QUERY = "(max-width: 699.98px)";

function subscribeNarrow(onChange: () => void) {
  const mql = window.matchMedia(NARROW_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getNarrow = () => window.matchMedia(NARROW_QUERY).matches;
const getNarrowServer = () => false;

/** Full-page cloud backdrop for dashboard routes only. Never mount it on the city route. */
export function DashboardBackdrop({ scrim = true }: { scrim?: boolean }) {
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer);
  const scrimAlpha = Math.min(0.2, Math.max(0, DASHBOARD_SKY.scrimAlpha));

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <CloudShader
        skyTopColor={DASHBOARD_SKY.top}
        skyBottomColor={DASHBOARD_SKY.bottom}
        cloudColor={DASHBOARD_SKY.cloud}
        speed={0.6}
        count={narrow ? 3 : 5}
        style={{ minHeight: 0 }}
      />
      {scrim && scrimAlpha > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgb(0 0 0 / ${scrimAlpha})`,
          }}
        />
      ) : null}
    </div>
  );
}

export default DashboardBackdrop;
