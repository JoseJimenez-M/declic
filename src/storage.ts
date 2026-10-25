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

const STORAGE_ERROR = "Error de almacenamiento";

/** IndexedDB failures can arrive as null or as a DOMException; callers always get a real Error. */
const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(STORAGE_ERROR));

/**
 * Opens the database on first use (so tests can swap `indexedDB`) and caches it until opening fails
 * or the connection goes away (deleted or upgraded elsewhere, or closed by the browser), so the next call reopens it.
 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const promise: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      // Only a fresh database needs the stores; a later version must not try to create them again.
      if (event.oldVersion < 1) {
        request.result.createObjectStore(ATTEMPTS);
        request.result.createObjectStore(STATE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const forget = () => {
        if (dbPromise === promise) dbPromise = undefined;
      };
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => reject(asError(request.error));
  }).catch((e) => {
    if (dbPromise === promise) dbPromise = undefined;
    throw e;
  });
  dbPromise = promise;
  return promise;
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
    // A failed request fires `error` before the abort, when `tx.error` is still null, so the request's own error is the reason.
    tx.onerror = (e) => reject(asError((e.target as IDBRequest | null)?.error ?? tx.error));
    tx.onabort = () => reject(asError(tx.error));
    try {
      result = work(tx);
    } catch (e) {
      reject(asError(e));
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

/**
 * Replaces the attempts and the card data with the backup's, keeping `settings` and `today`, all or nothing.
 * Resolves with the state it wrote, so the caller can show it even if reading it back fails.
 */
export async function replaceAll(backup: Backup): Promise<AppState> {
  let written: AppState | undefined;
  await inTransaction([ATTEMPTS, STATE], "readwrite", (tx) => {
    const attempts = tx.objectStore(ATTEMPTS);
    const state = tx.objectStore(STATE);
    attempts.clear();
    for (const a of backup.attempts) attempts.add(a, keyOf(a));
    const current = state.get("app");
    current.onsuccess = () => {
      const kept = withDefaults(current.result);
      written = { ...kept, states: backup.states, completedDays: backup.completedDays, reports: backup.reports };
      state.put(written, "app");
    };
  });
  if (!written) throw new Error(STORAGE_ERROR);
  return written;
}
