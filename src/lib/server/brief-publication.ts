import "server-only";
import { z } from "zod";
import { transaction, type Database } from "./db";
import { getBrief, saveBrief, storedBriefView } from "./briefs";
import { badInput, ServiceError } from "./errors";
import {
  assertBriefDeadline, arkivTransactionSchema, briefViewSchema, canonicalPublicJson,
  hashPublicOpportunity, opportunityRecordSchema, preparePublicationRequestSchema,
  reconcilePublicationRequestSchema, validatePublicationApproval, validatePublicationIntent,
  type BriefmintArkivReader, type BriefView, type OpportunityRecord, type PublicationIntent,
} from "../shared/briefs";

/** timestamp is an unsigned decimal Unix timestamp in seconds. */
export interface PublicationReader extends BriefmintArkivReader {
  currentBlock(): Promise<{ number: string; timestamp: string; blockTimeSeconds: number }>;
  readiness?(): Promise<boolean>;
}
type Row = { intent_id: string; brief_id: string; request_json: string; intent_json: string; status: string; transaction_hash: string | null; entity_key: string | null };
const conflict = () => new ServiceError("PUBLICATION_CONFLICT", 409, "Publication conflicts with existing or observed state.");
const unavailable = () => new ServiceError("ARKIV_UNAVAILABLE", 503, "Arkiv is unavailable.", true);
const decimal = z.string().regex(/^(0|[1-9][0-9]*)$/).max(78);
const clockSchema = z.strictObject({ number: decimal, timestamp: decimal, blockTimeSeconds: z.number().finite().positive() });
const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export class BriefPublicationService {
  constructor(private readonly db: Database, private readonly reader?: PublicationReader, private readonly now: () => Date = () => new Date()) {}
  private row(id: string): Row | undefined {
    return this.db.prepare("SELECT * FROM brief_publications WHERE intent_id = ?").get(id) as Row | undefined;
  }
  private async network<T>(work: (reader: PublicationReader) => Promise<T>): Promise<T> {
    try {
      if (!this.reader || (this.reader.readiness && !(await this.reader.readiness()))) throw new Error();
      return await work(this.reader);
    } catch (error) {
      if (error instanceof ServiceError && error.code === "PUBLICATION_CONFLICT") throw error;
      throw unavailable();
    }
  }
  private markUnavailable(owner: string, id: string, intentId?: string, expectedPublication?: BriefView["publication"]) {
    transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (intentId && brief.publication.pending?.intent.intentId !== intentId) return;
      if (expectedPublication && JSON.stringify(brief.publication) !== JSON.stringify(expectedPublication)) return;
      brief.publication.freshness = "unavailable";
      saveBrief(this.db, brief);
    });
  }
  private markStale(owner: string, id: string, expectedPublication: BriefView["publication"]) {
    transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (JSON.stringify(brief.publication) !== JSON.stringify(expectedPublication)) return;
      if (brief.publication.freshness === "fresh") {
        brief.publication.freshness = "stale";
        saveBrief(this.db, brief);
      }
    });
  }
  private async observation(reader: PublicationReader, key: string) {
    const raw = await reader.get(key);
    const block = await reader.currentBlock();
    const record = raw === null ? null : opportunityRecordSchema.parse(raw);
    const current = clockSchema.parse(block);
    if (record && BigInt(current.number) < BigInt(record.observedAtBlock)) throw new Error("Inconsistent block observations");
    return { record, block: current };
  }
  private async evidence(record: OpportunityRecord, tx: string, block: string) {
    return {
      entityKey: record.entityKey, ownerAddress: record.ownerAddress, publicRevision: record.payload.revision,
      observedPayloadHash: await hashPublicOpportunity(record.payload), lastConfirmedTransaction: tx,
      expiresAtBlock: record.expiresAtBlock, observedAt: record.observedAt, observedAtBlock: record.observedAtBlock,
      status: BigInt(block) >= BigInt(record.expiresAtBlock) ? "expired" as const : record.payload.status === "closed" ? "closed" as const : "live" as const,
      externalChange: false,
    };
  }
  /** Observe the known entity without changing a pending intent or private review. */
  async refresh(owner: string, id: string): Promise<BriefView> {
    const snapshot = getBrief(this.db, owner, id);
    const confirmed = snapshot.publication.confirmed;
    if (!confirmed) return snapshot;
    let next: NonNullable<BriefView["publication"]["confirmed"]>;
    try {
      next = await this.network(async reader => {
        const { record, block } = await this.observation(reader, confirmed.entityKey);
        if (BigInt(block.number) < BigInt(confirmed.observedAtBlock)) throw new Error("Older block observation");
        if (!record) {
          if (BigInt(block.number) < BigInt(confirmed.expiresAtBlock)) throw new Error("Entity is unavailable before expiry");
          return { ...confirmed, status: "expired" as const, observedAtBlock: block.number,
            observedAt: new Date(Number(block.timestamp) * 1000).toISOString() };
        }
        if (record.entityKey !== confirmed.entityKey || !sameAddress(record.ownerAddress, owner)) throw conflict();
        if (BigInt(record.observedAtBlock) < BigInt(confirmed.observedAtBlock)) throw new Error("Older entity observation");
        const observed = await this.evidence(record, confirmed.lastConfirmedTransaction, block.number);
        observed.externalChange = confirmed.externalChange || observed.observedPayloadHash !== confirmed.observedPayloadHash
          || observed.expiresAtBlock !== confirmed.expiresAtBlock;
        return observed;
      });
    } catch (error) {
      if (error instanceof ServiceError && error.code === "PUBLICATION_CONFLICT") {
        this.markStale(owner, id, snapshot.publication);
      } else {
        this.markUnavailable(owner, id, undefined, snapshot.publication);
      }
      throw error;
    }
    return transaction(this.db, () => {
      const current = getBrief(this.db, owner, id);
      if (JSON.stringify(current.publication) !== JSON.stringify(snapshot.publication)) throw conflict();
      current.publication = { ...current.publication, status: current.publication.pending ? "pending" : next.status,
        freshness: "fresh", confirmed: next };
      saveBrief(this.db, briefViewSchema.parse(current));
      return current;
    });
  }
  private async preparedIntent(owner: string, id: string, request: z.infer<typeof preparePublicationRequestSchema>, requestJson: string) {
    const snapshot = getBrief(this.db, owner, id);
    const row = this.row(request.intentId);
    if (!row || row.brief_id !== id || row.request_json !== requestJson || row.status !== "prepared" || row.transaction_hash !== null
      || snapshot.publication.pending?.state !== "prepared") throw conflict();
    const [intent, payload] = await Promise.all([
      validatePublicationIntent(JSON.parse(row.intent_json)),
      validatePublicationApproval(snapshot, request.expectedRevision, request.publicPayloadHash),
    ]);
    try { assertBriefDeadline(payload.deadline, this.now().getTime()); }
    catch { throw badInput("Deadline must be within the next seven days."); }
    if (!sameAddress(intent.ownerAddress, owner) || intent.operation !== request.operation
      || intent.publicPayloadHash !== request.publicPayloadHash
      || canonicalPublicJson(intent.payload) !== canonicalPublicJson(payload)
      || JSON.stringify(snapshot.publication.pending?.intent) !== JSON.stringify(intent)
      || snapshot.publication.pending?.transactionHash !== null) throw conflict();
    return transaction(this.db, () => {
      const current = getBrief(this.db, owner, id);
      const latest = this.row(request.intentId);
      if (!latest || latest.brief_id !== id || latest.request_json !== requestJson
        || latest.intent_json !== row.intent_json || latest.status !== "prepared" || latest.transaction_hash !== null
        || JSON.stringify(current) !== JSON.stringify(snapshot)) throw conflict();
      return intent;
    });
  }
  async prepare(owner: string, id: string, value: unknown): Promise<PublicationIntent> {
    const request = preparePublicationRequestSchema.parse(value);
    const requestJson = JSON.stringify(request);
    const initial = getBrief(this.db, owner, id);
    const prior = this.row(request.intentId);
    if (prior) return this.preparedIntent(owner, id, request, requestJson);
    if (initial.publication.pending) throw conflict();
    const payload = await validatePublicationApproval(initial, request.expectedRevision, request.publicPayloadHash);
    try { assertBriefDeadline(payload.deadline, this.now().getTime()); }
    catch { throw badInput("Deadline must be within the next seven days."); }
    const confirmed = initial.publication.confirmed;
    if (confirmed?.externalChange) throw conflict();
    if ((request.operation === "create") !== (confirmed === null)) throw conflict();
    if ((request.operation === "close") !== (payload.status === "closed")) throw conflict();
    let expiry: string;
    try {
      expiry = await this.network(async reader => {
        const block = clockSchema.parse(await reader.currentBlock());
        if (!confirmed) {
          const delta = Date.parse(payload.deadline) / 1000 - Number(block.timestamp);
          const blocks = Math.floor(delta / block.blockTimeSeconds);
          if (!Number.isSafeInteger(blocks) || blocks < 1) throw new Error();
          return (BigInt(block.number) + BigInt(blocks)).toString();
        }
        const raw = await reader.get(confirmed.entityKey);
        if (!raw) {
          if (BigInt(block.number) < BigInt(confirmed.expiresAtBlock)) throw unavailable();
          const observedAt = new Date(Number(block.timestamp) * 1000).toISOString();
          transaction(this.db, () => {
            const current = getBrief(this.db, owner, id);
            if (JSON.stringify(current.publication) !== JSON.stringify(initial.publication)) throw conflict();
            current.publication = { status: "expired", freshness: "fresh", confirmed: {
              ...confirmed, status: "expired", observedAtBlock: block.number, observedAt,
            }, pending: null };
            saveBrief(this.db, briefViewSchema.parse(current));
          });
          throw conflict();
        }
        const record = opportunityRecordSchema.parse(raw);
        if (BigInt(block.number) < BigInt(record.observedAtBlock)) throw unavailable();
        const hash = await hashPublicOpportunity(record.payload);
        if (record.entityKey !== confirmed.entityKey || !sameAddress(record.ownerAddress, owner)) {
          this.markStale(owner, id, initial.publication);
          throw conflict();
        }
        if (hash !== confirmed.observedPayloadHash || record.expiresAtBlock !== confirmed.expiresAtBlock) {
          const evidence = await this.evidence(record, confirmed.lastConfirmedTransaction, block.number);
          evidence.externalChange = true;
          transaction(this.db, () => {
            const current = getBrief(this.db, owner, id);
            if (JSON.stringify(current.publication) !== JSON.stringify(initial.publication)) throw conflict();
            current.publication = { status: evidence.status, freshness: "fresh", confirmed: evidence, pending: null };
            saveBrief(this.db, briefViewSchema.parse(current));
          });
          throw conflict();
        }
        if (BigInt(block.number) >= BigInt(record.expiresAtBlock)) {
          const evidence = await this.evidence(record, confirmed.lastConfirmedTransaction, block.number);
          transaction(this.db, () => {
            const current = getBrief(this.db, owner, id);
            if (JSON.stringify(current.publication) !== JSON.stringify(initial.publication)) throw conflict();
            current.publication = { status: "expired", freshness: "fresh", confirmed: evidence, pending: null };
            saveBrief(this.db, briefViewSchema.parse(current));
          });
          throw conflict();
        }
        if (record.payload.status !== "open" || payload.deadline !== record.payload.deadline) throw conflict();
        if (request.operation === "close") {
          const oldContent = { ...record.payload, revision: payload.revision, status: "closed" as const };
          if (canonicalPublicJson(oldContent) !== canonicalPublicJson(payload)) throw conflict();
        }
        return record.expiresAtBlock;
      });
    } catch (e) {
      // Publication conflicts are authoritative observations, not transport failures.
      if (e instanceof ServiceError && e.code === "PUBLICATION_CONFLICT") throw e;
      this.markUnavailable(owner, id, undefined, initial.publication); throw e;
    }
    const intent = await validatePublicationIntent({ intentId: request.intentId, operation: request.operation,
      chainId: 7794095, ownerAddress: initial.ownerAddress, entityKey: confirmed?.entityKey ?? null,
      basePayloadHash: confirmed?.observedPayloadHash ?? null, payload, publicPayloadHash: request.publicPayloadHash,
      expiresAtBlock: expiry, createdAt: this.now().toISOString() });
    transaction(this.db, () => {
      const current = getBrief(this.db, owner, id);
      const existing = this.row(request.intentId);
      if (existing) {
        if (existing.brief_id !== id || existing.request_json !== requestJson || existing.status !== "prepared" || existing.transaction_hash !== null) throw conflict();
        return;
      }
      if (JSON.stringify(current) !== JSON.stringify(initial) || current.publication.pending) throw conflict();
      this.db.prepare("INSERT INTO brief_publications (intent_id, brief_id, request_json, intent_json, status, transaction_hash, entity_key) VALUES (?, ?, ?, ?, 'prepared', NULL, NULL)")
        .run(request.intentId, id, requestJson, JSON.stringify(intent));
      current.publication = { ...current.publication, status: "pending", pending: { intent, transactionHash: null, state: "prepared" } };
      saveBrief(this.db, briefViewSchema.parse(current));
    });
    return this.preparedIntent(owner, id, request, requestJson);
  }
  private currentResult(owner: string, id: string, intentId: string) {
    const brief = getBrief(this.db, owner, id);
    const row = this.row(intentId);
    if (!row || row.brief_id !== id) throw conflict();
    return { brief: storedBriefView(brief), pending: row.status === "prepared" || row.status === "pending" };
  }
  async reconcile(owner: string, id: string, value: unknown): Promise<{ brief: BriefView; pending: boolean }> {
    const request = reconcilePublicationRequestSchema.parse(value);
    getBrief(this.db, owner, id);
    let row = this.row(request.intentId);
    if (!row || row.brief_id !== id) throw conflict();
    const intent = await validatePublicationIntent(JSON.parse(row.intent_json));
    if (!sameAddress(intent.ownerAddress, owner)) throw conflict();
    if (row.transaction_hash && request.transactionHash && row.transaction_hash !== request.transactionHash) throw conflict();
    if (row.entity_key && request.entityKey && row.entity_key !== request.entityKey) throw conflict();
    if (intent.entityKey && request.entityKey && intent.entityKey !== request.entityKey) throw conflict();
    if (request.recovery && !row.transaction_hash) {
      if (!request.transactionHash) throw badInput("Recovery requires a known transaction hash.");
      // A human-provided hash is only a candidate. Do not poison an unknown
      // attempt with it until the receipt AND public entity bind it to this intent.
      await this.network(async reader => {
        const receipt = arkivTransactionSchema.parse(await reader.transaction(request.transactionHash!));
        if (receipt.status !== "confirmed" || !sameAddress(receipt.signer, owner)) throw conflict();
        const target = intent.entityKey ?? request.entityKey ?? (receipt.entityKeys.length === 1 ? receipt.entityKeys[0] : null);
        if (!target || !receipt.entityKeys.includes(target)) throw conflict();
        const { record, block } = await this.observation(reader, target);
        if (!record || record.entityKey !== target || !sameAddress(record.ownerAddress, owner)
          || BigInt(block.number) < BigInt(receipt.blockNumber) || BigInt(record.observedAtBlock) < BigInt(receipt.blockNumber)
          || record.expiresAtBlock !== intent.expiresAtBlock
          || canonicalPublicJson(record.payload) !== canonicalPublicJson(intent.payload)
          || await hashPublicOpportunity(record.payload) !== intent.publicPayloadHash) throw conflict();
      });
    }
    if (row.status === "confirmed" || row.status === "reverted") return { brief: storedBriefView(getBrief(this.db, owner, id)), pending: false };
    const active = transaction(this.db, () => {
      const current = this.row(request.intentId);
      if (current && (current.status === "confirmed" || current.status === "reverted")) return false;
      if (!current || (current.transaction_hash && request.transactionHash && current.transaction_hash !== request.transactionHash)
        || (current.entity_key && request.entityKey && current.entity_key !== request.entityKey)) throw conflict();
      const brief = getBrief(this.db, owner, id);
      if (!brief.publication.pending || JSON.stringify(brief.publication.pending.intent) !== JSON.stringify(intent)) throw conflict();
      // Null hints before any known hash arm exactly one wallet attempt. Another tab/reload loses the claim.
      if (!request.transactionHash && !request.entityKey && !current.transaction_hash
        && (current.status !== "prepared" || brief.publication.pending.state !== "prepared")) throw conflict();
      this.db.prepare("UPDATE brief_publications SET transaction_hash = COALESCE(transaction_hash, ?), entity_key = COALESCE(entity_key, ?), status = 'pending' WHERE intent_id = ?")
        .run(request.transactionHash, request.entityKey, request.intentId);
      brief.publication.pending.transactionHash = current.transaction_hash ?? request.transactionHash;
      if (brief.publication.pending.state !== "reverted") brief.publication.pending.state = "unknown";
      saveBrief(this.db, brief);
      return true;
    });
    if (!active) return this.currentResult(owner, id, request.intentId);
    row = this.row(request.intentId)!;
    if (!row.transaction_hash) return this.currentResult(owner, id, request.intentId);
    let receipt: z.infer<typeof arkivTransactionSchema>;
    try { receipt = await this.network(async reader => arkivTransactionSchema.parse(await reader.transaction(row!.transaction_hash!))); }
    catch (e) {
      const result = this.currentResult(owner, id, request.intentId);
      if (!result.pending) return result;
      this.markUnavailable(owner, id, request.intentId); throw e;
    }
    const afterReceipt = this.currentResult(owner, id, request.intentId);
    if (!afterReceipt.pending) return afterReceipt;
    if (receipt.status === "pending") return this.pendingOutcome(owner, id, request.intentId, "submitted");
    if (!sameAddress(receipt.signer, owner)) throw conflict();
    // A signer and a reverted receipt do not bind that transaction to this intent.
    // Keep uncertainty until an adapter can independently prove that binding.
    if (receipt.status === "reverted") return this.pendingOutcome(owner, id, request.intentId, "reverted");
    const target = intent.entityKey ?? row.entity_key ?? (receipt.entityKeys.length === 1 ? receipt.entityKeys[0] : null);
    if (!target || !receipt.entityKeys.includes(target)) throw conflict();
    const observationSnapshot = getBrief(this.db, owner, id).publication;
    let observation: Awaited<ReturnType<BriefPublicationService["observation"]>>;
    try { observation = await this.network(async reader => {
      const observed = await this.observation(reader, target);
      if (BigInt(observed.block.number) < BigInt(receipt.blockNumber)) throw new Error("Inconsistent receipt block");
      return observed;
    }); }
    catch (e) {
      const result = this.currentResult(owner, id, request.intentId);
      if (!result.pending) return result;
      this.markUnavailable(owner, id, request.intentId); throw e;
    }
    const afterObservation = this.currentResult(owner, id, request.intentId);
    if (!afterObservation.pending || !observation.record) return afterObservation;
    const record = observation.record;
    if (record.entityKey !== target || !sameAddress(record.ownerAddress, owner)) {
      this.markStale(owner, id, observationSnapshot);
      throw conflict();
    }
    if (record.expiresAtBlock !== intent.expiresAtBlock || BigInt(record.observedAtBlock) < BigInt(receipt.blockNumber)
      || canonicalPublicJson(record.payload) !== canonicalPublicJson(intent.payload)
      || await hashPublicOpportunity(record.payload) !== intent.publicPayloadHash) throw conflict();
    const evidence = await this.evidence(record, row.transaction_hash, observation.block.number);
    return this.settle(owner, id, request.intentId, "confirmed", evidence, observationSnapshot);
  }
  private pendingOutcome(owner: string, id: string, intentId: string, state: "submitted" | "reverted") {
    return transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      if (brief.publication.pending?.intent.intentId === intentId) {
        // An indexed receipt cannot regress to a not-yet-indexed result from another RPC.
        if (brief.publication.pending.state !== "reverted") brief.publication.pending.state = state;
        saveBrief(this.db, brief);
      }
      return this.currentResult(owner, id, intentId);
    });
  }
  private settle(owner: string, id: string, intentId: string, status: "confirmed" | "reverted", evidence: BriefView["publication"]["confirmed"], expectedPublication: BriefView["publication"]) {
    return transaction(this.db, () => {
      const brief = getBrief(this.db, owner, id);
      const row = this.row(intentId);
      if (!row || !brief.publication.pending || brief.publication.pending.intent.intentId !== intentId) {
        if (row?.status === status) return { brief: storedBriefView(brief), pending: false };
        throw conflict();
      }
      if (JSON.stringify(brief.publication) !== JSON.stringify(expectedPublication)) throw conflict();
      const confirmed = evidence ?? brief.publication.confirmed;
      brief.publication = { status: confirmed?.status ?? "unpublished", freshness: evidence ? "fresh" : brief.publication.freshness, confirmed, pending: null };
      this.db.prepare("UPDATE brief_publications SET status = ? WHERE intent_id = ?").run(status, intentId);
      saveBrief(this.db, briefViewSchema.parse(brief));
      return { brief, pending: false };
    });
  }
}
