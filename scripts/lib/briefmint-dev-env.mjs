import { parse } from "dotenv";

const privateInferenceKeys = ["ZERO_G_API_KEY", "ZERO_G_MODEL_ID", "ZERO_G_BASE_URL", "INFERENCE_TIMEOUT_MS"];

/** Merge only server-side 0G settings; never forward arbitrary env-file keys. */
export function mergeBriefmintInferenceEnv(fileContents, inherited) {
  const parsed = parse(fileContents);
  const merged = { ...inherited };
  for (const key of privateInferenceKeys) {
    if (Object.hasOwn(parsed, key)) merged[key] = parsed[key];
  }
  // A stale shell export must not make the server key part of a client build.
  delete merged.NEXT_PUBLIC_ZERO_G_API_KEY;
  delete merged.VITE_ZERO_G_API_KEY;
  delete merged.VITE_0G_API_KEY;
  if (!merged.ZERO_G_API_KEY?.trim() || !merged.ZERO_G_MODEL_ID || !merged.ZERO_G_BASE_URL) {
    throw new Error("The ignored 0G environment file is missing required server configuration.");
  }
  if (merged.ZERO_G_MODEL_ID !== "0gm-1.0-35b-a3b" || merged.ZERO_G_BASE_URL !== "https://router-api.0g.ai/v1") {
    throw new Error("The ignored 0G environment file does not match the pinned BriefMint Router configuration.");
  }
  return merged;
}
