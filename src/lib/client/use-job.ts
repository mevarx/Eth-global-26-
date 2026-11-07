"use client";
// Job hooks: Agent B owned. Polling and retries follow the cross-boundary
// invariants: poll GET job ~every 2s only while the job is in an active state;
// payment verification retries with backoff on 202; `run` fires only from an
// explicit user action (this hook never auto-runs on mount or refresh).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryKeys } from "./api-client";
import type { Hex, JobStatus, JobView } from "../shared/domain";

/** Statuses that justify 2s polling; terminal/ready states use cache + focus. */
export const POLLED_JOB_STATUSES: readonly JobStatus[] = [
  "awaiting_payment",
  "payment_pending",
  "paid",
  "running",
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useJob(jobId: Hex | null | undefined) {
  return useQuery<JobView>({
    queryKey: jobId ? [...queryKeys.job(jobId)] : ["job", null],
    queryFn: () => api.getJob(jobId as Hex),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return false;
      return (POLLED_JOB_STATUSES as readonly string[]).includes(job.status) ? 2000 : false;
    },
    retry: 1,
  });
}

export function useJobsList(authenticated: boolean = true) {
  return useQuery({
    queryKey: [...queryKeys.jobs],
    queryFn: () => api.listJobs(),
    enabled: authenticated,
    retry: 1,
  });
}

/**
 * Submit a purchase hash and, while the server answers 202 (receipt or
 * confirmations pending), retry verification with backoff. Resolves with the
 * final server-returned job. Errors (e.g. 409 PAYMENT_MISMATCH, 503) reject
 * with ApiError for recoverable UI handling.
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: Hex; txHash: Hex }) => {
      const delaysMs = [1000, 2000, 4000, 8000, 8000, 8000];
      let result = await api.verifyPayment(input.jobId, input.txHash);
      for (let i = 0; i < delaysMs.length && result.pending; i += 1) {
        await sleep(delaysMs[i]);
        result = await api.verifyPayment(input.jobId, input.txHash);
      }
      return result.job;
    },
    onSuccess: (job) => {
      queryClient.setQueryData([...queryKeys.job(job.id)], job);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}
