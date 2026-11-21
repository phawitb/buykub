// Progress store for the exam-prep engine: synchronous for the engine (localStorage copy),
// synced to /api/courses/[id]/progress in the background so another device picks it up.

export type ProgressState = Record<string, unknown> & { updatedAt?: number };
type Cached = { state: ProgressState | null; version: string | null; dirty: boolean };
type ServerCopy = { state: ProgressState | null; updated_at: string | null };

export const SAVE_DELAY_MS = 2000;

const stamp = (state: ProgressState | null | undefined) => typeof state?.updatedAt === "number" ? state.updatedAt : 0;

function readCache(key: string): Cached {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value && typeof value === "object") return { state: value.state ?? null, version: value.version ?? null, dirty: Boolean(value.dirty) };
  } catch {}
  return { state: null, version: null, dirty: false };
}

export type RemoteStore = {
  load(): ProgressState | null;
  save(state: ProgressState): void;
  /** Send pending progress now (page hidden, leaving the classroom). */
  flush(options?: { keepalive?: boolean }): Promise<void>;
  /** Pull the server copy; returns it when it is newer than what this device has. */
  pull(): Promise<ProgressState | null>;
  status(): "saved" | "pending" | "offline";
  dispose(): void;
};

/**
 * `accept` is called with a newer server copy found while saving; it returns false when the
 * engine cannot take it right now (a timed mock is running), and this device's copy then wins.
 */
export function createRemoteStore(productId: string, { accept, onStatus }: { accept: (state: ProgressState) => boolean; onStatus?: (status: "saved" | "pending" | "offline") => void }): RemoteStore {
  const key = `buykub:exam-prep:${productId}`;
  const url = `/api/courses/${productId}/progress`;
  let cache = readCache(key);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let offline = false;
  let disposed = false;

  const persist = () => { try { localStorage.setItem(key, JSON.stringify(cache)); } catch {} };
  const status = () => offline ? "offline" as const : cache.dirty ? "pending" as const : "saved" as const;
  const notify = () => onStatus?.(status());

  /** Merge a server copy into the cache. Newer wins; a tie keeps local. Returns the state to show, if it changed. */
  function reconcile(server: ServerCopy): ProgressState | null {
    if (!server.updated_at) return null;
    if (cache.dirty && stamp(cache.state) >= stamp(server.state)) {
      cache.version = server.updated_at; // local is newer: overwrite on the next save
      persist();
      return null;
    }
    const changed = stamp(server.state) !== stamp(cache.state);
    cache = { state: server.state, version: server.updated_at, dirty: false };
    persist();
    return changed ? server.state : null;
  }

  async function send(keepalive: boolean): Promise<void> {
    for (let attempt = 0; attempt < 3 && cache.dirty && cache.state && !disposed; attempt++) {
      const sent = cache.state;
      let response: Response;
      try {
        response = await fetch(url, { method: "PUT", keepalive, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: sent, base: cache.version }) });
      } catch {
        offline = true; notify(); return;
      }
      offline = false;
      if (response.status === 409) {
        const server = await response.json() as ServerCopy;
        const newer = reconcile(server);
        if (newer && !accept(newer)) { cache = { state: sent, version: server.updated_at, dirty: true }; persist(); }
        continue;
      }
      if (!response.ok) { notify(); return; } // keep it dirty; a later save or visit retries
      const { updated_at } = await response.json() as { updated_at: string };
      cache.version = updated_at;
      if (cache.state === sent) cache.dirty = false;
      persist();
    }
    notify();
  }

  function flush({ keepalive = false } = {}): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    if (inflight) return inflight.then((): Promise<void> => flush({ keepalive }));
    inflight = send(keepalive).finally(() => { inflight = null; });
    return inflight;
  }

  return {
    load: () => cache.state,
    save(state) {
      cache = { ...cache, state, dirty: true };
      persist();
      notify();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    flush,
    async pull() {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return null;
        offline = false;
        const newer = reconcile(await response.json() as ServerCopy);
        if (cache.dirty) void flush();
        notify();
        return newer;
      } catch {
        offline = true; notify();
        return null;
      }
    },
    status,
    dispose() { disposed = true; if (timer) clearTimeout(timer); },
  };
}
