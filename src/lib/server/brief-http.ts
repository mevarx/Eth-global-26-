import "server-only";
import { z } from "zod";
import { briefApi, briefIdSchema, briefViewSchema, BriefContractConflict, type BriefApiName } from "../shared/briefs";
import type { ApiResult } from "../shared/api";
import { ValidationError } from "../shared/validation";
import { badInput, ServiceError } from "./errors";
import { readBoundedText } from "./bounded-body";
import { getRuntime } from "./runtime";
import { getBriefPublicConfig, type BriefRuntime } from "./brief-runtime";
import { storedBriefView } from "./briefs";

function json(data: unknown, status = 200) {
  return Response.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}
function query(request: Request) {
  const result: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(result, key)) throw badInput();
    Object.defineProperty(result, key, { value, enumerable: true });
  }
  return result;
}
async function body(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw badInput("JSON content type is required.");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 32000)) { await request.body?.cancel(); throw badInput("Request body is invalid or too large."); }
  try { return JSON.parse(await readBoundedText(request.body, 32000)); } catch { throw badInput("Request body is invalid or too large."); }
}
/** Injectable runtime is for tests/composition, never a browser-controlled option. */
export async function handleBrief(action: BriefApiName, request: Request, id?: string, injected?: BriefRuntime): Promise<Response> {
  try {
    const endpoint = briefApi[action];
    if (request.method !== endpoint.method) throw new ServiceError("METHOD_NOT_ALLOWED", 405, "Method not allowed.");
    const params = query(request);
    if (request.method !== "GET" && Object.keys(params).length) throw badInput();
    if (action === "config") {
      endpoint.request.parse(params);
      const data = injected ? await injected.config() : await getBriefPublicConfig();
      try { endpoint.response.parse({ ok: true, data }); } catch { throw new ServiceError("INTERNAL_ERROR", 500, "Request could not be completed."); }
      return json(data);
    }
    const runtime = injected ?? getRuntime().briefmint;
    const { address } = runtime.auth.session(request);
    const expectedOwner = request.headers.get("x-briefmint-owner");
    if (!expectedOwner || !/^0x[0-9a-fA-F]{40}$/.test(expectedOwner) || expectedOwner.toLowerCase() !== address.toLowerCase()) {
      throw new ServiceError("SESSION_OWNER_MISMATCH", 409, "The wallet session changed. Sign in with the expected owner wallet.");
    }
    if (request.method !== "GET") runtime.auth.assertOrigin(request);
    if (id !== undefined) briefIdSchema.parse(id);
    const input = endpoint.request.parse(request.method === "GET" ? params : await body(request));
    runtime.recover();
    let data: unknown; let status = 200;
    switch (action) {
      case "create": data = runtime.briefs.create(address, input); status = 201; break;
      case "publicationCopy": data = await runtime.briefs.publicationCopy(address, id!, input); break;
      case "list": data = runtime.briefs.list(address, input); break;
      case "get": data = runtime.briefs.get(address, id!); break;
      case "saveDraft": data = runtime.briefs.saveDraft(address, id!, input); break;
      case "approve": data = await runtime.briefs.approve(address, id!, input); break;
      case "export": data = await runtime.briefs.export(address, id!, input); break;
      case "run": { const result = await runtime.runner.run(address, id!); data = result.brief; status = result.running ? 202 : 200; break; }
      case "prepare": data = await runtime.publication.prepare(address, id!, input); break;
      case "reconcile": { const result = await runtime.publication.reconcile(address, id!, input); data = result.brief; status = result.pending ? 202 : 200; break; }
      case "refresh": data = await runtime.publication.refresh(address, id!); break;
    }
    // Server output failures are internal errors, never a user validation error.
    try {
      // Read/edit operations cannot renew a saved chain observation. Explicit observation operations own fresh evidence.
      if (["create", "get", "run", "saveDraft", "approve"].includes(action)) data = storedBriefView(briefViewSchema.parse(data));
      endpoint.response.parse({ ok: true, data });
    } catch { throw new ServiceError("INTERNAL_ERROR", 500, "Request could not be completed."); }
    return json(data, status);
  } catch (error) {
    const failure = error instanceof ServiceError ? error
      : error instanceof BriefContractConflict ? new ServiceError(error.code, 409, "The saved content or approval changed. Reload the brief.")
        : error instanceof z.ZodError || error instanceof ValidationError ? badInput()
          : new ServiceError("INTERNAL_ERROR", 500, "Request could not be completed.");
    return Response.json({ ok: false, error: { code: failure.code, message: failure.message, retryable: failure.retryable } } satisfies ApiResult<never>,
      { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
