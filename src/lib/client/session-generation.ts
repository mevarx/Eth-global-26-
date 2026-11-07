// Client-only coordination; server authorization always comes from the cookie.
let generation = 0;
let cookieMutationQueue: Promise<unknown> = Promise.resolve();
let observedEpoch: string | null = null;
let blockedReason: string | null = null;
const listeners = new Set<() => void>();
type LogoutResult = { generation: number; error: unknown | null };
let pendingLogout: Promise<LogoutResult> | null = null;
export const cookieLogoutPending = () => pendingLogout !== null;
export const subscribeSessionBlock = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const sessionBlockReason = () => blockedReason;
export function setSessionBlock(reason: string | null): void {
  if (blockedReason === reason) return;
  blockedReason = reason;
  listeners.forEach(listener => listener());
}
function storageEpoch(): string | null {
  if (typeof window === "undefined" && typeof localStorage === "undefined") return null;
  try {
    if (typeof localStorage === "undefined") throw new Error();
    return localStorage.getItem("briefmint.sessionEpoch");
  } catch {
    const reason = "Browser storage must be enabled for safe wallet sign-in across tabs.";
    setSessionBlock(reason);
    throw new Error(reason);
  }
}
function synchronizeEpoch(): void {
  const epoch = storageEpoch();
  if (epoch !== observedEpoch) { observedEpoch = epoch; generation += 1; }
}
export function currentSessionGeneration(): number { synchronizeEpoch(); return generation; }
export function isCurrentSessionGeneration(value: number): boolean { return value === currentSessionGeneration(); }
export function invalidateLocalSessionGeneration(): number { synchronizeEpoch(); generation += 1; return generation; }

/** Publishes a transition; cookie-completion notifications happen inside its lock. */
export function advanceSessionGeneration(): number {
  synchronizeEpoch();
  generation += 1;
  if (typeof localStorage !== "undefined") {
    try {
      const epoch = globalThis.crypto.randomUUID();
      localStorage.setItem("briefmint.sessionEpoch", epoch);
      if (localStorage.getItem("briefmint.sessionEpoch") !== epoch) throw new Error();
      observedEpoch = epoch;
    } catch {
      const reason = "Browser storage could not coordinate wallet sessions. Retry after enabling storage.";
      setSessionBlock(reason);
      throw new Error(reason);
    }
  }
  return generation;
}

/** Serialize cookie writes across all tabs; unsupported browser capabilities fail closed. */
export function enqueueCookieMutation<T>(run: () => Promise<T>): Promise<T> {
  const coordinated = async (): Promise<T> => {
    if (typeof window === "undefined") return run();
    if (!navigator.locks) throw new Error("This browser must support Web Locks for safe wallet sign-in across tabs.");
    storageEpoch();
    return await navigator.locks.request("briefmint.session-cookie", run);
  };
  const next = cookieMutationQueue.then(coordinated, coordinated);
  cookieMutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

/** Notify other tabs only after the actual cookie deletion has completed. */
export function endCookieSession(run: () => Promise<unknown>, expectedGeneration: number): Promise<number> {
  return enqueueCookieMutation(async () => {
    if (!isCurrentSessionGeneration(expectedGeneration)) throw new Error("Session changed before logout; retry logout.");
    await run();
    return advanceSessionGeneration();
  });
}

/** All mounted controls share the same logout operation, including account sync. */
export function runCookieLogout(run: () => Promise<unknown>): Promise<LogoutResult> {
  if (pendingLogout) return pendingLogout;
  setSessionBlock("Ending the previous session…");
  const generation = invalidateLocalSessionGeneration();
  pendingLogout = endCookieSession(run, generation).then(
    completedGeneration => ({ generation: completedGeneration, error: null }),
    error => ({ generation, error }),
  ).finally(() => {
    pendingLogout = null;
    listeners.forEach(listener => listener());
  });
  listeners.forEach(listener => listener());
  return pendingLogout;
}

/** A delayed callback must never clear a newer login/retry's private caches. */
export function completeCookieLogout(result: LogoutResult, clear: () => void): boolean {
  try { if (!isCurrentSessionGeneration(result.generation)) return false; }
  catch { return false; } // Storage failure has already blocked private access.
  clear();
  setSessionBlock(result.error ? (result.error instanceof Error ? result.error.message : "Logout failed. Retry before signing in.") : null);
  return true;
}
