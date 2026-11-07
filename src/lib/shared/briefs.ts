import { z } from "zod";

/** BriefMint v1. Browser-safe; no environment, server, wallet or SDK imports. */
export const BRIEF_KIND = "brief.compile.v1" as const;
export const OPPORTUNITY_NAMESPACE = "tool-city.opportunity.v1" as const;
export const BRIEFMINT_CHAIN_ID = 7794095 as const;
export const BRIEF_LIMITS = {
  maxWords: 250, maxChars: 5000, maxParagraphs: 20,
  maxSectionItems: 12, maxItemChars: 500, maxPublicBytes: 16000,
  maxRequestBytes: 32000, maxDeadlineDays: 7,
} as const;

const text = (max: number) => z.string().min(1).max(max).refine(v => v === v.trim(), "Trim text before submitting");
export const briefIdSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
export const publicHashSchema = briefIdSchema;
export const walletAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const utcSchema = z.iso.datetime({ precision: 3 });
export const revisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const uint = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const blockSchema = z.string().regex(/^(0|[1-9][0-9]*)$/).max(78);
const sourceIdSchema = z.string().regex(/^seg_\d{3}$/);
const contactSchema = z.url().max(2048).refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Public contact must be HTTPS without embedded credentials");

export const publicParametersSchema = z.strictObject({
  title: text(120), summary: text(1000), category: z.enum(["writing", "design"]),
  language: z.literal("en"), budgetUsdCents: uint.nullable(),
  deadline: utcSchema, contactUrl: contactSchema.nullable(),
});
export const briefSectionsSchema = z.strictObject({
  deliverables: z.array(text(500)).min(1).max(12),
  acceptanceCriteria: z.array(text(500)).min(1).max(12),
  exclusions: z.array(text(500)).max(12), openQuestions: z.array(text(500)).max(12),
});
export const briefCandidateSchema = z.strictObject({
  parameters: publicParametersSchema, sections: briefSectionsSchema,
  status: z.enum(["open", "closed"]),
});
export const sourceSegmentSchema = z.strictObject({ id: sourceIdSchema, text: text(5000) });
export const modelItemSchema = z.strictObject({
  text: text(500), sourceIds: z.array(sourceIdSchema).max(20),
  basis: z.enum(["provided", "suggested"]),
}).superRefine((item, ctx) => {
  if (new Set(item.sourceIds).size !== item.sourceIds.length || (item.basis === "provided" && !item.sourceIds.length)) {
    ctx.addIssue({ code: "custom", message: "Provided statements need unique source references" });
  }
});
export const modelResultSchema = z.strictObject({
  deliverables: z.array(modelItemSchema).min(1).max(12),
  acceptanceCriteria: z.array(modelItemSchema).min(1).max(12),
  exclusions: z.array(modelItemSchema).max(12), openQuestions: z.array(modelItemSchema).max(12),
});
export function validateModelResult(value: unknown, source: readonly SourceSegment[]) {
  const result = modelResultSchema.parse(value);
  const known = new Set(source.map(s => s.id));
  for (const items of Object.values(result)) for (const item of items) {
    if (item.sourceIds.some(id => !known.has(id))) throw new Error("Unknown model source reference");
  }
  return result;
}

export const privateNotesSchema = text(5000).superRefine((value, ctx) => {
  if (value.split(/\s+/u).length > 250 || value.split(/\r?\n\s*\r?\n/u).filter(p => p.trim()).length > 20) {
    ctx.addIssue({ code: "custom", message: "Notes exceed 250 words or 20 paragraphs" });
  }
});
export function splitBriefNotes(value: unknown): SourceSegment[] {
  return privateNotesSchema.parse(value).split(/\r?\n\s*\r?\n/u).map(p => p.trim()).filter(Boolean)
    .map((paragraph, i) => ({ id: `seg_${String(i + 1).padStart(3, "0")}`, text: paragraph }));
}
/** Call on create, save, approve and prepare, not historical reads or reconciliation. */
export function assertBriefDeadline(deadline: string, nowMs: number): void {
  const time = Date.parse(utcSchema.parse(deadline));
  if (!Number.isFinite(nowMs) || time <= nowMs || time > nowMs + 7 * 86400000) throw new Error("Deadline must be within the next seven days");
}

