import { useEffect, useState } from "preact/hooks";
import { loadContent } from "./content/load";
import type { Item } from "./content/types";
import { completeIfExhausted, finishItem, type Daily } from "./daily";
import { localDate } from "./dates";
import type { Attempt } from "./flow";
import { buildSession } from "./session";
import { nextState, type Outcome } from "./srs";
import { streak } from "./stats";
import { addAttempts, loadAttempts, loadState, saveState, type AppState, type Settings } from "./storage";
import { Exercise } from "./ui/Exercise";
import { Home } from "./ui/Home";
import { SettingsScreen } from "./ui/Settings";
import { StatsScreen } from "./ui/Stats";

const content = loadContent();
const DAILY = 10;

type Screen = { name: "home" } | { name: "exercise"; queue: Item[]; extra: boolean } | { name: "stats" } | { name: "settings" };

/** Copies the day accounting back into the app state, keeping the same object when nothing changed. */
const withDaily = (prev: AppState, d: Daily): AppState => (d === prev ? prev : { ...prev, today: d.today, completedDays: d.completedDays });

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void Promise.all([loadState(), loadAttempts()]).then(([s, a]) => {
      setState(s);
      setAttempts(a);
    });
  }, []);

  // Android keeps the WebView alive in the background: render again when the app comes back, so the day rolls over after midnight.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  /** Every state change goes through a functional update and is persisted right away. */
  const change = (fn: (prev: AppState) => AppState) =>
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (next !== prev) void saveState(next);
      return next;
    });

  // With nothing left to practise for the current filter the day counts as done, so the streak never breaks through no fault of the learner.
  useEffect(() => {
    if (!state || screen.name !== "home") return;
    const day = localDate();
    change((prev) => withDaily(prev, completeIfExhausted(prev, day, buildSession(content.items, prev.states, day, prev.settings.filter, 1).length)));
  }, [state, screen.name, tick]);

  if (!state) {
    return (
      <main class="app">
        <p class="muted">Cargando…</p>
      </main>
    );
  }

  const today = localDate();
  const doneToday = state.today.date === today ? state.today.done : 0;
  const home = () => setScreen({ name: "home" });

  const patchSettings = (patch: Partial<Settings>) => change((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  const startSession = (extra: boolean) => {
    const size = extra ? DAILY : Math.max(0, DAILY - doneToday);
    const queue = buildSession(content.items, state.states, today, state.settings.filter, size);
    setScreen({ name: "exercise", queue, extra });
  };

  const onAttempts = (list: Attempt[]) => {
    void addAttempts(list);
    setAttempts((prev) => [...prev, ...list]);
  };

  const onItemDone = (item: Item, outcome: Outcome, extra: boolean) =>
    change((prev) => {
      // The day is decided when the item finishes, not when the round started: a round that crosses midnight counts for the new day.
      const day = localDate();
      const states = { ...prev.states, [item.id]: nextState(prev.states[item.id], outcome, day) };
      const remaining = buildSession(content.items, states, day, prev.settings.filter, 1).length;
      const d = finishItem(prev, day, extra, remaining, DAILY);
      return { ...prev, states, today: d.today, completedDays: d.completedDays };
    });

  const onReport = (itemId: string) =>
    change((prev) =>
      prev.reports.some((r) => r.itemId === itemId) ? prev : { ...prev, reports: [...prev.reports, { itemId, at: new Date().toISOString() }] },
    );

  if (screen.name === "exercise") {
    return (
      <Exercise
        queue={screen.queue}
        rules={content.rules}
        lang={state.settings.lang}
        onLang={(lang) => patchSettings({ lang })}
        onAttempts={onAttempts}
        onItemDone={(item, outcome) => onItemDone(item, outcome, screen.extra)}
        onReport={onReport}
        onExit={home}
      />
    );
  }
  if (screen.name === "stats") {
    return <StatsScreen attempts={attempts} state={state} rules={content.rules} today={today} onBack={home} />;
  }
  if (screen.name === "settings") {
    return (
      <SettingsScreen
        state={state}
        attempts={attempts}
        rules={content.rules}
        today={today}
        onSettings={patchSettings}
        onImported={(s, a) => {
          setState(s);
          setAttempts(a);
        }}
        onBack={home}
      />
    );
  }
  const exhausted = buildSession(content.items, state.states, today, state.settings.filter, 1).length === 0;
  return (
    <Home
      doneToday={doneToday}
      daily={DAILY}
      complete={doneToday >= DAILY || state.completedDays.includes(today)}
      exhausted={exhausted}
      streak={streak(state.completedDays, today)}
      filter={state.settings.filter}
      onFilter={(filter) => patchSettings({ filter })}
      onStart={() => startSession(false)}
      onExtra={() => startSession(true)}
      onStats={() => setScreen({ name: "stats" })}
      onSettings={() => setScreen({ name: "settings" })}
    />
  );
}
