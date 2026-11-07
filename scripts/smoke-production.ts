import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createServer, type ViteDevServer } from "vite";

// Local-only HTTP smoke. Temporary unfunded identity/database; no external calls.
const directory = await mkdtemp(join(tmpdir(), "tool-city-smoke-"));
const base = "http://127.0.0.1:3187";
const origin = "https://tool-city-smoke.invalid";
const demoOrigin = "http://127.0.0.1:3188";
const demoBase = `${demoOrigin}/checkout-demo/`;
// Explicit allowlist: never inherit runtime credentials or endpoint/quota settings into this smoke.
const smokeEnv: NodeJS.ProcessEnv = { NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3187", APP_ORIGIN: origin,
    AUTH_ALLOWED_ORIGINS: origin, SESSION_SECRET: randomBytes(32).toString("hex"),
    DATABASE_PATH: join(directory, "smoke.sqlite"), NEXT_PUBLIC_ENABLE_DEV_FIXTURES: "false",
    ZERO_G_API_KEY: "", ZERO_G_MODEL_ID: "", ZERO_G_BASE_URL: "https://router-api.0g.ai/v1", INFERENCE_TIMEOUT_MS: "1000",
    ARKIV_ACCESS_KEY: "", WHITECHAIN_RPC_URL: "", BRIEFMINT_ALLOWED_WALLETS: "",
    BRIEFMINT_COMPILATIONS_PER_WALLET: "", BRIEFMINT_GLOBAL_DISPATCH_LIMIT: "", BRIEFMINT_QUOTA_WINDOW_ID: "", BRIEFMINT_QUOTA_WINDOW_END: "" };
