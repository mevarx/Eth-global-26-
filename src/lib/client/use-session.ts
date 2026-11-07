"use client";
// Session hooks: cookie session + wallet-signed login: Agent B owned.
// Flow: connect wallet -> GET challenge -> signMessage -> POST verify -> session
// cookie. Switching accounts clears the previous buyer's private caches and ends
// the old session; switching networks alone never logs out (see use-session
// account sync, which only reacts to address changes).
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { api, isApiError, queryKeys } from "./api-client";
import { briefmintQueryKeys } from "./use-briefs";
import { advanceSessionGeneration, currentSessionGeneration, enqueueCookieMutation, completeCookieLogout, cookieLogoutPending, runCookieLogout, sessionBlockReason, subscribeSessionBlock } from "./session-generation";
import { sessionMatchesWallet } from "./session-identity";
import type { SessionResponse } from "../shared/api";

function assertCurrentSessionGeneration(generation: number): void {
  if (generation !== currentSessionGeneration()) throw new Error("Wallet account changed during sign-in. Please sign in again.");
}

function useCookieSession() {
  return useQuery<SessionResponse | null>({
    queryKey: [...queryKeys.session],
    queryFn: async () => {
      const generation = currentSessionGeneration();
      try {
        const session = await api.session();
        assertCurrentSessionGeneration(generation);
        return session;
      } catch (e) {
        // Unauthenticated is a normal logged-out state, not a query error.
        if (isApiError(e) && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useSession() {
  const query = useCookieSession();
  const wallet = useAccount();
  const blockedReason = useSyncExternalStore(subscribeSessionBlock, sessionBlockReason, () => null);
  const matches = !blockedReason && sessionMatchesWallet(query.data?.address, wallet.address, wallet.status);
  return {
    /** Authenticated buyer address, or null when logged out. */
    address: matches ? query.data!.address : null,
    expiresAt: matches ? query.data!.expiresAt : null,
    loading: query.isLoading,
    error: query.error,
    blockedReason,
    refetch: query.refetch,
  };
}

export function useLogin(purpose: "briefmint" | "legacy" = "legacy") {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  return useMutation({
    mutationFn: async (address: string) => {
      if (sessionBlockReason()) throw new Error("Retry ending the previous session before signing in.");
      const generation = advanceSessionGeneration();
      const challenge = await api.challenge(address, purpose);
      assertCurrentSessionGeneration(generation);
      const signature = await signMessageAsync({ message: challenge.message });
      assertCurrentSessionGeneration(generation);
      return enqueueCookieMutation(async () => {
        assertCurrentSessionGeneration(generation);
        const data = await api.verify(challenge.challengeId, signature);
        assertCurrentSessionGeneration(generation);
        // Notify other tabs after the cookie actually changes, so their
        // refetch cannot race ahead and retain the previous cookie owner.
        return { data, generation: advanceSessionGeneration() };
      });
    },
    onSuccess: ({ data, generation }) => {
      if (generation !== currentSessionGeneration()) return;
      queryClient.setQueryData([...queryKeys.session], data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
      void queryClient.invalidateQueries({ queryKey: briefmintQueryKeys.briefs });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const sharedPending = useSyncExternalStore(subscribeSessionBlock, cookieLogoutPending, () => false);
  const mutation = useMutation({
    mutationFn: async () => {
      clearPrivateCaches(queryClient);
      return runCookieLogout(() => api.logout());
    },
    onSuccess: (result) => {
      completeCookieLogout(result, () => clearPrivateCaches(queryClient));
    },
    // Storage failures already set the shared blocking reason. A stale error
    // callback must not replace a newer transition's state.
  });
  return { ...mutation, isPending: mutation.isPending || sharedPending };
}

function clearPrivateCaches(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.cancelQueries({ queryKey: queryKeys.session });
  queryClient.setQueryData([...queryKeys.session], null);
  queryClient.removeQueries({ queryKey: queryKeys.jobs });
  queryClient.removeQueries({ queryKey: ["job"] });
  queryClient.removeQueries({ queryKey: queryKeys.purchases });
  queryClient.removeQueries({ queryKey: briefmintQueryKeys.briefs });
  queryClient.removeQueries({ queryKey: ["briefmint-brief"] });
}

/**
 * Mount once inside the wallet provider (see ClientProviders). On wallet
 * account change, including disconnect: drop the previous buyer's private
 * UI/query caches and end the old server session. Network switches alone do
 * not trigger this hook (it watches `address` only).
 */
export function useSessionAccountSync() {
  const { address, status } = useAccount();
  const cookie = useCookieSession();
  const { mutate: logout } = useLogout();
  const queryClient = useQueryClient();
  const prevAddress = useRef<string | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      prevAddress.current = address;
    }
    const walletSettled = status === "connected" || status === "disconnected";
    const mismatch = walletSettled && !!cookie.data?.address && !sessionMatchesWallet(cookie.data.address, address, status);
    if (prevAddress.current !== address || mismatch) {
      prevAddress.current = address;
      clearPrivateCaches(queryClient);
      // Failures remain visibly blocked until the user retries logout.
      logout();
    }
  }, [address, status, cookie.data?.address, queryClient, logout]);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== "briefmint.sessionEpoch") return;
      currentSessionGeneration();
      clearPrivateCaches(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [queryClient]);
}
