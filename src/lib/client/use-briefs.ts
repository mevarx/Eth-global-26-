"use client";
// BriefMint hooks: Agent B owned. Polling follows the canonical state model:
// poll GET brief ~2s only while execution is `running` or publication status
// is `pending`; terminal/live/closed/expired states use cache + focus.
// `run` fires only from an explicit user action, never on mount or refresh.
// Reconcile retries with backoff on 202; a submitted tx hash alone is never
// treated as confirmed.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";
import { briefmintApi } from "./briefmint-api";
import { currentSessionGeneration } from "./session-generation";
import type { BriefApiRequest, BriefView } from "../shared/briefmint";

export const briefmintQueryKeys = {
  config: ["briefmint-config"] as const,
  briefs: ["briefmint-briefs"] as const,
  brief: (id: string, ownerAddress?: string) => ["briefmint-brief", id, ownerAddress?.toLowerCase() ?? null] as const,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBriefMintConfig() {
  return useQuery({
    queryKey: [...briefmintQueryKeys.config],
    queryFn: () => briefmintApi.config(),
    retry: 1,
    staleTime: 30_000,
  });
}

export function useBriefs(authenticated = true, beforeId?: string, ownerAddress?: string | null) {
  return useQuery({
    queryKey: [...briefmintQueryKeys.briefs, ownerAddress?.toLowerCase() ?? null, beforeId ?? null],
    queryFn: () => briefmintApi.listBriefs(ownerAddress ?? null, beforeId),
    enabled: authenticated && !!ownerAddress,
    retry: 1,
  });
}

export function useBrief(id: string | null | undefined, ownerAddress?: string | null) {
  return useQuery<BriefView>({
    queryKey: id ? [...briefmintQueryKeys.brief(id, ownerAddress ?? undefined)] : ["briefmint-brief", null, ownerAddress?.toLowerCase() ?? null],
    queryFn: () => briefmintApi.getBrief(id as string, ownerAddress ?? null),
    enabled: !!id && !!ownerAddress,
    refetchInterval: (query) => {
      const b = query.state.data as BriefView | undefined;
      if (!b) return false;
      if (b.executionStatus === "running" || b.publication.status === "pending") return 2000;
      return false;
    },
    retry: 1,
  });
}

export function useCreateBrief() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: BriefApiRequest<"create">) => briefmintApi.createBrief(req, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (brief, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id, brief.ownerAddress)], brief);
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useRunBrief() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefmintApi.runBrief(id, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (result, id, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(id, result.brief.ownerAddress)], result.brief);
    },
  });
}

export function useSaveDraft() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"saveDraft"> }) =>
      briefmintApi.saveDraft(input.id, input.req, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (brief, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id, brief.ownerAddress)], brief);
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useApproveBrief() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"approve"> }) =>
      briefmintApi.approveBrief(input.id, input.req, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (brief, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id, brief.ownerAddress)], brief);
    },
  });
}

export function usePreparePublication() {
  const { address } = useSession();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"prepare"> }) =>
      briefmintApi.preparePublication(input.id, input.req, address),
  });
}

/** One-shot, atomic server claim immediately before the browser wallet write. */
export function useArmPublication() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; req: BriefApiRequest<"reconcile"> }) =>
      briefmintApi.reconcilePublication(input.id, input.req, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (result, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(result.brief.id, result.brief.ownerAddress)], result.brief);
    },
  });
}

export function useReconcilePublication() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: () => currentSessionGeneration(),
    mutationFn: async (input: { id: string; req: BriefApiRequest<"reconcile"> }) => {
      const delaysMs = [1000, 2000, 4000, 8000];
      let result = await briefmintApi.reconcilePublication(input.id, input.req, address);
      for (let i = 0; i < delaysMs.length && result.pending; i += 1) {
        await sleep(delaysMs[i]);
        result = await briefmintApi.reconcilePublication(input.id, input.req, address);
      }
      return result;
    },
    onSuccess: (result, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(result.brief.id, result.brief.ownerAddress)], result.brief);
    },
  });
}

export function useRefreshPublication() {
  const { address } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefmintApi.refreshPublication(id, address),
    onMutate: () => currentSessionGeneration(),
    onSuccess: (brief, _input, generation) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...briefmintQueryKeys.brief(brief.id, brief.ownerAddress)], brief);
    },
  });
}