let logs = "";
function startServer() {
  const serverProcess = spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: smokeEnv,
  });
  serverProcess.stdout.on("data", chunk => { logs += String(chunk); });
  serverProcess.stderr.on("data", chunk => { logs += String(chunk); });
  return serverProcess;
}
let child = startServer();
let demoServer: ViteDevServer | undefined;
async function stopServer() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>(resolve => { child.once("exit", () => resolve()); });
  child.kill("SIGTERM");
  const timer = setTimeout(() => { child.kill("SIGKILL"); }, 2000);
  try { await stopped; } finally { clearTimeout(timer); }
}
async function waitForServer() {
  let started = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("Local production process exited before readiness.");
    try { if ((await fetch(base)).ok) { started = true; break; } } catch { /* Wait for local readiness. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(started, "Production server failed to start");
}
try {
  await waitForServer();
  // Use the actual checkout-demo config with isolated ports and an explicit API target.
  // envDir=false prevents Vite from reading operator-owned environment files.
  demoServer = await createServer({ configFile: join(process.cwd(), "examples/checkout-demo/vite.config.ts"), root: join(process.cwd(), "examples/checkout-demo"), envDir: false,
    server: { host: "127.0.0.1", port: 3188, strictPort: true, proxy: { "/api": { target: base } } } });
  assert.ok(demoServer.config.server.proxy?.["/api"], "The checkout demo must retain its API proxy");
  await demoServer.listen();
  assert.equal((await fetch(demoBase)).status, 200);
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.data.configured, false, "Smoke must use the unconfigured deployment manifest");
  assert.equal((await fetch(`${base}/checkout-demo/index.html`)).status, 200);
  assert.equal((await fetch(`${base}/api/jobs`)).status, 401);
  const account = privateKeyToAccount(generatePrivateKey());
  const challenge = await (await fetch(`${demoOrigin}/api/auth/challenge?address=${account.address}`)).json();
  assert.equal(challenge.ok, true);
  const signature = await account.signMessage({ message: challenge.data.message });
  const login = await fetch(`${demoOrigin}/api/auth/verify`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.data.challengeId, signature }) });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie") ?? "", /; HttpOnly; SameSite=Lax;/);
  assert.match(login.headers.get("set-cookie") ?? "", /; Secure/);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  const proxiedSession = await fetch(`${demoOrigin}/api/auth/session`, { headers: { Cookie: cookie } });
  assert.equal((await proxiedSession.json()).data.address, account.address, "Vite must forward the session cookie unchanged");
  const deniedOrigin = await fetch(`${demoOrigin}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie, Origin: "https://untrusted.invalid", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(deniedOrigin.status, 403, "Vite must preserve the actual Origin for backend rejection");
  const jobs = await fetch(`${base}/api/jobs`, { headers: { Cookie: cookie } });
  assert.equal(jobs.status, 200);
  assert.deepEqual((await jobs.json()).data.jobs, []);
  const blocked = await fetch(`${base}/api/jobs`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ workshopEntityKey: `0x${"ab".repeat(32)}`, text: "A harmless local smoke sample." }) });
  assert.equal(blocked.status, 503, "Unconfigured checkout must not create a purchasable job");
  const briefConfig = await (await fetch(`${base}/api/briefmint/config`)).json();
  assert.equal(briefConfig.ok, true); assert.equal(briefConfig.data.auth.chainId, 7794095);
  assert.equal(briefConfig.data.compilation.available, false); assert.equal(briefConfig.data.arkiv.readiness.available, false);
  assert.equal((await fetch(`${base}/api/briefs`)).status, 401);
  const briefChallenge = await (await fetch(`${base}/api/auth/challenge?address=${account.address}&purpose=briefmint`)).json();
  assert.match(briefChallenge.data.message, /Chain ID: 7794095/);
  assert.equal((await fetch(`${base}/api/auth/challenge?address=${account.address}&purpose=briefmint&chainId=1874`)).status, 400);
  const headers = { Cookie: cookie, "x-briefmint-owner": account.address, Origin: origin, "Content-Type": "application/json" };
  const created = await fetch(`${base}/api/briefs`, { method: "POST", headers, body: JSON.stringify({
    notes: "Harmless private production smoke notes.",
    publicParameters: { title: "Synthetic public task", summary: "A local smoke sample", category: "writing", language: "en",
      budgetUsdCents: null, deadline: new Date(Date.now() + 86400000).toISOString(), contactUrl: null },
  }) });
  assert.equal(created.status, 201); const brief = (await created.json()).data;
  assert.equal(brief.executionStatus, "draft");
  assert.equal((await fetch(`${base}/api/briefs/${brief.id}`, { headers })).status, 200);
  const list = await (await fetch(`${base}/api/briefs`, { headers })).json();
  assert.equal(list.data.briefs.length, 1); assert(!JSON.stringify(list).includes("private production smoke notes"));
  const run = await fetch(`${base}/api/briefs/${brief.id}/run`, { method: "POST", headers, body: "{}" });
  assert.equal(run.status, 503, "Missing provider/quota must not dispatch");
  const after = await (await fetch(`${base}/api/briefs/${brief.id}`, { headers })).json();
  assert.equal(after.data.attemptsUsed, 0);
  const exported = await fetch(`${base}/api/briefs/${brief.id}/export?format=json`, { headers });
  assert.equal(exported.status, 200); assert.equal(JSON.parse((await exported.json()).data.content).id, brief.id);
  const publicExport = await fetch(`${base}/api/briefs/${brief.id}/export?format=json&audience=public`, { headers });
  assert.equal(publicExport.status, 409, "Unapproved data must not be exported as public");
  assert.equal((await publicExport.json()).error.code, "APPROVAL_REQUIRED");
  const refreshed = await fetch(`${base}/api/briefs/${brief.id}/publication/refresh`, { method: "POST", headers, body: "{}" });
  assert.equal(refreshed.status, 200, "A never-published brief needs no external observation");
  assert.equal((await refreshed.json()).data.publication.status, "unpublished");
  assert.equal((await fetch(`${base}/api/briefs/${brief.id}/publication/refresh`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" })).status, 401);
  // Restart the actual standalone process with the same private database and session secret.
  await stopServer(); child = startServer(); await waitForServer();
  const reopened = await fetch(`${base}/api/briefs/${brief.id}`, { headers });
  assert.equal(reopened.status, 200, "Owner session and private record must survive a process restart");
  const persisted = (await reopened.json()).data;
  assert.deepEqual(persisted.inputSegments, brief.inputSegments);
  assert.equal(persisted.attemptsUsed, 0, "Restart/reopen must not dispatch inference");
  assert.equal((await (await fetch(`${base}/api/briefs`, { headers })).json()).data.briefs.length, 1);
  console.log("PASS: standalone assets, actual checkout-demo Vite /api proxy with Cookie and Origin preservation, legacy auth/jobs/checkout denial, BriefMint chain/readiness, private CRUD/export, approval-gated public export, authenticated publication refresh, persistent restart/session, zero inference dispatches. Local HTTP only; no external integration called.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  try { await demoServer?.close(); }
  finally { await stopServer(); await rm(directory, { recursive: true, force: true }); }
}
