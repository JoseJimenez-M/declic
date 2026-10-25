import { useState } from "preact/hooks";
import type { Rule } from "../content/types";
import { buildBackup, parseBackup, statsMarkdown } from "../export";
import type { Attempt } from "../flow";
import { shareFiles } from "../share";
import { computeStats } from "../stats";
import { loadAttempts, loadState, replaceAll, type AppState, type Settings } from "../storage";

type Props = {
  state: AppState;
  attempts: Attempt[];
  rules: Map<string, Rule>;
  today: string;
  onSettings: (patch: Partial<Settings>) => void;
  onImported: (state: AppState, attempts: Attempt[]) => void;
  onBack: () => void;
};

export function SettingsScreen({ state, attempts, rules, today, onSettings, onImported, onBack }: Props) {
  const [message, setMessage] = useState("");

  const exportAll = async () => {
    const stats = computeStats(attempts, state.states, state.completedDays, today);
    const backup = buildBackup(
      { attempts, states: state.states, completedDays: state.completedDays, reports: state.reports },
      new Date().toISOString(),
    );
    try {
      await shareFiles([
        { name: `declic-stats-${today}.md`, content: statsMarkdown(stats, rules, state.reports, today), mime: "text/markdown" },
        { name: `declic-data-${today}.json`, content: JSON.stringify(backup), mime: "application/json" },
      ]);
      setMessage("Exportado.");
    } catch (e) {
      setMessage(`No se pudo exportar: ${(e as Error).message}`);
    }
  };

  const importFile = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Esto reemplaza tus datos con el respaldo del ${backup.exportedAt.slice(0, 10)}. ¿Seguir?`)) return;
      await replaceAll(backup);
      onImported(await loadState(), await loadAttempts());
      setMessage("Respaldo importado.");
    } catch (e) {
      setMessage(`No se pudo importar: ${(e as Error).message}`);
    }
  };

  return (
    <main class="app">
      <header class="top">
        <h1>Ajustes</h1>
        <button class="ghost" onClick={onBack}>Volver</button>
      </header>
      <section class="card">
        <label class="field">
          Idioma de las explicaciones
          <select value={state.settings.lang} onChange={(e) => onSettings({ lang: (e.target as HTMLSelectElement).value as "es" | "fr" })}>
            <option value="es">Español</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </section>
      <section class="card">
        <h2>Datos</h2>
        <p class="muted">Exportar crea el resumen en Markdown para Cortex y el respaldo completo en JSON.</p>
        <button class="primary" onClick={() => void exportAll()}>Exportar</button>
        <label class="field">
          Importar respaldo (JSON)
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) void importFile(f);
            }}
          />
        </label>
        {message && <p>{message}</p>}
      </section>
    </main>
  );
}
