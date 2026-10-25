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
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const stats = computeStats(attempts, state.states, state.completedDays, today);
      const backup = buildBackup(
        { attempts, states: state.states, completedDays: state.completedDays, reports: state.reports },
        new Date().toISOString(),
      );
      await shareFiles([
        { name: `declic-stats-${today}.md`, content: statsMarkdown(stats, rules, state.reports, today), mime: "text/markdown" },
        { name: `declic-data-${today}.json`, content: JSON.stringify(backup), mime: "application/json" },
      ]);
      setMessage("Archivos listos para compartir.");
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      // Closing the share sheet is a choice, not an error.
      setMessage(/cancel/i.test(reason) ? "" : `No se pudo exportar: ${reason}`);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Esto reemplaza tus datos con el respaldo del ${backup.exportedAt.slice(0, 10)}. ¿Seguir?`)) return;
      await replaceAll(backup);
    } catch (e) {
      setMessage(`No se pudo importar: ${(e as Error).message}`);
      return;
    }
    try {
      onImported(await loadState(), await loadAttempts());
      setMessage("Respaldo importado.");
    } catch {
      setMessage("Respaldo importado; reinicia la app para ver los datos.");
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
        <button class="primary" disabled={busy} onClick={() => void exportAll()}>Exportar</button>
        <label class="field">
          Importar respaldo (JSON)
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const input = e.target as HTMLInputElement;
              const f = input.files?.[0];
              // Clearing the input lets the same file be picked again.
              if (f) void importFile(f).finally(() => (input.value = ""));
            }}
          />
        </label>
        {message && <p>{message}</p>}
      </section>
    </main>
  );
}
