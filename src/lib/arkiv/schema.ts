// Workshop entity schema: Agent B owned.
// Pure definition only: no React, no wallet, no secrets, no browser globals.
// Safe to import from both browser code and the server (read.ts is server-neutral).

import { addr, bool, defineSchema, key, str, u64 } from "@arkiv-network/sdk/schema";
import { APP_NAMESPACE } from "@/lib/shared/domain";

// Namespace tag every Tool City workshop entity carries (schema name + `app` column).
export const WORKSHOP_NAMESPACE = APP_NAMESPACE;

export const WORKSHOP_SCHEMA = defineSchema(WORKSHOP_NAMESPACE, {
  app: str().indexed(),
  title: str(),
  description: str(),
  active: bool().indexed(),
  jobType: str().indexed(),
  sourceLang: str().indexed(),
  targetLang: str().indexed(),
  // Whitechain chain id (1874). u64: chain ids are non-negative and fit trivially.
  checkoutChainId: u64().indexed(),
  checkoutAddress: addr().indexed(),
  serviceId: key().indexed(),
  termsHash: key().indexed(),
});

export type WorkshopSchema = typeof WORKSHOP_SCHEMA;
