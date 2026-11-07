// Explainer content for the presentation-only landmarks. Pure data: no React, no state, no
// live values. Wording is scoped to what the integration contract and 0G/Arkiv notes support.
import type { LandmarkKind } from "./slots";
import type { BuildingId } from "./scene-config";

export type ExplainerId = "private-compute" | "native-expiry" | "boundary" | "how-it-works";

export interface ExplainerStep {
  building: BuildingId;
  name: string;
  text: string;
}

export interface Explainer {
  id: ExplainerId;
  landmark: LandmarkKind;
  title: string;
  tag: "EXPLAINER";
  whatItIs: string;
  whyWeUseIt: string;
  doesNotProve: string[];
  whereYouSeeIt: string;
  steps?: ExplainerStep[];
  reminder?: string;
}

export const EXPLAINER_IDS: readonly ExplainerId[] = ["private-compute", "native-expiry", "boundary", "how-it-works"];

export const EXPLAINERS: Record<ExplainerId, Explainer> = {
  "private-compute": {
    id: "private-compute",
    landmark: "lighthouse",
    title: "Private compute (0G)",
    tag: "EXPLAINER",
    whatItIs:
      "Your notes are compiled by a model through 0G Private Computer in explicit private mode, with automatic non-private fallbacks disabled.",
    whyWeUseIt:
      "Unpublished notes can contain sensitive details. Private routing plus recorded request evidence reduces how much you must trust the processing step.",
    doesNotProve: [
      "That the output is correct or well redacted.",
      "That the BriefMint backend does not see your notes. It does.",
      "That a Router-reported flag is independent verification. It is not.",
    ],
    whereYouSeeIt: "AI Studio, and the evidence panel on a compiled brief.",
  },
  "native-expiry": {
    id: "native-expiry",
    landmark: "clock-tower",
    title: "Native expiry (Arkiv)",
    tag: "EXPLAINER",
    whatItIs:
      "Each published opportunity is an Arkiv record owned by your wallet, indexed for queries. It expires on-chain after a block-based lifetime.",
    whyWeUseIt:
      "Other apps can discover and read opportunities without our database, you control updates and closing, and stale listings disappear on their own.",
    doesNotProve: [
      "The displayed deadline is a business timestamp, and wall-clock expiry is approximate.",
      "Closing a record is not expiry.",
      "Expiry does not erase copies others already made.",
    ],
    whereYouSeeIt: "Registry Hall, the Opportunities tab and the independent reader.",
  },
  boundary: {
    id: "boundary",
    landmark: "gatehouse",
    title: "Private vs public boundary",
    tag: "EXPLAINER",
    whatItIs:
      "Private notes, model output, evidence and your session stay in the BriefMint backend. Only fields you approve become public.",
    whyWeUseIt:
      "Approval is bound to the exact revision and a canonical public payload, so later edits cannot silently publish.",
    doesNotProve: [
      "That a leak can be undone once something is public.",
      "That stored private data is encrypted at the application level in this MVP.",
    ],
    whereYouSeeIt: "Release Desk (approval) and Registry Hall (publication).",
  },
  "how-it-works": {
    id: "how-it-works",
    landmark: "notice-board",
    title: "How BriefMint works",
    tag: "EXPLAINER",
    whatItIs: "Five steps, each mapped to a building in the city.",
    // Only claims the owner supplied for the other explainers; no new product claims.
    whyWeUseIt:
      "Approval is bound to the exact revision and a canonical public payload, so later edits cannot silently publish.",
    doesNotProve: [
      "That the compiled output is correct or well redacted.",
      "That stored private data is encrypted at the application level in this MVP.",
    ],
    whereYouSeeIt: "Planning Desk, AI Studio, Release Desk, Registry Hall and Archive.",
    steps: [
      { building: "home", name: "Planning Desk", text: "Write private notes and set the public parameters." },
      { building: "studio", name: "AI Studio", text: "Compile the notes privately into a brief." },
      { building: "treasury", name: "Release Desk", text: "Review and approve the exact public revision." },
      { building: "registry", name: "Registry Hall", text: "Sign and publish to Arkiv, then update or close." },
      { building: "archive", name: "Archive", text: "Reopen your private briefs." },
    ],
    reminder:
      "Compilation uses promotional credits. Advertised budgets are unfunded, and BriefMint never holds or moves funds.",
  },
};

export function explainerForLandmark(kind: LandmarkKind): Explainer {
  const found = EXPLAINER_IDS.map((id) => EXPLAINERS[id]).find((e) => e.landmark === kind);
  if (!found) throw new Error(`No explainer for landmark ${kind}`);
  return found;
}
