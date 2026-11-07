// BriefMint UI helpers: presentation-only. Canonical validation, projection
// and hashing live in ./briefs.ts; import those directly. Nothing here is a
// second DTO or a parallel contract.
import { BRIEF_LIMITS } from "./briefs";
import type { OpportunityFilters, OpportunityView } from "./briefmint";

export const MAX_BRIEF_WORDS = BRIEF_LIMITS.maxWords;
export const MAX_BRIEF_CHARS = BRIEF_LIMITS.maxChars;
export const MAX_BRIEF_SEGMENTS = BRIEF_LIMITS.maxParagraphs;
/** Canonical publicParametersSchema title bound. */
export const MAX_TITLE_CHARS = 120;
/** Canonical publicParametersSchema summary bound. */
export const MAX_SUMMARY_CHARS = 1000;

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function splitBriefSegments(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BRIEF_SEGMENTS);
}

export function briefSegmentIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `seg_${String(i + 1).padStart(3, "0")}`);
}

export function categoryLabel(c: "writing" | "design"): string {
  return c === "writing" ? "Writing" : "Design";
}

/** Client-side text search after the indexed Arkiv fetch; never invents records. */
export function filterOpportunities(list: OpportunityView[], f: OpportunityFilters): OpportunityView[] {
  return list.filter((o) => {
    if (f.category && f.category !== "all" && o.category !== f.category) return false;
    if (f.status && f.status !== "all" && o.status !== f.status) return false;
    if (f.budget === "with" && o.budgetUsdCents === null) return false;
    if (f.budget === "without" && o.budgetUsdCents !== null) return false;
    if (f.query && f.query.trim()) {
      const q = f.query.trim().toLowerCase();
      if (!`${o.title}\n${o.summary}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
