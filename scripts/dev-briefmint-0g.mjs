import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mergeBriefmintInferenceEnv } from "./lib/briefmint-dev-env.mjs";

const envFile = resolve(process.cwd(), ".env.0g-smoke");
let childEnv;
try {
  childEnv = mergeBriefmintInferenceEnv(readFileSync(envFile, "utf8"), process.env);
} catch {
  console.error("BriefMint 0G dev server was not started. Check that the ignored .env.0g-smoke has the required pinned server settings.");
  process.exit(1);
}

// Do not pass --env-file through NODE_OPTIONS: Next may spawn workers, and
// Node disallows --env-file inside NODE_OPTIONS. The allowlisted settings are
// inherited by the server process only; no inference runs during startup.
const nextCli = resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: childEnv,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => {
  console.error("BriefMint 0G dev server process failed to start.");
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
