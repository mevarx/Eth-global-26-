import "server-only";
import { randomBytes } from "node:crypto";
import {
  briefIdSchema, briefViewSchema, createBriefRequestSchema, splitBriefNotes, assertBriefDeadline,
  saveBriefDraftRequestSchema, approveBriefRequestSchema, validateBriefApproval,
  listBriefsQuerySchema, exportBriefQuerySchema, projectPublicOpportunity, validatePublicationApproval, canonicalPublicJson, BriefContractConflict,
  publicationCopyRequestSchema,
  type BriefView, type BriefSummary,
} from "../shared/briefs";
import { normalizeAddress } from "../shared/validation";
import { transaction, type Database } from "./db";
import { ServiceError, badInput } from "./errors";

export function getBrief(db: Database, owner: string, id: string): BriefView {
  briefIdSchema.parse(id);
  const row = db.prepare("SELECT view_json FROM briefs WHERE id=? AND owner=?").get(id, owner.toLowerCase()) as { view_json: string } | undefined;
  if (!row) throw new ServiceError("NOT_FOUND", 404, "Brief not found.");
  return briefViewSchema.parse(JSON.parse(row.view_json));
}
export function saveBrief(db: Database, brief: BriefView): void {
  briefViewSchema.parse(brief);
  const result = db.prepare("UPDATE briefs SET view_json=?,status=?,attempts_used=? WHERE id=? AND owner=?")
    .run(JSON.stringify(brief), brief.executionStatus, brief.attemptsUsed, brief.id, brief.ownerAddress.toLowerCase());
  if (result.changes !== 1) throw new ServiceError("NOT_FOUND", 404, "Brief not found.");
}
function deadline(value: string, now: number) { try { assertBriefDeadline(value, now); } catch { throw badInput("Deadline must be within the next seven days."); } }
const conflict = () => new ServiceError("REVISION_CONFLICT", 409, "The saved revision changed. Reload the brief.");

/** Persisted evidence is historical. Only an operation that observed the chain can return fresh. */
export function storedBriefView(brief: BriefView): BriefView {
  return brief.publication.freshness === "fresh"
    ? { ...brief, publication: { ...brief.publication, freshness: "stale" } } : brief;
}

