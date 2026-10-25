import type { Filter } from "../session";

type Props = {
  doneToday: number;
  daily: number;
  /** The day is done: 10 items were finished, or the day was marked complete. */
  complete: boolean;
  /** Nothing is left to practise today for the current filter. */
  exhausted: boolean;
  streak: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onStart: () => void;
  onExtra: () => void;
  onStats: () => void;
  onSettings: () => void;
};

export function Home(p: Props) {
  // Fewer than `daily` items done and nothing left: say so instead of claiming a full session.
  const noneLeft = p.exhausted && p.doneToday < p.daily;
  const title = noneLeft ? "No quedan frases pendientes hoy" : p.complete ? "Sesión de hoy completa" : `Hoy: ${p.doneToday} de ${p.daily}`;
  return (
    <main class="app">
      <header class="top">
        <h1>Déclic</h1>
        <span class="muted">Racha: {p.streak} {p.streak === 1 ? "día" : "días"}</span>
      </header>
      <section class="card">
        <p class="big">{title}</p>
        <label class="field">
          Tema
          <select value={p.filter} onChange={(e) => p.onFilter((e.target as HTMLSelectElement).value as Filter)}>
            <option value="all">Todo</option>
            <option value="past">Solo pasados</option>
            <option value="mood">Solo indicativo/subjuntivo</option>
          </select>
        </label>
        {p.exhausted ? null : p.complete ? (
          <button class="primary" onClick={p.onExtra}>{`Otra ronda de ${p.daily}`}</button>
        ) : (
          <button class="primary" onClick={p.onStart}>Empezar</button>
        )}
      </section>
      <nav class="row">
        <button onClick={p.onStats}>Estadísticas</button>
        <button onClick={p.onSettings}>Ajustes</button>
      </nav>
    </main>
  );
}
