// Server-neutral Arkiv workshop reads: Agent B owned.
// No React hooks, no wallet state, no browser globals, no secrets, no import from write.ts,
// so Agent A can import this module server-side to validate new jobs.
//
// SDK behavior normalized here (verified against @arkiv-network/sdk@1.0.1 sources):
// - missing record -> null (getEntity throws NoEntityFoundError; a live entity that does
//   not fit this schema throws SchemaMismatchError, which is also null: the key holds
//   no workshop record)
// - network/query failure -> throws a sanitized Error (RPC payloads can embed endpoint
//   URLs, so the original message is never forwarded)

import {
  createPublicClient,
  NoEntityFoundError,
  SchemaMismatchError,
  type FullRow,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { http } from "viem";
import {
  APP_NAMESPACE,
  JOB_TYPE,
  SOURCE_LANG,
  TARGET_LANG,
  type Hex,
  type PublicConfig,
  type WorkshopView,
} from "@/lib/shared/domain";
import { isAddress, isBytes32, sameAddress } from "@/lib/shared/validation";
import { WORKSHOP_SCHEMA, type WorkshopSchema } from "./schema";

const LIST_LIMIT = 100;

type WorkshopRow = FullRow<WorkshopSchema>;

function publicClientFor(config: PublicConfig) {
  const rpcUrl = config.arkiv.rpcUrl.trim();
  return createPublicClient({
    chain: rabdi({ accessKey: "" }),
    transport: http(rpcUrl.length > 0 ? rpcUrl : undefined),
  });
}

function isSupported(row: WorkshopRow, config: PublicConfig): boolean {
  const terms = config.terms;
  if (!terms) return false;
  if (row.active.value !== true) return false;
  return (
    sameAddress(row.$owner, terms.merchantAddress) &&
    row.checkoutChainId.value === BigInt(terms.chainId) &&
    sameAddress(row.checkoutAddress.value, terms.checkoutAddress) &&
    row.serviceId.value.toLowerCase() === terms.serviceId.toLowerCase() &&
    row.termsHash.value.toLowerCase() === terms.termsHash.toLowerCase()
  );
}

// A row that does not fit our fixed service shape is not a purchasable workshop:
// skip it rather than inventing WorkshopView fields for it.
function toWorkshopView(
  row: WorkshopRow,
  config: PublicConfig,
  fetchedAt: string,
): WorkshopView | null {
  if (!isBytes32(row.$key) || !isAddress(row.$owner)) return null;
  if (row.app.value !== APP_NAMESPACE) return null;
  const sourceLang = row.sourceLang.value;
  const targetLang = row.targetLang.value;
  const jobType = row.jobType.value;
  if (sourceLang !== SOURCE_LANG || targetLang !== TARGET_LANG || jobType !== JOB_TYPE) {
    return null;
  }
  if (!isAddress(row.checkoutAddress.value)) return null;
  if (!isBytes32(row.serviceId.value) || !isBytes32(row.termsHash.value)) return null;
  const checkoutChainId = row.checkoutChainId.value;
  if (checkoutChainId < 0 || checkoutChainId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return {
    entityKey: row.$key,
    ownerAddress: row.$owner,
    title: row.title.value,
    description: row.description.value,
    active: row.active.value,
    sourceLang,
    targetLang,
    jobType,
    checkoutChainId: Number(checkoutChainId),
    checkoutAddress: row.checkoutAddress.value,
    serviceId: row.serviceId.value,
    termsHash: row.termsHash.value,
    expiresAtBlock:
      typeof row.$expiresAt === "bigint" ? row.$expiresAt.toString() : null,
    fetchedAt,
    freshness: "fresh",
    supported: isSupported(row, config),
  };
}

export async function listWorkshops(config: PublicConfig): Promise<WorkshopView[]> {
  const client = publicClientFor(config);
  let page;
  try {
    // .from() already restricts to entities tagged with the schema name; the `app`
    // filter is defense-in-depth (anyone may reuse the tag).
    page = await client
      .select()
      .from(WORKSHOP_SCHEMA)
      .where(eq("app", APP_NAMESPACE))
      .limit(LIST_LIMIT)
      .fetch();
  } catch {
    throw new Error("tool-city: Arkiv listWorkshops failed.");
  }
  const fetchedAt = new Date().toISOString();
  const views: WorkshopView[] = [];
  for (const row of page.entities) {
    const view = toWorkshopView(row, config, fetchedAt);
    if (view !== null) views.push(view);
  }
  return views;
}

export async function getWorkshop(
  config: PublicConfig,
  key: Hex,
): Promise<WorkshopView | null> {
  if (!isBytes32(key)) {
    throw new Error("tool-city: getWorkshop needs a 32-byte entity key.");
  }
  const client = publicClientFor(config);
  let row: WorkshopRow;
  try {
    row = await client.getEntity(key, WORKSHOP_SCHEMA);
  } catch (err) {
    if (err instanceof NoEntityFoundError || err instanceof SchemaMismatchError) {
      return null;
    }
    throw new Error("tool-city: Arkiv getWorkshop failed.");
  }
  return toWorkshopView(row, config, new Date().toISOString());
}
