import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../src/lib/server/db";
import { BriefService, getBrief, saveBrief } from "../../src/lib/server/briefs";
import { BriefPublicationService, type PublicationReader } from "../../src/lib/server/brief-publication";
import { hashPublicOpportunity, projectPublicOpportunity, type BriefView } from "../../src/lib/shared/briefs";

const id = `0x${"a".repeat(64)}`, intentId = `0x${"b".repeat(64)}`, tx = `0x${"c".repeat(64)}`, key = `0x${"d".repeat(64)}`;
const owner = `0x${"1".repeat(40)}`, other = `0x${"2".repeat(40)}`;
const time = "2026-11-06T00:00:00.000Z";
// Deadline = fixture time + one day, the exact date the block-height
// expectations below are derived from. Every service in this file (including
// the default-constructor one above) is pinned to the fixture clock, so the
// "within the next seven days" window is evaluated against the fixture time.
const deadline = new Date(Date.parse(time) + 24 * 3600 * 1000).toISOString();
const candidate = { parameters: { title: "Graphics", summary: "Create graphics", category: "design" as const, language: "en" as const,
  budgetUsdCents: null, deadline, contactUrl: null },
  sections: { deliverables: ["Graphic"], acceptanceCriteria: ["Editable"], exclusions: [], openQuestions: [] }, status: "open" as const };
const item = { text: "Graphic", sourceIds: ["seg_001"], basis: "provided" as const };
let db: ReturnType<typeof openDatabase>;
let brief: BriefView;
let reader: PublicationReader;
let service: BriefPublicationService;
let hash: string;
let receipt: Awaited<ReturnType<PublicationReader["transaction"]>>;
let record: Awaited<ReturnType<PublicationReader["get"]>>;

