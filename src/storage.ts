import type { Backup, Report } from "./export";
import type { Attempt } from "./flow";
import type { Filter } from "./session";
import type { CardState } from "./srs";

export type Settings = { lang: "es" | "fr"; filter: Filter };

export type AppState = {
  states: Record<string, CardState>;
  completedDays: string[];
  reports: Report[];
  settings: Settings;
  today: { date: string; done: number };
};

const DEFAULT_STATE: AppState = {
  states: {},
  completedDays: [],
  reports: [],
  settings: { lang: "es", filter: "all" },
  today: { date: "", done: 0 },
};

const DB_NAME = "declic";
const ATTEMPTS = "attempts"; // out-of-line keys: `${at}-${uuid}`
const STATE = "state"; // one record under the key "app"

let dbPromise: Promise<IDBDatabase> | undefined;

/** Opens the database on first use (so tests can swap `indexedDB`) and caches it unless opening fails. */
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(ATTEMPTS);
      request.result.createObjectStore(STATE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((e) => {
    dbPromise = undefined;
    throw e;
  });
  return dbPromise;
}

/**
 * Runs `work` in one transaction and resolves with its result once the transaction has committed.
 * If `work` throws or the transaction aborts, nothing it queued is kept.
 */
async function inTransaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    try {
      result = work(tx);
    } catch (e) {
      reject(e);
      tx.abort();
    }
  });
}

/** A saved state may predate newer fields, so every level is merged over the defaults. */
function withDefaults(saved: AppState | undefined): AppState {
  const base = structuredClone(DEFAULT_STATE);
  return saved ? { ...base, ...saved, settings: { ...base.settings, ...saved.settings } } : base;
}

/** One key per attempt: appending never rewrites the whole log. */
const keyOf = (a: Attempt) => `${a.at}-${crypto.randomUUID()}`;

export async function addAttempts(list: Attempt[]): Promise<void> {
  if (list.length === 0) return;
  await inTransaction([ATTEMPTS], "readwrite", (tx) => {
    const store = tx.objectStore(ATTEMPTS);
    for (const a of list) store.add(a, keyOf(a));
  });
}

export async function loadAttempts(): Promise<Attempt[]> {
  const request = await inTransaction([ATTEMPTS], "readonly", (tx) => tx.objectStore(ATTEMPTS).getAll());
  const list: Attempt[] = request.result;
  return list.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}

export async function loadState(): Promise<AppState> {
  const request = await inTransaction([STATE], "readonly", (tx) => tx.objectStore(STATE).get("app"));
  return withDefaults(request.result);
}

export async function saveState(state: AppState): Promise<void> {
  await inTransaction([STATE], "readwrite", (tx) => {
    tx.objectStore(STATE).put(state, "app");
  });
}

/** Replaces the attempts and the card data with the backup's, keeping `settings` and `today`, all or nothing. */
export async function replaceAll(backup: Backup): Promise<void> {
  await inTransaction([ATTEMPTS, STATE], "readwrite", (tx) => {
    const attempts = tx.objectStore(ATTEMPTS);
    const state = tx.objectStore(STATE);
    attempts.clear();
    for (const a of backup.attempts) attempts.add(a, keyOf(a));
    const current = state.get("app");
    current.onsuccess = () => {
      const kept = withDefaults(current.result);
      state.put({ ...kept, states: backup.states, completedDays: backup.completedDays, reports: backup.reports }, "app");
    };
  });
}