export class BriefService {
  constructor(private db: Database, private now = Date.now) {}
  create(owner: string, value: unknown) {
    const data = createBriefRequestSchema.parse(value); deadline(data.publicParameters.deadline, this.now());
    const timestamp = new Date(this.now()).toISOString();
    const brief: BriefView = { schemaVersion: 1, kind: "brief.compile.v1", id: `0x${randomBytes(32).toString("hex")}`,
      ownerAddress: normalizeAddress(owner), inputSegments: splitBriefNotes(data.notes), publicParameters: data.publicParameters,
      executionStatus: "draft", attemptsUsed: 0, retryEligible: false, immutableModelResult: null, editedDraft: null,
      draftRevision: 1, evidence: null, error: null, review: { status: "unreviewed", approval: null },
      publication: { status: "unpublished", freshness: "unavailable", confirmed: null, pending: null }, createdAt: timestamp, updatedAt: timestamp };
    briefViewSchema.parse(brief);
    this.db.prepare("INSERT INTO briefs(id,owner,view_json,status,created_at) VALUES(?,?,?,?,?)")
      .run(brief.id, owner.toLowerCase(), JSON.stringify(brief), brief.executionStatus, timestamp);
    return brief;
  }
  get(owner: string, id: string) { return storedBriefView(getBrief(this.db, owner, id)); }
  async publicationCopy(owner: string, id: string, value: unknown): Promise<BriefView> {
    const request = publicationCopyRequestSchema.parse(value);
    const source = getBrief(this.db, owner, id);
    if (source.publicationCopy || source.publication.confirmed || source.publication.pending?.state !== "unknown"
      || source.publication.pending.transactionHash !== null) {
      throw new ServiceError("PUBLICATION_CONFLICT", 409, "A demo copy requires an unresolved original create with no known transaction hash.");
    }
    const payload = await validatePublicationApproval(source, request.expectedRevision, request.publicPayloadHash);
    deadline(payload.deadline, this.now());
    return transaction(this.db, () => {
      if (JSON.stringify(getBrief(this.db, owner, id)) !== JSON.stringify(source)) throw conflict();
      // One copy per source, including repeated clicks/reloads. The old intent
      // and its uncertainty lock remain unchanged in their original records.
      const existing = this.db.prepare("SELECT view_json FROM briefs WHERE owner=? AND json_extract(view_json,'$.publicationCopy.sourceBriefId')=? LIMIT 1")
        .get(owner.toLowerCase(), id) as { view_json: string } | undefined;
      if (existing) {
        const copy = briefViewSchema.parse(JSON.parse(existing.view_json));
        if (copy.publicationCopy?.sourceRevision !== request.expectedRevision
          || copy.publicationCopy.sourceApprovalHash !== request.publicPayloadHash) throw conflict();
        return storedBriefView(copy);
      }
      const copyId = `0x${randomBytes(32).toString("hex")}`;
      const timestamp = new Date(this.now()).toISOString();
      const draft = structuredClone(source.editedDraft!);
      const suffix = ` [demo ${randomBytes(4).toString("hex")}]`;
      draft.parameters.title = draft.parameters.title.slice(0, 120 - suffix.length) + suffix;
      const copy = briefViewSchema.parse({ ...structuredClone(source), id: copyId, editedDraft: draft,
        attemptsUsed: 0, retryEligible: false, draftRevision: 1, error: null,
        review: { status: "unreviewed", approval: null },
        publication: { status: "unpublished", freshness: "unavailable", confirmed: null, pending: null },
        publicationCopy: { sourceBriefId: id, sourceRevision: source.draftRevision,
          sourceApprovalHash: request.publicPayloadHash, duplicateRiskAcknowledged: true }, createdAt: timestamp, updatedAt: timestamp });
      this.db.prepare("INSERT INTO briefs(id,owner,view_json,status,attempts_used,created_at) VALUES(?,?,?,?,0,?)")
        .run(copy.id, owner.toLowerCase(), JSON.stringify(copy), copy.executionStatus, timestamp);
      return copy;
    });
  }
  list(owner: string, input: unknown) {
    const query = listBriefsQuerySchema.parse(input);
    const cursor = query.beforeId ? getBrief(this.db, owner, query.beforeId) : null;
    const rows = (cursor
      ? this.db.prepare("SELECT view_json FROM briefs WHERE owner=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51").all(owner.toLowerCase(), cursor.createdAt, cursor.createdAt, cursor.id)
      : this.db.prepare("SELECT view_json FROM briefs WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 51").all(owner.toLowerCase())) as { view_json: string }[];
    const briefs: BriefSummary[] = rows.slice(0, 50).map(row => {
      const b = storedBriefView(briefViewSchema.parse(JSON.parse(row.view_json))); const parameters = b.editedDraft?.parameters ?? b.publicParameters;
      return { id: b.id, title: parameters.title, category: parameters.category, executionStatus: b.executionStatus,
        reviewStatus: b.review.status, publicationStatus: b.publication.status, freshness: b.publication.freshness,
        draftRevision: b.draftRevision, createdAt: b.createdAt, updatedAt: b.updatedAt };
    });
    return { briefs, nextBeforeId: rows.length > 50 ? briefs.at(-1)!.id : null };
  }
  saveDraft(owner: string, id: string, input: unknown) {
    const data = saveBriefDraftRequestSchema.parse(input); deadline(data.draft.parameters.deadline, this.now());
    return transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (brief.draftRevision !== data.expectedRevision) throw conflict();
      if (brief.executionStatus !== "ready") throw new ServiceError("BRIEF_NOT_READY", 409, "Compile the brief before editing.");
      if (brief.draftRevision === Number.MAX_SAFE_INTEGER) throw conflict();
      projectPublicOpportunity(data.draft, brief.draftRevision + 1);
      brief.editedDraft = data.draft; brief.draftRevision++; brief.review = { status: "unreviewed", approval: null };
      brief.updatedAt = new Date(this.now()).toISOString(); saveBrief(this.db, brief); return brief;
    });
  }
  async approve(owner: string, id: string, input: unknown) {
    const data = approveBriefRequestSchema.parse(input); const snapshot = getBrief(this.db, owner, id);
    const payload = await validateBriefApproval(snapshot, data.expectedRevision, data.publicPayloadHash);
    deadline(payload.deadline, this.now());
    return transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (brief.draftRevision !== snapshot.draftRevision || JSON.stringify(brief.editedDraft) !== JSON.stringify(snapshot.editedDraft)) throw conflict();
      if (brief.review.status === "approved") return brief;
      const approval = { draftRevision: brief.draftRevision, publicPayloadHash: data.publicPayloadHash, canonicalPublicPayload: payload,
        approvedBy: brief.ownerAddress, approvedAt: new Date(this.now()).toISOString() };
      this.db.prepare("INSERT INTO brief_approvals VALUES(?,?,?)").run(id, brief.draftRevision, JSON.stringify(approval));
      brief.review = { status: "approved", approval }; brief.updatedAt = approval.approvedAt; saveBrief(this.db, brief); return brief;
    });
  }
  async export(owner: string, id: string, input: unknown) {
    const { format, audience } = exportBriefQuerySchema.parse(input); const brief = getBrief(this.db, owner, id);
    if (audience === "public") {
      if (brief.review.status !== "approved") throw new BriefContractConflict("APPROVAL_REQUIRED");
      const payload = await validatePublicationApproval(brief, brief.draftRevision, brief.review.approval.publicPayloadHash);
      // Hashing yields: an edit or approval change during export must not release a stale public revision.
      const current = getBrief(this.db, owner, id);
      if (current.draftRevision !== brief.draftRevision || JSON.stringify(current.review) !== JSON.stringify(brief.review)
        || JSON.stringify(current.editedDraft) !== JSON.stringify(brief.editedDraft)) throw conflict();
      return { filename: `brief-public-r${payload.revision}.${format}`, mediaType: format === "json" ? "application/json" : "text/plain",
        content: format === "json" ? canonicalPublicJson(payload)
          : [`PUBLIC BRIEFMINT EXPORT: approved revision ${payload.revision}; advertised budget is unfunded`, canonicalPublicJson(payload)].join("\n\n") };
    }
    return { filename: `brief-${brief.id}.${format}`, mediaType: format === "json" ? "application/json" : "text/plain",
      content: format === "json" ? JSON.stringify(storedBriefView(brief), null, 2) : ["PRIVATE BRIEFMINT EXPORT: contains source and evidence",
        "Private notes", brief.inputSegments.map(s => s.text).join("\n\n"), "Original model result", JSON.stringify(brief.immutableModelResult, null, 2),
        "Saved candidate", JSON.stringify(brief.editedDraft, null, 2), "Evidence", JSON.stringify(brief.evidence, null, 2)].join("\n\n") };
  }
}
