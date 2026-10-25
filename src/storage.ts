import { clear, createStore, get, set, setMany, values, type UseStore } from "idb-keyval";
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

let attemptsStore: UseStore | undefined;
let stateStore: UseStore | undefined;
const attemptsDb = () => (attemptsStore ??= createStore("declic-attempts", "kv"));
const stateDb = () => (stateStore ??= createStore("declic-state", "kv"));

/** One key per attempt: appending never rewrites the whole log. */
const keyOf = (a: Attempt) => `${a.at}-${crypto.randomUUID()}`;

export async function addAttempts(list: Attempt[]): Promise<void> {
  if (list.length === 0) return;
  await setMany(list.map((a) => [keyOf(a), a]), attemptsDb());
}

export async function loadAttempts(): Promise<Attempt[]> {
  const list = await values<Attempt>(attemptsDb());
  return list.sort((x, y) => x.at.localeCompare(y.at));
}

export async function loadState(): Promise<AppState> {
  const saved = await get<AppState>("app", stateDb());
  const base = structuredClone(DEFAULT_STATE);
  return saved ? { ...base, ...saved, settings: { ...base.settings, ...saved.settings } } : base;
}

export async function saveState(state: AppState): Promise<void> {
  await set("app", state, stateDb());
}

export async function replaceAll(backup: Backup): Promise<void> {
  await clear(attemptsDb());
  await addAttempts(backup.attempts);
  const current = await loadState();
  await saveState({ ...current, states: backup.states, completedDays: backup.completedDays, reports: backup.reports });
}
