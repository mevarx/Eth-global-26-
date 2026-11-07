import { canonicalPublicJson, type PublicationIntent, type PublicOpportunity, type Hex } from "../shared/briefmint";
import type { ArkivWriteDiagnostic } from "../arkiv/briefmint/write";

export type StoredIntent = Pick<PublicationIntent, "intentId" | "operation" | "entityKey"> & { transactionHash?: Hex | null; diagnostic?: ArkivWriteDiagnostic };
type RecoveryStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
const prefix = (briefId: string) => `briefmint.pendingIntent.${briefId}`;
const isHex = (value: unknown): value is Hex => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

/** Hash-bearing records have immutable, distinct keys. A losing tab's pre-arm
 * write can never erase a winner's recovery hash, even between reads/writes. */
export function storePublicationRecovery(storage: RecoveryStorage, briefId: string, value: StoredIntent): void {
  const key = value.transactionHash
    ? `${prefix(briefId)}.${value.intentId}.${value.transactionHash}`
    : `${prefix(briefId)}.${value.intentId}.prepared`;
  storage.setItem(key, JSON.stringify(value));
}

export function readPublicationRecovery(storage: RecoveryStorage, briefId: string, intentId: string): StoredIntent | null {
  let prepared: StoredIntent | null = null;
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== prefix(briefId) && !key?.startsWith(`${prefix(briefId)}.${intentId}.`)) continue;
    try {
      const record = JSON.parse(storage.getItem(key) ?? "null");
      if (!record || record.intentId !== intentId || !isHex(record.intentId)
        || !["create", "update", "close"].includes(record.operation)
        || (record.entityKey != null && !isHex(record.entityKey))
        || (record.transactionHash != null && !isHex(record.transactionHash))) continue;
      if (record.transactionHash) return record as StoredIntent;
      prepared = record as StoredIntent;
    } catch { /* Ignore unrelated or malformed local data. */ }
  }
  return prepared;
}

export function clearPublicationRecovery(storage: RecoveryStorage, briefId: string, intentId: string): void {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  for (const key of keys) {
    if (key?.startsWith(`${prefix(briefId)}.${intentId}.`)) storage.removeItem(key);
  }
}

export function assertPreparedIntentMatches(intent: PublicationIntent, expected: {
  intentId: string; operation: PublicationIntent["operation"]; ownerAddress: string;
  payload: PublicOpportunity; publicPayloadHash: string;
}): void {
  if (intent.intentId !== expected.intentId || intent.operation !== expected.operation
    || intent.ownerAddress.toLowerCase() !== expected.ownerAddress.toLowerCase()
    || intent.publicPayloadHash !== expected.publicPayloadHash
    || intent.payload.revision !== expected.payload.revision
    || canonicalPublicJson(intent.payload) !== canonicalPublicJson(expected.payload)) {
    throw new Error("Prepared publication differs from the reviewed request; no signature was requested.");
  }
}
