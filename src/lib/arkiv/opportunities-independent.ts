// Independent Arkiv opportunity reader: functions without the BriefMint API.
// Thin wrapper over the canonical adapter (src/lib/arkiv/briefmint/read.ts)
// with explicit access-key configuration supplied by the caller (UI input or
// operator). Never imports private API, session, or wallet code, so public
// discovery keeps working while the application API is stopped. Failed reads
// are distinct from an empty catalogue; no record is ever invented.
import { createArkivBriefmintReader } from "./briefmint/read";
import {
  toOpportunityView,
  type Hex,
  type OpportunityFilters,
  type OpportunityRecord,
  type OpportunityView,
} from "../shared/briefmint";

export const RABDI_PUBLIC_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";
export const RABDI_EXPLORER = "https://rabdi.explorer.arkiv.network";

export type IndependentReaderConfig = { accessKey: string };
const MAX_PAGES_PER_STATUS = 20;

function deadlineNowIso(): string {
  return new Date().toISOString();
}

/** Public opportunities without any backend session. Throws sanitized errors only. */
export async function readOpportunitiesIndependent(
  config: IndependentReaderConfig,
  filters: OpportunityFilters = {},
): Promise<OpportunityView[]> {
  const reader = createArkivBriefmintReader({ accessKey: config.accessKey.trim() });
  const base = {
    language: "en" as const,
    deadlineAfter: deadlineNowIso(),
    limit: 50,
    ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
  };
  const statuses: Array<"open" | "closed"> =
    filters.status && filters.status !== "all" ? [filters.status] : ["open", "closed"];
  const records: OpportunityRecord[] = [];
  for (const status of statuses) {
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < MAX_PAGES_PER_STATUS; pageNumber += 1) {
      const page = await reader.list({ ...base, status, ...(cursor === undefined ? {} : { cursor }) });
      records.push(...page.records);
      if (page.nextCursor === null) break;
      // Empty pages can still have a continuation because the SDK scans rows
      // that do not survive decoding/expiry filters. Never treat them as EOF.
      if (!/^(0|[1-9][0-9]*)$/.test(page.nextCursor)
        || !Number.isSafeInteger(Number(page.nextCursor))
        || Number(page.nextCursor) <= Number(cursor ?? "0")
        || pageNumber === MAX_PAGES_PER_STATUS - 1) {
        throw new Error("Arkiv catalogue pagination could not be completed. Narrow the filters and retry.");
      }
      cursor = page.nextCursor;
    }
  }
  // Offset pages can overlap as the public index changes between reads.
  const uniqueRecords = new Map(records.map((record) => [record.entityKey, record]));
  const views = [...uniqueRecords.values()].map(toOpportunityView);
  if (filters.budget === "with") return views.filter((v) => v.budgetUsdCents !== null);
  if (filters.budget === "without") return views.filter((v) => v.budgetUsdCents === null);
  return views;
}

/** Single public opportunity without any backend session; null when absent. */
export async function readOpportunityIndependent(
  config: IndependentReaderConfig,
  entityKey: Hex,
): Promise<OpportunityView | null> {
  const reader = createArkivBriefmintReader({ accessKey: config.accessKey.trim() });
  const record = await reader.get(entityKey);
  return record && BigInt(record.expiresAtBlock) > BigInt(record.observedAtBlock) ? toOpportunityView(record) : null;
}
