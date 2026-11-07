import "server-only";
import { BRIEF_LIMITS, BRIEF_KIND, OPPORTUNITY_NAMESPACE, BRIEFMINT_CHAIN_ID, briefmintConfigSchema, type BriefmintConfig } from "../shared/briefs";
import { AuthService } from "./auth";
import { BriefService } from "./briefs";
import { BriefRunner, reconcileExpiredBriefLeases } from "./brief-runner";
import { createBriefInferenceProvider, type BriefInferenceProvider } from "./brief-inference";
import { BriefPublicationService, type PublicationReader } from "./brief-publication";
import { getBriefQuotaPolicy, type QuotaPolicy } from "./quota";
import { getServerEnv, type ServerEnv } from "./env";
import type { Database } from "./db";
import { createArkivBriefmintReader } from "../arkiv/briefmint/read";

async function probeReader(reader?: Pick<PublicationReader, "readiness">): Promise<boolean> {
  if (!reader) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.readiness ? reader.readiness() : Promise.resolve(true),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 5000); }),
    ]);
  } catch { return false; }
  finally { if (timer) clearTimeout(timer); }
}

function configuration(env: ServerEnv | null, policy: QuotaPolicy | null, providerReady: boolean, arkivReady: boolean, now: number): BriefmintConfig {
  const auth = { available: env !== null, reason: env ? null : "Session configuration is unavailable." };
  const quotaReady = policy !== null && policy.windowEndsAt > now;
  const available = auth.available && providerReady && quotaReady;
  return briefmintConfigSchema.parse({ schemaVersion: 1, kind: BRIEF_KIND, namespace: OPPORTUNITY_NAMESPACE,
    auth: { chainId: BRIEFMINT_CHAIN_ID, challengePurpose: "briefmint", readiness: auth },
    compilation: { available, reason: available ? null : !auth.available ? auth.reason : !providerReady ? "Private inference is not configured." : "Compilation quota is not configured or has expired." },
    arkiv: { chainId: BRIEFMINT_CHAIN_ID, readiness: { available: arkivReady, reason: arkivReady ? null : "The verified Arkiv reader is not installed or is unavailable." } },
    limits: BRIEF_LIMITS, quota: { policy: "allowlisted-demo", maxAttemptsPerBrief: 2, maxConcurrent: 1,
      compilationsPerWallet: policy?.compilationsPerWallet ?? null, globalDispatchLimit: policy?.globalDispatchLimit ?? null,
      windowEndsAt: policy ? new Date(policy.windowEndsAt).toISOString() : null } });
}
/** Public readiness needs neither a database nor a working checkout. No secret values are returned. */
export async function getBriefPublicConfig(): Promise<BriefmintConfig> {
  let env: ServerEnv | null = null;
  try { env = getServerEnv(); } catch { /* Report session unavailability without exposing configuration. */ }
  let arkivReady = false;
  if (env?.arkivAccessKey) {
    try { arkivReady = await probeReader(createArkivBriefmintReader({ accessKey: env.arkivAccessKey })); }
    catch { /* An unavailable reader is not a positive readiness signal. */ }
  }
  let providerReady = false;
  try { if (env) { createBriefInferenceProvider(env).assertReady(); providerReady = true; } } catch { /* Fail closed. */ }
  return configuration(env, getBriefQuotaPolicy(), providerReady, arkivReady, Date.now());
}
export function createBriefRuntime(db: Database, env: ServerEnv, options: {
  provider?: BriefInferenceProvider; policy?: QuotaPolicy | null; reader?: PublicationReader; now?: () => number;
} = {}) {
  const now = options.now ?? Date.now;
  // Match the successful guarded 0G probe: JSON mode, thinking disabled, and
  // a bounded output. The app previously used a larger free-form request and
  // then required JSON.parse(content), which could surface only as PROVIDER_FAILED.
  const provider = options.provider ?? createBriefInferenceProvider(env, fetch, {
    maxTokens: 1200, disableThinking: true, jsonMode: true,
  });
  const policy = options.policy === undefined ? getBriefQuotaPolicy() : options.policy;
  return {
    db, auth: new AuthService(db, env, now), briefs: new BriefService(db, now),
    runner: new BriefRunner(db, provider, policy, env.inferenceTimeoutMs, now),
    publication: new BriefPublicationService(db, options.reader, () => new Date(now())),
    recover() { return reconcileExpiredBriefLeases(db, now()); },
    async config() {
      let providerReady = false; let readerReady = false;
      try { provider.assertReady(); providerReady = true; } catch { /* Fail closed. */ }
      readerReady = await probeReader(options.reader);
      return configuration(env, policy, providerReady, readerReady, now());
    },
  };
}
export type BriefRuntime = ReturnType<typeof createBriefRuntime>;
