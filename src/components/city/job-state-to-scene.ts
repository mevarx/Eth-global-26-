// Pure mapper from persisted job state to city scene targets.
// Never performs network I/O, never sets server status, has no timers.
// Local draft/review UI states are distinct from the persisted job status.
import type { JobView } from "@/lib/shared/domain";
import type { BuildingId } from "./scene-config";
import { BUILDING_BY_ID, PLAZA } from "./scene-config";

export interface SceneTarget {
  /** Building the worker stands at, or null when idle at the plaza. */
  building: BuildingId | null;
  x: number;
  y: number;
  /** Saved parcel waiting at Creator's Home (ready jobs). */
  parcel: boolean;
  /** Paid job stuck and visibly unresolved. */
  unresolved: boolean;
  note: string;
}

export function jobStateToScene(job: JobView | null): SceneTarget {
  if (!job) {
    return {
      building: null,
      x: PLAZA.x,
      y: PLAZA.y,
      parcel: false,
      unresolved: false,
      note: "No active job. Prepare a draft at the Creator's Home.",
    };
  }
  const at = (id: BuildingId) => ({ x: BUILDING_BY_ID[id].waypoint.x, y: BUILDING_BY_ID[id].waypoint.y });
  switch (job.status) {
    case "awaiting_payment":
      return {
        building: "treasury",
        ...at("treasury"),
        parcel: false,
        unresolved: false,
        note: "Job awaiting payment, the worker waits at the Treasury.",
      };
    case "payment_pending":
      return {
        building: "treasury",
        ...at("treasury"),
        parcel: false,
        unresolved: false,
        note: "Payment submitted, verification pending, the worker waits at the Treasury.",
      };
    case "paid":
    case "running":
      return {
        building: "studio",
        ...at("studio"),
        parcel: false,
        unresolved: false,
        note: "Job paid, the worker carries the document at the Translation Studio.",
      };
    case "ready":
      return {
        building: "home",
        ...at("home"),
        parcel: true,
        unresolved: false,
        note: "Translation ready, a saved parcel waits at the Creator's Home.",
      };
    case "interrupted":
    case "failed":
      return {
        building: "studio",
        ...at("studio"),
        parcel: false,
        unresolved: true,
        note: "Paid job visibly unresolved at the Translation Studio, check retry eligibility.",
      };
    default:
      return {
        building: "studio",
        ...at("studio"),
        parcel: false,
        unresolved: true,
        note: "Unknown job status, check the saved job at the Translation Studio.",
      };
  }
}