export const publicOpportunitySchema = z.strictObject({
  schemaVersion: z.literal(1), namespace: z.literal(OPPORTUNITY_NAMESPACE),
  revision: revisionSchema, ...publicParametersSchema.shape,
  ...briefSectionsSchema.shape, status: z.enum(["open", "closed"]),
}).superRefine((value, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(value)).length > BRIEF_LIMITS.maxPublicBytes) {
    ctx.addIssue({ code: "custom", message: "Public payload exceeds 16000 UTF-8 bytes" });
  }
});

/** Explicit projection, never spread a private record or model result into this payload. */
export function projectPublicOpportunity(candidate: BriefCandidate, revision: number): PublicOpportunity {
  const { parameters: p, sections: s, status } = briefCandidateSchema.parse(candidate);
  return publicOpportunitySchema.parse({
    schemaVersion: 1, namespace: OPPORTUNITY_NAMESPACE, revision,
    title: p.title, summary: p.summary, category: p.category, language: p.language,
    budgetUsdCents: p.budgetUsdCents, deadline: p.deadline, contactUrl: p.contactUrl,
    deliverables: s.deliverables, acceptanceCriteria: s.acceptanceCriteria,
    exclusions: s.exclusions, openQuestions: s.openQuestions, status,
  });
}
/** v1 canonical JSON: recursively sort object keys; preserve arrays and exact strings.
 * No Unicode normalization, floats, undefined or optional keys in the public schema. */
export function canonicalPublicJson(value: PublicOpportunity): string {
  const sorted = (item: unknown): unknown => Array.isArray(item) ? item.map(sorted)
    : item !== null && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, sorted(v)]))
      : item;
  return JSON.stringify(sorted(publicOpportunitySchema.parse(value)));
}
/** SHA-256 of UTF-8 canonical JSON, lowercase 0x-prefixed digest; Web Crypto in both runtimes. */
export async function hashPublicOpportunity(value: PublicOpportunity): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPublicJson(value)));
  return `0x${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")}`;
}

export class BriefContractConflict extends Error {
  constructor(public readonly code: "REVISION_CONFLICT" | "BRIEF_NOT_READY" | "APPROVAL_REQUIRED" | "PAYLOAD_MISMATCH") {
    super(code);
  }
}
/** Server must call inside its concurrency protocol and recheck revision before committing. */
export async function validateBriefApproval(
  brief: Pick<BriefView, "executionStatus" | "editedDraft" | "draftRevision">,
  expectedRevision: number, expectedHash: string,
): Promise<PublicOpportunity> {
  revisionSchema.parse(expectedRevision); publicHashSchema.parse(expectedHash);
  if (brief.draftRevision !== expectedRevision) throw new BriefContractConflict("REVISION_CONFLICT");
  if (brief.executionStatus !== "ready" || !brief.editedDraft) throw new BriefContractConflict("BRIEF_NOT_READY");
  const payload = projectPublicOpportunity(brief.editedDraft, brief.draftRevision);
  if (await hashPublicOpportunity(payload) !== expectedHash) throw new BriefContractConflict("PAYLOAD_MISMATCH");
  return payload;
}
export async function validatePublicationApproval(brief: BriefView, expectedRevision: number, expectedHash: string) {
  const payload = await validateBriefApproval(brief, expectedRevision, expectedHash);
  const approval = brief.review.approval;
  if (brief.review.status !== "approved" || !approval || approval.draftRevision !== expectedRevision
    || approval.publicPayloadHash !== expectedHash || approval.approvedBy.toLowerCase() !== brief.ownerAddress.toLowerCase()
    || canonicalPublicJson(approval.canonicalPublicPayload) !== canonicalPublicJson(payload)) {
    throw new BriefContractConflict("APPROVAL_REQUIRED");
  }
  return payload;
}