beforeEach(async () => {
  db = openDatabase(":memory:");
  const payload = projectPublicOpportunity(candidate, 1); hash = await hashPublicOpportunity(payload);
  brief = { schemaVersion: 1, kind: "brief.compile.v1", id, ownerAddress: owner,
    inputSegments: [{ id: "seg_001", text: "Private" }], publicParameters: candidate.parameters, executionStatus: "ready",
    attemptsUsed: 1, retryEligible: false, immutableModelResult: { deliverables: [item], acceptanceCriteria: [item], exclusions: [], openQuestions: [] },
    editedDraft: structuredClone(candidate), draftRevision: 1, evidence: null, error: null,
    review: { status: "approved", approval: { draftRevision: 1, publicPayloadHash: hash, canonicalPublicPayload: payload, approvedBy: owner, approvedAt: time } },
    publication: { status: "unpublished", freshness: "unavailable", confirmed: null, pending: null }, createdAt: time, updatedAt: time };
  db.prepare("INSERT INTO briefs(id,owner,view_json,status,created_at) VALUES(?,?,?,?,?)").run(id, owner, JSON.stringify(brief), "ready", time);
  receipt = { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
  record = null;
  reader = { currentBlock: async () => ({ number: "101", timestamp: String(Date.parse(time) / 1000), blockTimeSeconds: 12 }),
    transaction: async () => receipt, get: async () => record, list: async () => ({ records: [], nextCursor: null }) };
  service = new BriefPublicationService(db, reader, () => new Date(time));
});
afterEach(() => db.close());
const request = () => ({ intentId, expectedRevision: 1, publicPayloadHash: hash, operation: "create" as const });
const reconcile = (transactionHash: string | null = null, entityKey: string | null = null) => ({ intentId, transactionHash, entityKey });
async function confirmCreate() {
  const intent = await service.prepare(owner, id, request());
  receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
  record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
  await service.reconcile(owner, id, reconcile(tx, key));
  return intent;
}

describe("publication intent and independent reconciliation", () => {
  it("creates only one acknowledged demo copy without modifying the uncertain source or dispatching inference", async () => {
    await service.prepare(owner, id, request()); await service.reconcile(owner, id, reconcile());
    const before = JSON.stringify(getBrief(db, owner, id));
    const briefs = new BriefService(db, () => Date.parse(time));
    const copyRequest = { expectedRevision: 1, publicPayloadHash: hash, acknowledgeDuplicateRisk: true };
    await expect(briefs.publicationCopy(owner, id, { ...copyRequest, acknowledgeDuplicateRisk: false })).rejects.toThrow();
    await expect(briefs.publicationCopy(other, id, copyRequest)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(briefs.publicationCopy(owner, id, { ...copyRequest, publicPayloadHash: tx })).rejects.toThrow();
    const [copy, repeated] = await Promise.all([briefs.publicationCopy(owner, id, copyRequest), briefs.publicationCopy(owner, id, copyRequest)]);
    expect(copy.id).not.toBe(id); expect(repeated.id).toBe(copy.id);
    expect(copy).toMatchObject({ executionStatus: "ready", attemptsUsed: 0, draftRevision: 1, immutableModelResult: brief.immutableModelResult,
      evidence: brief.evidence, review: { status: "unreviewed", approval: null }, publication: { status: "unpublished", pending: null },
      publicationCopy: { sourceBriefId: id, sourceRevision: 1, sourceApprovalHash: hash, duplicateRiskAcknowledged: true } });
    expect(copy.editedDraft!.parameters.title).toContain("[demo ");
    const publicJson = JSON.stringify(projectPublicOpportunity(copy.editedDraft!, copy.draftRevision));
    for (const privateValue of ["Private", id, hash, "publicationCopy", "sourceBriefId"]) expect(publicJson).not.toContain(privateValue);
    expect(JSON.stringify(getBrief(db, owner, id))).toBe(before);
    expect(db.prepare("SELECT COUNT(*) AS count FROM briefs").get()).toMatchObject({ count: 2 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM brief_publications").get()).toMatchObject({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM brief_quota").get()).toMatchObject({ count: 0 });
    await expect(briefs.publicationCopy(owner, copy.id, copyRequest)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("keeps a demo copy unapproved until separate review, then publishes under a new intent while the source stays locked", async () => {
    await service.prepare(owner, id, request()); await service.reconcile(owner, id, reconcile());
    const before = JSON.stringify(getBrief(db, owner, id)); const briefs = new BriefService(db, () => Date.parse(time));
    let copy = await briefs.publicationCopy(owner, id, { expectedRevision: 1, publicPayloadHash: hash, acknowledgeDuplicateRisk: true });
    const copyHash = await hashPublicOpportunity(projectPublicOpportunity(copy.editedDraft!, copy.draftRevision));
    const copyIntentId = `0x${"e".repeat(64)}`, copyTx = `0x${"f".repeat(64)}`;
    const copyRequest = { intentId: copyIntentId, operation: "create", expectedRevision: copy.draftRevision, publicPayloadHash: copyHash };
    await expect(service.prepare(owner, copy.id, copyRequest)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    copy = await briefs.approve(owner, copy.id, { expectedRevision: copy.draftRevision, publicPayloadHash: copyHash });
    const intent = await service.prepare(owner, copy.id, copyRequest);
    await service.reconcile(owner, copy.id, { intentId: copyIntentId, transactionHash: null, entityKey: null });
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    expect(await service.reconcile(owner, copy.id, { intentId: copyIntentId, transactionHash: copyTx, entityKey: key })).toMatchObject({ pending: false, brief: { publication: { status: "live" } } });
    expect(JSON.stringify(getBrief(db, owner, id))).toBe(before);
  });
  it("refuses a fresh copy once the original has a known submitted hash", async () => {
    await service.prepare(owner, id, request()); await service.reconcile(owner, id, reconcile(tx));
    const briefs = new BriefService(db, () => Date.parse(time));
    await expect(briefs.publicationCopy(owner, id, { expectedRevision: 1, publicPayloadHash: hash, acknowledgeDuplicateRisk: true })).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM briefs").get()).toMatchObject({ count: 1 });
  });
  it.each(["pending", "reverted", "wrong-owner", "wrong-payload", "wrong-expiry", "wrong-entity", "wrong-chain"])("rejects a manual %s recovery candidate without binding or unlocking it", async failure => {
    const intent = await service.prepare(owner, id, request());
    await service.reconcile(owner, id, reconcile());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    if (failure === "pending") receipt = { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
    if (failure === "reverted") receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    if (failure === "wrong-owner") receipt = { status: "confirmed", chainId: 7794095, signer: other, entityKeys: [key], blockNumber: "101" };
    if (failure === "wrong-payload") record.payload = { ...record.payload, title: "Unapproved title" };
    if (failure === "wrong-expiry") record.expiresAtBlock = "999999";
    if (failure === "wrong-entity") record.entityKey = tx;
    if (failure === "wrong-chain") reader.transaction = async () => ({ ...receipt, chainId: 1 } as unknown as typeof receipt);
    await expect(service.reconcile(owner, id, { ...reconcile(tx), recovery: true })).rejects.toBeDefined();
    expect(db.prepare("SELECT transaction_hash FROM brief_publications WHERE intent_id=?").get(intentId)).toMatchObject({ transaction_hash: null });
    expect(getBrief(db, owner, id)).toMatchObject({ draftRevision: 1, review: brief.review, publication: { status: "pending", pending: { state: "unknown", transactionHash: null } } });
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("recovers a known confirmed hash only after matching receipt and approved entity, without any writer", async () => {
    const intent = await service.prepare(owner, id, request());
    await service.reconcile(owner, id, reconcile());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    const result = await service.reconcile(owner, id, { ...reconcile(tx), recovery: true });
    expect(result).toMatchObject({ pending: false, brief: { draftRevision: 1, review: brief.review, publication: { status: "live", confirmed: { entityKey: key, lastConfirmedTransaction: tx } } } });
    expect(await service.reconcile(owner, id, { ...reconcile(tx), recovery: true })).toMatchObject({ pending: false });
    expect((db.prepare("SELECT COUNT(*) AS count FROM brief_publications").get() as { count: number }).count).toBe(1);
  });
  it("distinguishes revalidated preparation, unknown broadcast, delayed receipt and reverted evidence", async () => {
    await service.prepare(owner, id, request());
    expect(getBrief(db, owner, id).publication.pending?.state).toBe("prepared");
    // A wallet rejection before submission invokes no reconcile; revalidate the same prepared intent.
    await service.prepare(owner, id, request());
    expect((db.prepare("SELECT COUNT(*) AS count FROM brief_publications").get() as { count: number }).count).toBe(1);
    expect((await service.reconcile(owner, id, reconcile())).brief.publication.pending?.state).toBe("unknown");
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect((await service.reconcile(owner, id, reconcile(tx))).brief.publication.pending?.state).toBe("submitted");
    receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    const failed = await service.reconcile(owner, id, reconcile(tx));
    expect(failed).toMatchObject({ pending: true, brief: { publication: { status: "pending", confirmed: null, pending: { state: "reverted", transactionHash: tx } } } });
    receipt = { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
    expect((await service.reconcile(owner, id, reconcile(tx))).brief.publication.pending?.state).toBe("reverted");
  });
  it("defaults historical pending state to unknown and refuses a new signing authorization", async () => {
    await service.prepare(owner, id, request());
    const raw = getBrief(db, owner, id);
    const legacy = JSON.parse(JSON.stringify(raw)); delete legacy.publication.pending.state;
    db.prepare("UPDATE briefs SET view_json=? WHERE id=?").run(JSON.stringify(legacy), id);
    expect(getBrief(db, owner, id).publication.pending?.state).toBe("unknown");
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    await expect(service.reconcile(owner, id, reconcile())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("arms only one wallet attempt when two tabs race the same prepared intent", async () => {
    await service.prepare(owner, id, request());
    const results = await Promise.allSettled([service.reconcile(owner, id, reconcile()), service.reconcile(owner, id, reconcile())]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "PUBLICATION_CONFLICT" } });
    expect(getBrief(db, owner, id).publication.pending).toMatchObject({ state: "unknown", transactionHash: null });
    await expect(service.reconcile(owner, id, reconcile())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("recovers a submitted intent from disk and reconciles its older public revision without replacing newer private edits", async () => {
    const directory = mkdtempSync(join(tmpdir(), "briefmint-publication-"));
    const path = join(directory, "state.sqlite"); let disk = openDatabase(path);
    try {
      disk.prepare("INSERT INTO briefs(id,owner,view_json,status,created_at) VALUES(?,?,?,?,?)").run(id, owner, JSON.stringify(brief), "ready", time);
      let publication = new BriefPublicationService(disk, reader, () => new Date(time));
      const intent = await publication.prepare(owner, id, request());
      await publication.reconcile(owner, id, reconcile(tx, key));
      const edits = structuredClone(candidate); edits.parameters.title = "Newer private title";
      new BriefService(disk, () => Date.parse(time)).saveDraft(owner, id, { expectedRevision: 1, draft: edits });
      disk.close(); disk = openDatabase(path);
      publication = new BriefPublicationService(disk, reader, () => new Date(time));
      expect(getBrief(disk, owner, id).publication.pending).toMatchObject({ transactionHash: tx, state: "submitted" });
      await expect(publication.reconcile(other, id, reconcile(tx, key))).rejects.toMatchObject({ code: "NOT_FOUND" });
      receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
      record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
      const result = await publication.reconcile(owner, id, reconcile());
      expect(result.brief).toMatchObject({ draftRevision: 2, editedDraft: { parameters: { title: "Newer private title" } }, review: { status: "unreviewed" }, publication: { status: "live", pending: null, confirmed: { publicRevision: 1 } } });
    } finally { disk.close(); rmSync(directory, { recursive: true, force: true }); }
  });
  it("refreshes only known entities and proves later expiry from the current block", async () => {
    reader.get = async () => { throw new Error("must not read"); };
    expect((await service.refresh(owner, id)).publication.status).toBe("unpublished");
    reader.get = async () => record;
    const intent = await confirmCreate();
    record = null;
    await expect(service.refresh(owner, id)).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "live", freshness: "unavailable", confirmed: { lastConfirmedTransaction: tx } });
    reader.currentBlock = async () => ({ number: intent.expiresAtBlock, timestamp: String(Date.parse(time) / 1000 + 86400), blockTimeSeconds: 12 });
    expect((await service.refresh(owner, id)).publication).toMatchObject({ status: "expired", freshness: "fresh", confirmed: { status: "expired", lastConfirmedTransaction: tx } });
  });
  it("records external changes without claiming a new app transaction, and rejects owner transfer", async () => {
    await confirmCreate();
    record = { ...record!, payload: { ...record!.payload, title: "External" }, expiresAtBlock: "7302" };
    const observed = await service.refresh(owner, id);
    expect(observed.publication).toMatchObject({ status: "live", freshness: "fresh", confirmed: { externalChange: true, lastConfirmedTransaction: tx, expiresAtBlock: "7302" } });
    expect(observed.editedDraft).toEqual(brief.editedDraft);
    expect(observed.review).toEqual(brief.review);
    record = { ...record, ownerAddress: other };
    await expect(service.refresh(owner, id)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication).toEqual({ ...observed.publication, freshness: "stale" });
  });
  it("preserves pending intent and confirmed evidence when refresh fails", async () => {
    await confirmCreate();
    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated";
    briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const revisedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, 2));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: revisedHash });
    const updateId = `0x${"e".repeat(64)}`;
    await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: revisedHash });
    const before = getBrief(db, owner, id).publication;
    expect((await service.refresh(owner, id)).publication).toMatchObject({ status: "pending", pending: before.pending, confirmed: { lastConfirmedTransaction: tx } });
    reader.get = async () => { throw new Error("secret RPC detail"); };
    await expect(service.refresh(owner, id)).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE", message: "Arkiv is unavailable." });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "pending", freshness: "unavailable", pending: before.pending, confirmed: before.confirmed });
  });
  it("does not overwrite a concurrent reconciliation with an older refresh", async () => {
    await confirmCreate();
    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated";
    briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const revisedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, 2));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: revisedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    const update = await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: revisedHash });
    const oldRecord = record;
    let release!: () => void; let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.get = async () => { if (++calls === 1) { started(); await gate; return oldRecord; } return record; };
    const slow = service.refresh(owner, id);
    await entered;
    record = { ...record!, payload: update.payload };
    await service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    release();
    await expect(slow).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "live", confirmed: { observedPayloadHash: revisedHash, lastConfirmedTransaction: updateTx } });
  });
  it("does not let a delayed reconciliation erase a newer external observation", async () => {
    await confirmCreate();
    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated";
    briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const revisedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, 2));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: revisedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    const update = await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: revisedHash });
    const matching = { ...record!, payload: update.payload };
    let release!: () => void; let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.get = async () => { if (++calls === 1) { started(); await gate; return matching; } return record; };
    const slow = service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    await entered;
    record = { ...matching, payload: { ...matching.payload, title: "External" }, observedAtBlock: "102" };
    reader.currentBlock = async () => ({ number: "102", timestamp: String(Date.parse(time) / 1000 + 12), blockTimeSeconds: 12 });
    const refreshed = await service.refresh(owner, id);
    expect(refreshed.publication).toMatchObject({ status: "pending", confirmed: { externalChange: true, observedAtBlock: "102" } });
    release();
    await expect(slow).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication).toEqual(refreshed.publication);
  });
  it("persists immutable intent, returns duplicate, and blocks a second create even with unknown broadcast", async () => {
    const intent = await service.prepare(owner, id, request());
    expect(intent.expiresAtBlock).toBe("7301");
    expect(await service.prepare(owner, id, request())).toEqual(intent);
    await expect(service.prepare(owner, id, { ...request(), intentId: key })).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect((await service.reconcile(owner, id, reconcile())).pending).toBe(true);
    await expect(service.prepare(other, id, request())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each([null, tx])("refuses prepare retries once reconciliation has started with transaction %s", async transactionHash => {
    const intent = await service.prepare(owner, id, request());
    expect(await service.prepare(owner, id, request())).toEqual(intent);
    expect((await service.reconcile(owner, id, reconcile(transactionHash))).pending).toBe(true);
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT", status: 409 });
  });
  it("rechecks approval when a concurrent duplicate wins preparation", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.currentBlock = async () => {
      if (++calls === 1) { started(); await gate; }
      return { number: "101", timestamp: String(Date.parse(time) / 1000), blockTimeSeconds: 12 };
    };
    const slow = service.prepare(owner, id, request());
    await entered;
    await service.prepare(owner, id, request());
    const edited = getBrief(db, owner, id);
    edited.draftRevision = 2; edited.review = { status: "unreviewed", approval: null };
    edited.editedDraft!.parameters.title = "New title"; saveBrief(db, edited);
    release();
    await expect(slow).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
  it("records an old approved payload after a newer private edit only on matching receipt and entity", async () => {
    const intent = await service.prepare(owner, id, request());
    const edited = getBrief(db, owner, id); edited.draftRevision = 2; edited.review = { status: "unreviewed", approval: null };
    edited.editedDraft!.parameters.title = "New title"; saveBrief(db, edited);
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    const result = await service.reconcile(owner, id, reconcile(tx));
    expect(result).toMatchObject({ pending: false, brief: { draftRevision: 2, publication: { status: "live", confirmed: { publicRevision: 1, observedPayloadHash: hash } } } });
    expect((await service.reconcile(owner, id, reconcile(tx, key))).pending).toBe(false);
  });
  it("rejects wrong signer, entity and payload without crediting a publication", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: other, entityKeys: [key], blockNumber: "101" };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    receipt = { ...receipt, signer: owner };
    record = { entityKey: key, ownerAddress: owner, payload: { ...intent.payload, title: "Changed" }, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication.confirmed).toBeNull();
  });
  it("refuses changed expiry and preserves the pending intent on RPC failure", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: "7302", observedAtBlock: "101", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    reader.get = async () => { throw new Error("private RPC details"); };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE", message: "Arkiv is unavailable." });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "pending", freshness: "unavailable", pending: { transactionHash: tx } });
  });
  it("publishes an approved edit and then closes the same entity", async () => {
    const create = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: create.payload, expiresAtBlock: create.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));

    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated graphics";
    const saved = briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const updatedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, saved.draftRevision));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: updatedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    const update = await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: updatedHash });
    expect(update).toMatchObject({ entityKey: key, basePayloadHash: hash, expiresAtBlock: create.expiresAtBlock, payload: { revision: 2, title: "Updated graphics" } });
    record = { ...record, payload: update.payload };
    const updateResult = await service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    expect(updateResult).toMatchObject({ pending: false, brief: { publication: { status: "live", confirmed: { publicRevision: 2, observedPayloadHash: updatedHash, lastConfirmedTransaction: updateTx } } } });

    const closedDraft = { ...revised, status: "closed" as const };
    const closedSaved = briefs.saveDraft(owner, id, { expectedRevision: 2, draft: closedDraft });
    const closedHash = await hashPublicOpportunity(projectPublicOpportunity(closedDraft, closedSaved.draftRevision));
    await briefs.approve(owner, id, { expectedRevision: 3, publicPayloadHash: closedHash });
    const closeId = `0x${"2".repeat(64)}`, closeTx = `0x${"3".repeat(64)}`;
    const close = await service.prepare(owner, id, { intentId: closeId, operation: "close", expectedRevision: 3, publicPayloadHash: closedHash });
    expect(close).toMatchObject({ entityKey: key, basePayloadHash: updatedHash, expiresAtBlock: create.expiresAtBlock, payload: { revision: 3, status: "closed" } });
    record = { ...record, payload: close.payload };
    const result = await service.reconcile(owner, id, { intentId: closeId, transactionHash: closeTx, entityKey: key });
    expect(result).toMatchObject({ pending: false, brief: { publication: { status: "closed", confirmed: { entityKey: key, publicRevision: 3, observedPayloadHash: closedHash, lastConfirmedTransaction: closeTx }, pending: null } } });
  });
  it("retains the last confirmation while an update receipt is uncertain or unavailable", async () => {
    const create = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: create.payload, expiresAtBlock: create.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    const initial = await service.reconcile(owner, id, reconcile(tx, key));
    const confirmed = initial.brief.publication.confirmed;
    const briefs = new BriefService(db, () => Date.parse(time));
    const revised = structuredClone(candidate); revised.parameters.title = "Updated graphics";
    briefs.saveDraft(owner, id, { expectedRevision: 1, draft: revised });
    const revisedHash = await hashPublicOpportunity(projectPublicOpportunity(revised, 2));
    await briefs.approve(owner, id, { expectedRevision: 2, publicPayloadHash: revisedHash });
    const updateId = `0x${"e".repeat(64)}`, updateTx = `0x${"f".repeat(64)}`;
    await service.prepare(owner, id, { intentId: updateId, operation: "update", expectedRevision: 2, publicPayloadHash: revisedHash });
    receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    const unresolved = await service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key });
    expect(unresolved).toMatchObject({ pending: true, brief: { publication: { status: "pending", confirmed, pending: { transactionHash: updateTx } } } });
    reader.transaction = async () => { throw new Error("RPC failure"); };
    await expect(service.reconcile(owner, id, { intentId: updateId, transactionHash: updateTx, entityKey: key })).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "pending", freshness: "unavailable", confirmed, pending: { transactionHash: updateTx } });
  });
  it("does not return a settled intent for signing again", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    await expect(service.prepare(owner, id, request())).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("keeps external changes blocked on repeated prepare attempts", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    record = { ...record, payload: { ...record.payload, title: "External" } };
    const update = { ...request(), intentId: `0x${"e".repeat(64)}`, operation: "update" };
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication.confirmed?.externalChange).toBe(true);
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
  });
  it("uses the current block to prove expiry when the entity is absent", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    await service.reconcile(owner, id, reconcile(tx, key));
    record = null;
    const update = { ...request(), intentId: `0x${"e".repeat(64)}`, operation: "update" };
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "live", freshness: "unavailable" });
    reader.currentBlock = async () => ({ number: intent.expiresAtBlock, timestamp: String(Date.parse(time) / 1000 + 86400), blockTimeSeconds: 12 });
    await expect(service.prepare(owner, id, update)).rejects.toMatchObject({ code: "PUBLICATION_CONFLICT" });
    expect(getBrief(db, owner, id).publication).toMatchObject({ status: "expired", freshness: "fresh" });
  });
  it("rejects observations ahead of the current block", async () => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "102" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "102", observedAt: time };
    await expect(service.reconcile(owner, id, reconcile(tx, key))).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    expect(getBrief(db, owner, id).publication.status).toBe("pending");
  });
  it.each(["pending", "failure"])("does not let a late %s response overwrite a concurrent confirmation", async outcome => {
    const intent = await service.prepare(owner, id, request());
    receipt = { status: "confirmed", chainId: 7794095, signer: owner, entityKeys: [key], blockNumber: "101" };
    record = { entityKey: key, ownerAddress: owner, payload: intent.payload, expiresAtBlock: intent.expiresAtBlock, observedAtBlock: "101", observedAt: time };
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    reader.transaction = async () => {
      if (++calls === 1) {
        started(); await gate;
        if (outcome === "failure") throw new Error("late RPC error");
        return { status: "pending", chainId: 7794095, signer: null, entityKeys: [], blockNumber: null };
      }
      return receipt;
    };
    const slow = service.reconcile(owner, id, reconcile(tx, key));
    await entered;
    expect((await service.reconcile(owner, id, reconcile(tx, key))).pending).toBe(false);
    release();
    expect(await slow).toMatchObject({ pending: false, brief: { publication: { status: "live", freshness: "stale" } } });
  });
  it("keeps unbound reverted receipts pending and fails closed when reader is unavailable", async () => {
    // The default constructor owns no reader, so the first call must fail closed.
    // The wall-clock deadline window is bypassed by pinning the same fixture clock
    // as the other tests: these assertions only exercise reader availability.
    await expect(new BriefPublicationService(db, undefined, () => new Date(time)).prepare(owner, id, request())).rejects.toMatchObject({ code: "ARKIV_UNAVAILABLE" });
    await service.prepare(owner, id, request());
    receipt = { status: "reverted", chainId: 7794095, signer: owner, entityKeys: [], blockNumber: "101" };
    expect(await service.reconcile(owner, id, reconcile(tx))).toMatchObject({ pending: true, brief: { publication: { status: "pending", confirmed: null } } });
  });
});
