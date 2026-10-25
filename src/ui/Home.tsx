import type { Filter } from "../session";

type Props = {
  doneToday: number;
  daily: number;
  streak: number;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onStart: () => void;
  onExtra: () => void;
  onStats: () => void;
  onSettings: () => void;
};

export function Home(p: Props) {
  const complete = p.doneToday >= p.daily;
  return (
    <main class="app">
      <header class="top">
        <h1>Déclic</h1>
        <span class="muted">Racha: {p.streak} {p.streak === 1 ? "día" : "días"}</span>
      </header>
      <section class="card">
        <p class="big">{complete ? "Sesión de hoy completa" : `Hoy: ${p.doneToday} de ${p.daily}`}</p>
        <label class="field">
          Tema
          <select value={p.filter} onChange={(e) => p.onFilter((e.target as HTMLSelectElement).value as Filter)}>
            <option value="all">Todo</option>
            <option value="past">Solo pasados</option>
            <option value="mood">Solo subjuntivo</option>
          </select>
        </label>
        {complete ? (
          <button class="primary" onClick={p.onExtra}>Otra ronda de 10</button>
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
