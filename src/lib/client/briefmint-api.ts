// Typed BriefMint fetch wrapper: Agent B owned, client-safe.
// Every call goes through the canonical `briefApi` registry in
// ../shared/briefmint (frozen v1.2): method, path, request and response
// shapes are validated with zod. Failures throw ApiError {status, code,
// message, retryable}. 202 = in-progress (execution or chain confirmation);
// poll, don't assume. Backend 503 = dependency unavailable (honest state).
import {
  briefApi,
  type BriefApiName,
  type BriefApiRequest,
  type BriefApiResponse,
  type BriefView,
  type PublicationIntent,
} from "../shared/briefmint";

export { ApiError, isApiError, queryKeys } from "./api-client";
import { ApiError } from "./api-client";

type Success<K extends BriefApiName> = Extract<BriefApiResponse<K>, { ok: true }>;

function pathFor<K extends BriefApiName>(name: K, id?: string, query?: Record<string, string | undefined>): string {
  const raw = briefApi[name].path.replace(":id", id ?? "");
  if (!query) return raw;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `${raw}?${qs}` : raw;
}

async function callBriefApi<K extends BriefApiName>(
  name: K,
  input: BriefApiRequest<K>,
  options: { id?: string; query?: Record<string, string | undefined>; owner?: string | null } = {},
): Promise<{ data: Success<K>["data"]; status: number }> {
  const endpoint = briefApi[name];
  if (name !== "config" && !/^0x[0-9a-fA-F]{40}$/.test(options.owner ?? "")) {
    throw new ApiError(401, "UNAUTHENTICATED", "Connect the owner wallet and sign in before accessing private briefs.", false);
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (name !== "config") headers["x-briefmint-owner"] = options.owner!;
  if (endpoint.method !== "GET") headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(pathFor(name, options.id, options.query), {
      method: endpoint.method,
      credentials: "same-origin",
      headers,
      body: endpoint.method === "GET" ? undefined : JSON.stringify(input),
    });
  } catch (e) {
    throw new ApiError(0, "NETWORK_ERROR", e instanceof Error ? e.message : "Network request failed.", true);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "BAD_RESPONSE", "BriefMint returned an unreadable response.", false);
  }
  const parsed = endpoint.response.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(res.status, "BAD_RESPONSE", "BriefMint returned an invalid response.", false);
  }
  if (!parsed.data.ok) {
    const err = parsed.data.error;
    throw new ApiError(res.status, err.code, err.message, err.retryable);
  }
  return { data: parsed.data.data as Success<K>["data"], status: res.status };
}

export type RunBriefResult = { brief: BriefView; pending: boolean };
export type ReconcileBriefResult = { brief: BriefView; pending: boolean };

export const briefmintApi = {
  config() {
    return callBriefApi("config", {}).then((r) => r.data);
  },
  listBriefs(owner: string | null, beforeId?: string) {
    return callBriefApi("list", {}, { owner, query: beforeId ? { beforeId } : undefined }).then((r) => r.data);
  },
  createBrief(req: BriefApiRequest<"create">, owner: string | null) {
    return callBriefApi("create", req, { owner }).then((r) => r.data);
  },
  getBrief(id: string, owner: string | null) {
    return callBriefApi("get", {}, { id, owner }).then((r) => r.data);
  },
  async runBrief(id: string, owner: string | null): Promise<RunBriefResult> {
    const r = await callBriefApi("run", {}, { id, owner });
    return { brief: r.data, pending: r.status === 202 };
  },
  saveDraft(id: string, req: BriefApiRequest<"saveDraft">, owner: string | null) {
    return callBriefApi("saveDraft", req, { id, owner }).then((r) => r.data);
  },
  approveBrief(id: string, req: BriefApiRequest<"approve">, owner: string | null) {
    return callBriefApi("approve", req, { id, owner }).then((r) => r.data);
  },
  preparePublication(id: string, req: BriefApiRequest<"prepare">, owner: string | null): Promise<PublicationIntent> {
    return callBriefApi("prepare", req, { id, owner }).then((r) => r.data);
  },
  copyPublication(id: string, req: BriefApiRequest<"publicationCopy">, owner: string | null) {
    return callBriefApi("publicationCopy", req, { id, owner }).then((r) => r.data);
  },
  async reconcilePublication(id: string, req: BriefApiRequest<"reconcile">, owner: string | null): Promise<ReconcileBriefResult> {
    const r = await callBriefApi("reconcile", req, { id, owner });
    return { brief: r.data, pending: r.status === 202 };
  },
  refreshPublication(id: string, owner: string | null) {
    return callBriefApi("refresh", {}, { id, owner }).then((r) => r.data);
  },
  exportBrief(id: string, query: { format: "txt" | "json"; audience?: "private" | "public" }, owner: string | null) {
    return callBriefApi("export", query, {
      id, owner,
      query: { format: query.format, audience: query.audience },
    }).then((r) => r.data);
  },
};
