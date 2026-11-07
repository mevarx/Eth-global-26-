// BriefMint UI adapter: canonical DTOs live in ./briefs.ts (frozen v1.2,
// owned by the backend/integrator). This module NEVER redefines them: it
// re-exports canonical types and adds only browser-view projections plus
// tiny address aliases for component convenience.
import type {
  BriefView,
  OpportunityRecord,
} from "./briefs";

export type {
  BriefApiName,
  BriefApiRequest,
  BriefApiResponse,
  BriefCandidate,
  BriefSummary,
  BriefView,
  BriefmintConfig,
  ModelResult,
  OpportunityRecord,
  PublicOpportunity,
  PublicationIntent,
} from "./briefs";
export {
  BRIEF_KIND,
  BRIEF_LIMITS,
  BRIEFMINT_CHAIN_ID,
  OPPORTUNITY_NAMESPACE,
  approvalSchema,
  assertBriefDeadline,
  briefApi,
  briefIdSchema,
  briefmintConfigSchema,
  canonicalPublicJson,
  hashPublicOpportunity,
  modelResultSchema,
  opportunityFilterSchema,
  opportunityRecordSchema,
  privateNotesSchema,
  projectPublicOpportunity,
  publicOpportunitySchema,
  publicParametersSchema,
  splitBriefNotes,
  validateBriefApproval,
  validateModelResult,
  validatePublicationApproval,
  validatePublicationIntent,
} from "./briefs";

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export type ExecutionStatus = BriefView["executionStatus"];
export type PublicationStatus = BriefView["publication"]["status"];
export type ReviewStatus = BriefView["review"]["status"];
export type BriefFreshness = BriefView["publication"]["freshness"];

/** Browser-view projection of a canonical OpportunityRecord for lists/boards. */
export interface OpportunityView {
  entityKey: Hex;
  ownerAddress: Address;
  title: string;
  summary: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  exclusions: string[];
  openQuestions: string[];
  category: "writing" | "design";
  language: "en";
  status: "open" | "closed";
  budgetUsdCents: number | null;
  contactUrl: string | null;
  deadline: string;
  revision: number;
  expiresAtBlock: string | null;
  observedAtBlock: string | null;
  observedAt: string;
  fetchedAt: string;
  freshness: BriefFreshness;
}

export function toOpportunityView(record: OpportunityRecord): OpportunityView {
  const p = record.payload;
  return {
    entityKey: record.entityKey as Hex,
    ownerAddress: record.ownerAddress as Address,
    title: p.title,
    summary: p.summary,
    deliverables: [...p.deliverables],
    acceptanceCriteria: [...p.acceptanceCriteria],
    exclusions: [...p.exclusions],
    openQuestions: [...p.openQuestions],
    category: p.category,
    language: p.language,
    status: p.status,
    budgetUsdCents: p.budgetUsdCents,
    contactUrl: p.contactUrl,
    deadline: p.deadline,
    revision: p.revision,
    expiresAtBlock: record.expiresAtBlock,
    observedAtBlock: record.observedAtBlock,
    observedAt: record.observedAt,
    fetchedAt: record.observedAt,
    freshness: "fresh",
  };
}

export interface OpportunityFilters {
  category?: "writing" | "design" | "all";
  language?: "en" | "all";
  status?: "open" | "closed" | "all";
  budget?: "all" | "with" | "without";
  query?: string;
}
