// Typed fetch wrapper for the §6 HTTP contract: Agent B owned. Client-safe.
// Every helper speaks the ApiResult<T> envelope with credentials:"same-origin"
// and JSON bodies. Failures throw ApiError {code,message,retryable,status}:
// never a raw HTML string: so UI can branch on 401/404/409/502/503 safely.
import type {
  ApiResult,
  ChallengeResponse,
  ConfigResponse,
  CreateJobRequest,
  JobsListResponse,
  LogoutResponse,
  MerchantPurchasesResponse,
  PatchEditsRequest,
  SessionResponse,
  VerifyPaymentRequest,
  VerifyResponse,
} from "../shared/api";
import type {
  Hex,
  JobSummary,
  JobView,
  MerchantPurchase,
  PublicConfig,
  TranslationSegment,
} from "../shared/domain";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export const queryKeys = {
  config: ["public-config"] as const,
  session: ["session"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["job", id] as const,
  purchases: ["merchant-purchases"] as const,
};

function isEnvelope(value: unknown): value is ApiResult<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.ok === true) return "data" in v;
  if (v.ok === false) {
    const err = (v as { error?: unknown }).error;
    return typeof err === "object" && err !== null;
  }
  return false;
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "BAD_INPUT";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 502:
      return "PROVIDER_FAILED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}

function retryableForStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status === 502 || status === 503;
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Non-JSON (proxy HTML error page, gateway splash, ...): never leak it.
    return null;
  }
}

async function doFetch(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (e) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      e instanceof Error ? e.message : "Network request failed.",
      true,
    );
  }
  const body = await parseJsonBody(res);
  return { status: res.status, body };
}

function envelopeError(status: number, body: unknown): { code: string; message: string; retryable: boolean } {
  if (isEnvelope(body) && !body.ok) {
    const err = body.error as { code?: unknown; message?: unknown; retryable?: unknown };
    return {
      code: typeof err.code === "string" ? err.code : codeForStatus(status),
      message: typeof err.message === "string" ? err.message : `Request failed (${status}).`,
      retryable: typeof err.retryable === "boolean" ? err.retryable : retryableForStatus(status),
    };
  }
  const code = codeForStatus(status);
  return { code, message: `Request failed (${status} ${code}).`, retryable: retryableForStatus(status) };
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const { status, body } = await doFetch(path, init);
  const ok = status >= 200 && status < 300;
  if (ok) {
    if (isEnvelope(body) && body.ok) return { data: body.data as T, status };
    if (isEnvelope(body) && !body.ok) {
      const err = envelopeError(status, body);
      throw new ApiError(status, err.code, err.message, err.retryable);
    }
    throw new ApiError(status, "INTERNAL_ERROR", `Unexpected response from ${path}.`, false);
  }
  const err = envelopeError(status, body);
  throw new ApiError(status, err.code, err.message, err.retryable);
}

async function get<T>(path: string): Promise<T> {
  return (await request<T>(path, { method: "GET" })).data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return (
    await request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) })
  ).data;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  return (
    await request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) })
  ).data;
}

export type VerifyPaymentResult = { job: JobView; pending: boolean };
export type RunJobResult = { job: JobView; pending: boolean };

export const api = {
  config(): Promise<PublicConfig> {
    return get<ConfigResponse>("/api/config");
  },
  challenge(address: string, purpose: "briefmint" | "legacy" = "legacy"): Promise<ChallengeResponse> {
    const query = new URLSearchParams({ address });
    // The server preserves the legacy chain (1874) when purpose is omitted.
    // BriefMint must explicitly request its Arkiv chain (7794095).
    if (purpose === "briefmint") query.set("purpose", "briefmint");
    return get<ChallengeResponse>(`/api/auth/challenge?${query.toString()}`);
  },
  verify(challengeId: string, signature: string): Promise<VerifyResponse> {
    return post<VerifyResponse>("/api/auth/verify", { challengeId, signature });
  },
  session(): Promise<SessionResponse> {
    return get<SessionResponse>("/api/auth/session");
  },
  logout(): Promise<LogoutResponse> {
    return post<LogoutResponse>("/api/auth/logout", {});
  },
  createJob(workshopEntityKey: Hex, text: string): Promise<JobView> {
    const body: CreateJobRequest = { workshopEntityKey, text };
    return post<JobView>("/api/jobs", body);
  },
  async listJobs(): Promise<JobSummary[]> {
    const res = await get<JobsListResponse>("/api/jobs");
    return res.jobs;
  },
  getJob(jobId: Hex): Promise<JobView> {
    return get<JobView>(`/api/jobs/${jobId}`);
  },
  /** 202 while the receipt/confirmations are pending, 200 once verified. */
  async verifyPayment(jobId: Hex, txHash: Hex): Promise<VerifyPaymentResult> {
    const body: VerifyPaymentRequest = { txHash };
    const res = await request<JobView>(`/api/jobs/${jobId}/verify-payment`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { job: res.data, pending: res.status === 202 };
  },
  /** 202 when the job is already running; 200 when the run completed. */
  async runJob(jobId: Hex): Promise<RunJobResult> {
    const res = await request<JobView>(`/api/jobs/${jobId}/run`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return { job: res.data, pending: res.status === 202 };
  },
  patchEdits(jobId: Hex, segments: TranslationSegment[]): Promise<JobView> {
    const body: PatchEditsRequest = { segments };
    return patch<JobView>(`/api/jobs/${jobId}/edits`, body);
  },
  async merchantPurchases(): Promise<MerchantPurchase[]> {
    const res = await get<MerchantPurchasesResponse>("/api/merchant/purchases");
    return res.purchases;
  },
  /** Same-origin CSV download URL (cookies ride along; fetch via <a href>). */
  merchantCsvUrl(): string {
    return "/api/merchant/purchases.csv";
  },
};
