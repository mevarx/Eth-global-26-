// Browser-only Arkiv workshop writes: Agent B owned.
// Takes the connected wallet's transport (e.g. viem's custom(provider)) plus the signing
// account; there is no shared server key that owns listings. Never imported by read.ts
// and never imports server modules. No "use client" directive is needed in lib; callers
// invoke these from user gestures with a live wallet connection.
// Errors are sanitized (no RPC payloads, no secrets) and no explorer links are fabricated:
// a failed broadcast has no transaction hash to link to.

import {
  createWalletClient,
  ExpirationTime,
  MAX_STRING_BYTES,
  type PatchEntityValues,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { addr, bool, key, str, u64 } from "@arkiv-network/sdk/schema";
import type { Transport } from "viem";
import {
  APP_NAMESPACE,
  JOB_TYPE,
  SOURCE_LANG,
  TARGET_LANG,
  type Address,
  type CheckoutTerms,
  type Hex,
  type PublicConfig,
} from "@/lib/shared/domain";
import { isBytes32 } from "@/lib/shared/validation";
import { WORKSHOP_SCHEMA } from "./schema";

export type WorkshopInput = { title: string; description: string };
export type WorkshopPatch = { title?: string; description?: string; active?: boolean };
export type WorkshopReceipt = { entityKey: Hex; txHash: Hex };
export type WorkshopCreation = WorkshopReceipt & { expiresAtBlock: string };

function requireTerms(config: PublicConfig): CheckoutTerms {
  if (!config.terms) {
    throw new Error("tool-city: workshop writes need configured checkout terms.");
  }
  return config.terms;
}

// `str` columns hold at most MAX_STRING_BYTES UTF-8 bytes (not characters).
function requireText(field: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`tool-city: workshop ${field} is empty.`);
  if (new TextEncoder().encode(trimmed).length > MAX_STRING_BYTES) {
    throw new Error(
      `tool-city: workshop ${field} exceeds ${MAX_STRING_BYTES} UTF-8 bytes.`,
    );
  }
  return trimmed;
}

function walletFor(transport: Transport, account: Address) {
  return createWalletClient({
    chain: rabdi({ accessKey: "" }),
    transport,
    account,
  });
}

export async function createWorkshop(
  transport: Transport,
  account: Address,
  config: PublicConfig,
  input: WorkshopInput,
): Promise<WorkshopCreation> {
  const terms = requireTerms(config);
  const title = requireText("title", input.title);
  const description = requireText("description", input.description);
  const wallet = walletFor(transport, account);
  let result;
  try {
    result = await wallet.createEntity(
      WORKSHOP_SCHEMA,
      {
        app: str(APP_NAMESPACE),
        title: str(title),
        description: str(description),
        active: bool(true),
        jobType: str(JOB_TYPE),
        sourceLang: str(SOURCE_LANG),
        targetLang: str(TARGET_LANG),
        checkoutChainId: u64(terms.chainId),
        checkoutAddress: addr(terms.checkoutAddress),
        serviceId: key(terms.serviceId),
        termsHash: key(terms.termsHash),
      },
      { expiration: ExpirationTime.fromDays(30) },
    );
  } catch {
    throw new Error("tool-city: Arkiv createWorkshop failed.");
  }
  return {
    entityKey: result.entityKey,
    txHash: result.txHash,
    expiresAtBlock: result.expiresAt.toString(),
  };
}

export async function updateWorkshop(
  transport: Transport,
  account: Address,
  _config: PublicConfig,
  entityKey: Hex,
  patch: WorkshopPatch,
): Promise<WorkshopReceipt> {
  if (!isBytes32(entityKey)) {
    throw new Error("tool-city: updateWorkshop needs a 32-byte entity key.");
  }
  // Only presentation fields are editable in this MVP; checkout/service/terms references
  // are immutable (there is no editable financial price).
  const set: PatchEntityValues<typeof WORKSHOP_SCHEMA> = {
    ...(patch.title !== undefined
      ? { title: str(requireText("title", patch.title)) }
      : {}),
    ...(patch.description !== undefined
      ? { description: str(requireText("description", patch.description)) }
      : {}),
    ...(patch.active !== undefined ? { active: bool(patch.active) } : {}),
  };
  if (Object.keys(set).length === 0) {
    throw new Error("tool-city: updateWorkshop needs at least one field.");
  }
  const wallet = walletFor(transport, account);
  let result;
  try {
    result = await wallet.patchEntity(WORKSHOP_SCHEMA, entityKey, { set });
  } catch {
    throw new Error("tool-city: Arkiv updateWorkshop failed.");
  }
  return { entityKey, txHash: result.txHash };
}

// Withdrawal is an explicit owner-signed `active=false` update. Existing paid jobs stay
// accessible; withdrawal only stops new discovery/quotes.
export async function withdrawWorkshop(
  transport: Transport,
  account: Address,
  config: PublicConfig,
  entityKey: Hex,
): Promise<WorkshopReceipt> {
  return updateWorkshop(transport, account, config, entityKey, { active: false });
}