export const executionStatusSchema = z.enum(["draft", "running", "ready", "failed", "interrupted"]);
export const freshnessSchema = z.enum(["fresh", "stale", "unavailable"]);
export const briefErrorSchema = z.strictObject({ code: text(80), message: text(300), retryable: z.boolean() });
export const inferenceEvidenceSchema = z.strictObject({
  requestId: text(256).nullable(), modelId: text(256).nullable(), providerId: text(256).nullable(),
  routingTier: text(80).nullable(), privateRoutingRequested: z.literal(true), fallbacksAllowed: z.literal(false),
  verificationRequested: z.literal(true), routerVerification: z.boolean().nullable(),
  independentResponseVerification: z.enum(["verified", "failed", "unavailable"]),
  responseReference: text(256).nullable(), checkedAt: utcSchema.nullable(), sanitizedFailureReason: text(300).nullable(),
});
export const approvalSchema = z.strictObject({
  draftRevision: revisionSchema, publicPayloadHash: publicHashSchema,
  canonicalPublicPayload: publicOpportunitySchema,
  approvedBy: walletAddressSchema, approvedAt: utcSchema,
});
export const reviewSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unreviewed"), approval: z.null() }),
  z.strictObject({ status: z.literal("approved"), approval: approvalSchema }),
]);
export const confirmedPublicationSchema = z.strictObject({
  entityKey: briefIdSchema, ownerAddress: walletAddressSchema, publicRevision: revisionSchema,
  observedPayloadHash: publicHashSchema, lastConfirmedTransaction: briefIdSchema,
  expiresAtBlock: blockSchema, observedAt: utcSchema, observedAtBlock: blockSchema,
  status: z.enum(["live", "closed", "expired"]), externalChange: z.boolean(),
});
export const publicationIntentSchema = z.strictObject({
  intentId: briefIdSchema, operation: z.enum(["create", "update", "close"]),
  chainId: z.literal(BRIEFMINT_CHAIN_ID), ownerAddress: walletAddressSchema,
  entityKey: briefIdSchema.nullable(), basePayloadHash: publicHashSchema.nullable(),
  payload: publicOpportunitySchema, publicPayloadHash: publicHashSchema,
  expiresAtBlock: blockSchema, createdAt: utcSchema,
}).superRefine((intent, ctx) => {
  if ((intent.operation === "create") !== (intent.entityKey === null && intent.basePayloadHash === null)
    || (intent.operation !== "create" && (!intent.entityKey || !intent.basePayloadHash))
    || (intent.operation === "close") !== (intent.payload.status === "closed")) {
    ctx.addIssue({ code: "custom", message: "Publication operation and target do not agree" });
  }
});
/** Mandatory before a browser write and when accepting a persisted intent for reconciliation. */
export async function validatePublicationIntent(value: unknown): Promise<PublicationIntent> {
  const intent = publicationIntentSchema.parse(value);
  if (await hashPublicOpportunity(intent.payload) !== intent.publicPayloadHash) throw new BriefContractConflict("PAYLOAD_MISMATCH");
  return intent;
}
export const pendingPublicationSchema = z.strictObject({
  intent: publicationIntentSchema, transactionHash: briefIdSchema.nullable(),
  /** Missing historical state is uncertain, never permission to sign again. */
  state: z.enum(["prepared", "unknown", "submitted", "reverted"]).default("unknown"),
}).superRefine((pending, ctx) => {
  if ((pending.state === "prepared" && pending.transactionHash !== null)
    || (["submitted", "reverted"].includes(pending.state) && pending.transactionHash === null)) {
    ctx.addIssue({ code: "custom", message: "Pending outcome and transaction evidence do not agree" });
  }
});
export const publicationSchema = z.strictObject({
  status: z.enum(["unpublished", "pending", "live", "closed", "expired"]),
  freshness: freshnessSchema, confirmed: confirmedPublicationSchema.nullable(),
  pending: pendingPublicationSchema.nullable(),
}).superRefine((value, ctx) => {
  if ((value.status === "pending") !== (value.pending !== null)
    || (value.status === "unpublished" && value.confirmed !== null)
    || (!["unpublished", "pending"].includes(value.status) && value.confirmed?.status !== value.status)) {
    ctx.addIssue({ code: "custom", message: "Publication state lacks matching evidence" });
  }
  if (value.pending) {
    const intent = value.pending.intent;
    if ((intent.operation === "create" && value.confirmed !== null)
      || (intent.operation !== "create" && (!value.confirmed || value.confirmed.entityKey !== intent.entityKey
        || value.confirmed.ownerAddress.toLowerCase() !== intent.ownerAddress.toLowerCase()))) {
      ctx.addIssue({ code: "custom", message: "Pending intent does not target the known publication" });
    }
  }
});
export const briefViewSchema = z.strictObject({
  schemaVersion: z.literal(1), kind: z.literal(BRIEF_KIND), id: briefIdSchema, ownerAddress: walletAddressSchema,
  inputSegments: z.array(sourceSegmentSchema).min(1).max(20), publicParameters: publicParametersSchema,
  executionStatus: executionStatusSchema, attemptsUsed: z.number().int().min(0).max(2), retryEligible: z.boolean(),
  immutableModelResult: modelResultSchema.nullable(), editedDraft: briefCandidateSchema.nullable(),
  draftRevision: revisionSchema, evidence: inferenceEvidenceSchema.nullable(), error: briefErrorSchema.nullable(),
  review: reviewSchema, publication: publicationSchema, createdAt: utcSchema, updatedAt: utcSchema,
  /** Private provenance for an operator-created duplicate-risk demo copy; never projected publicly. */
  publicationCopy: z.strictObject({ sourceBriefId: briefIdSchema, sourceRevision: revisionSchema,
    sourceApprovalHash: publicHashSchema, duplicateRiskAcknowledged: z.literal(true) }).optional(),
}).superRefine((brief, ctx) => {
  if ((brief.executionStatus === "ready" && (!brief.immutableModelResult || !brief.editedDraft))
    || (brief.review.status === "approved" && (brief.executionStatus !== "ready"
      || brief.review.approval.draftRevision !== brief.draftRevision
      || brief.review.approval.canonicalPublicPayload.revision !== brief.draftRevision
      || brief.review.approval.approvedBy.toLowerCase() !== brief.ownerAddress.toLowerCase()))) {
    ctx.addIssue({ code: "custom", message: "Ready result or current owner approval is missing" });
  }
  if (new Set(brief.inputSegments.map(s => s.id)).size !== brief.inputSegments.length) {
    ctx.addIssue({ code: "custom", message: "Duplicate source IDs" });
  }
  if (brief.immutableModelResult) {
    try { validateModelResult(brief.immutableModelResult, brief.inputSegments); }
    catch { ctx.addIssue({ code: "custom", message: "Invalid model source references" }); }
  }
  if (brief.publication.pending && brief.publication.pending.intent.ownerAddress.toLowerCase() !== brief.ownerAddress.toLowerCase()) {
    ctx.addIssue({ code: "custom", message: "Intent owner differs from private owner" });
  }
});
export const briefSummarySchema = z.strictObject({
  id: briefIdSchema, title: text(120), category: z.enum(["writing", "design"]),
  executionStatus: executionStatusSchema, reviewStatus: z.enum(["unreviewed", "approved"]),
  publicationStatus: z.enum(["unpublished", "pending", "live", "closed", "expired"]),
  freshness: freshnessSchema, draftRevision: revisionSchema, createdAt: utcSchema, updatedAt: utcSchema,
});

