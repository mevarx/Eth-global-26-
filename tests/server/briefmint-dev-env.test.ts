import { describe, expect, it } from "vitest";
import { mergeBriefmintInferenceEnv } from "../../scripts/lib/briefmint-dev-env.mjs";

describe("BriefMint 0G server environment loader", () => {
  it("forwards only allowlisted server settings and pins the Router/model", () => {
    const result = mergeBriefmintInferenceEnv([
      "ZERO_G_API_KEY=synthetic-test-only-key",
      "ZERO_G_MODEL_ID=0gm-1.0-35b-a3b",
      "ZERO_G_BASE_URL=https://router-api.0g.ai/v1",
      "INFERENCE_TIMEOUT_MS=180000",
      "NEXT_PUBLIC_ZERO_G_API_KEY=must-not-forward",
      "NODE_OPTIONS=--inspect",
      "SESSION_SECRET=must-keep-inherited-config",
    ].join("\n"), { NODE_ENV: "test", NODE_OPTIONS: "--max-old-space-size=2048", SESSION_SECRET: "inherited-test-session",
      NEXT_PUBLIC_ZERO_G_API_KEY: "stale-public-test-key", VITE_0G_API_KEY: "stale-vite-test-key" });

    expect(result).toMatchObject({
      ZERO_G_API_KEY: "synthetic-test-only-key",
      ZERO_G_MODEL_ID: "0gm-1.0-35b-a3b",
      ZERO_G_BASE_URL: "https://router-api.0g.ai/v1",
      INFERENCE_TIMEOUT_MS: "180000",
      NODE_OPTIONS: "--max-old-space-size=2048",
      SESSION_SECRET: "inherited-test-session",
    });
    expect(result).not.toHaveProperty("NEXT_PUBLIC_ZERO_G_API_KEY");
    expect(result).not.toHaveProperty("VITE_0G_API_KEY");
  });

  it("fails closed for missing secrets or a different endpoint/model", () => {
    expect(() => mergeBriefmintInferenceEnv("ZERO_G_MODEL_ID=0gm-1.0-35b-a3b", { NODE_ENV: "test" })).toThrow("missing required");
    expect(() => mergeBriefmintInferenceEnv("ZERO_G_API_KEY=synthetic\nZERO_G_MODEL_ID=other\nZERO_G_BASE_URL=https://router-api.0g.ai/v1", { NODE_ENV: "test" })).toThrow("pinned BriefMint Router");
  });
});