const readinessSchema = z.strictObject({ available: z.boolean(), reason: text(300).nullable() });
export const briefmintConfigSchema = z.strictObject({
  schemaVersion: z.literal(1), kind: z.literal(BRIEF_KIND), namespace: z.literal(OPPORTUNITY_NAMESPACE),
  auth: z.strictObject({ chainId: z.literal(BRIEFMINT_CHAIN_ID), challengePurpose: z.literal("briefmint"), readiness: readinessSchema }),
  compilation: readinessSchema, arkiv: z.strictObject({ chainId: z.literal(BRIEFMINT_CHAIN_ID), readiness: readinessSchema }),
  limits: z.strictObject(Object.fromEntries(Object.entries(BRIEF_LIMITS).map(([k, v]) => [k, z.literal(v)])) as { [K in keyof typeof BRIEF_LIMITS]: z.ZodLiteral<(typeof BRIEF_LIMITS)[K]> }),
  quota: z.strictObject({ policy: z.literal("allowlisted-demo"), maxAttemptsPerBrief: z.literal(2),
    maxConcurrent: z.literal(1), compilationsPerWallet: uint.nullable(), globalDispatchLimit: uint.nullable(),
    windowEndsAt: utcSchema.nullable() }),
}).superRefine((config, ctx) => {
  if (config.compilation.available && (!config.auth.readiness.available
    || !config.quota.compilationsPerWallet || !config.quota.globalDispatchLimit || !config.quota.windowEndsAt)) {
    ctx.addIssue({ code: "custom", message: "Compilation requires auth and an explicit finite quota policy" });
  }
});
export const createBriefRequestSchema = z.strictObject({ notes: privateNotesSchema, publicParameters: publicParametersSchema });
/** Extension of existing auth challenge route; absent purpose remains legacy. A implements routing. */
export const briefmintAuthChallengeQuerySchema = z.strictObject({ address: walletAddressSchema, purpose: z.literal("briefmint") });
export const runBriefRequestSchema = z.strictObject({});
export const saveBriefDraftRequestSchema = z.strictObject({ expectedRevision: revisionSchema, draft: briefCandidateSchema });
export const approveBriefRequestSchema = z.strictObject({ expectedRevision: revisionSchema, publicPayloadHash: publicHashSchema });
export const preparePublicationRequestSchema = z.strictObject({
  intentId: briefIdSchema, expectedRevision: revisionSchema, publicPayloadHash: publicHashSchema,
  operation: z.enum(["create", "update", "close"]),
});
export const publicationCopyRequestSchema = z.strictObject({
  expectedRevision: revisionSchema, publicPayloadHash: publicHashSchema, acknowledgeDuplicateRisk: z.literal(true),
});
export const reconcilePublicationRequestSchema = z.strictObject({
  intentId: briefIdSchema, transactionHash: briefIdSchema.nullable(), entityKey: briefIdSchema.nullable(),
  /** Manually supplied hashes must pass receipt/readback verification before binding. */
  recovery: z.literal(true).optional(),
});
export const listBriefsQuerySchema = z.strictObject({ beforeId: briefIdSchema.optional() });
/** Omitted audience preserves the original owner-only private download. Public means current approved projection. */
export const exportBriefQuerySchema = z.strictObject({ format: z.enum(["txt", "json"]), audience: z.enum(["private", "public"]).optional() });
export const exportBriefResponseSchema = z.strictObject({
  filename: z.string().regex(/^(brief-0x[0-9a-f]{64}|brief-public-r[1-9][0-9]{0,15})\.(txt|json)$/),
  mediaType: z.enum(["text/plain", "application/json"]), content: z.string().max(200000),
});
export function briefApiResultSchema<S extends z.ZodType>(data: S) {
  return z.discriminatedUnion("ok", [z.strictObject({ ok: z.literal(true), data }), z.strictObject({ ok: z.literal(false), error: briefErrorSchema })]);
}
/** Request = JSON body, except GET query objects. The HTTP handlers implement this registry. */
export const briefApi = {
  config: { method: "GET", path: "/api/briefmint/config", request: runBriefRequestSchema, response: briefApiResultSchema(briefmintConfigSchema) },
  list: { method: "GET", path: "/api/briefs", request: listBriefsQuerySchema, response: briefApiResultSchema(z.strictObject({ briefs: z.array(briefSummarySchema).max(50), nextBeforeId: briefIdSchema.nullable() })) },
  create: { method: "POST", path: "/api/briefs", request: createBriefRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  get: { method: "GET", path: "/api/briefs/:id", request: runBriefRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  run: { method: "POST", path: "/api/briefs/:id/run", request: runBriefRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  saveDraft: { method: "PUT", path: "/api/briefs/:id/draft", request: saveBriefDraftRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  approve: { method: "POST", path: "/api/briefs/:id/approve", request: approveBriefRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  prepare: { method: "POST", path: "/api/briefs/:id/publication/prepare", request: preparePublicationRequestSchema, response: briefApiResultSchema(publicationIntentSchema) },
  publicationCopy: { method: "POST", path: "/api/briefs/:id/publication/copy", request: publicationCopyRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  reconcile: { method: "POST", path: "/api/briefs/:id/publication/reconcile", request: reconcilePublicationRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  refresh: { method: "POST", path: "/api/briefs/:id/publication/refresh", request: runBriefRequestSchema, response: briefApiResultSchema(briefViewSchema) },
  export: { method: "GET", path: "/api/briefs/:id/export", request: exportBriefQuerySchema, response: briefApiResultSchema(exportBriefResponseSchema) },
} as const;
export type BriefApiName = keyof typeof briefApi;
export type BriefApiRequest<K extends BriefApiName> = z.infer<(typeof briefApi)[K]["request"]>;
export type BriefApiResponse<K extends BriefApiName> = z.infer<(typeof briefApi)[K]["response"]>;
export type SourceSegment = z.infer<typeof sourceSegmentSchema>;
export type BriefCandidate = z.infer<typeof briefCandidateSchema>;
export type PublicOpportunity = z.infer<typeof publicOpportunitySchema>;
export type BriefView = z.infer<typeof briefViewSchema>;
export type BriefSummary = z.infer<typeof briefSummarySchema>;
export type BriefmintConfig = z.infer<typeof briefmintConfigSchema>;
export type PublicationIntent = z.infer<typeof publicationIntentSchema>;
export type ModelResult = z.infer<typeof modelResultSchema>;

/** B implements this neutral reader; A injects it into reconciliation. No SDK objects cross API JSON. */
export const opportunityRecordSchema = z.strictObject({
  entityKey: briefIdSchema, ownerAddress: walletAddressSchema, payload: publicOpportunitySchema,
  expiresAtBlock: blockSchema, observedAtBlock: blockSchema, observedAt: utcSchema,
});
export const opportunityFilterSchema = z.strictObject({
  category: z.enum(["writing", "design"]).optional(), language: z.literal("en"),
  status: z.enum(["open", "closed"]), minBudgetUsdCents: uint.optional(),
  deadlineAfter: utcSchema, limit: z.number().int().min(1).max(50), cursor: text(2048).optional(),
});
export type OpportunityRecord = z.infer<typeof opportunityRecordSchema>;
export const arkivTransactionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("pending"), chainId: z.literal(BRIEFMINT_CHAIN_ID), signer: z.null(), entityKeys: z.tuple([]), blockNumber: z.null() }),
  z.strictObject({ status: z.literal("reverted"), chainId: z.literal(BRIEFMINT_CHAIN_ID), signer: walletAddressSchema, entityKeys: z.tuple([]), blockNumber: blockSchema }),
  z.strictObject({ status: z.literal("confirmed"), chainId: z.literal(BRIEFMINT_CHAIN_ID), signer: walletAddressSchema, entityKeys: z.array(briefIdSchema).min(1), blockNumber: blockSchema }),
]);
export const arkivWriteResultSchema = z.strictObject({ transactionHash: briefIdSchema, entityKey: briefIdSchema });
export interface BriefmintArkivReader {
  get(entityKey: string): Promise<OpportunityRecord | null>;
  list(filter: z.infer<typeof opportunityFilterSchema>): Promise<{ records: OpportunityRecord[]; nextCursor: string | null }>;
  /** Must verify chain ID, successful receipt, actual signer and affected entity from the receipt. */
  transaction(transactionHash: string): Promise<z.infer<typeof arkivTransactionSchema>>;
}
export interface BriefmintArkivWriter {
  /** Receives ONLY prepared public intent, never BriefView. Wallet/account/chain checked before signing. */
  write(intent: PublicationIntent): Promise<z.infer<typeof arkivWriteResultSchema>>;
}
