import { useState } from "preact/hooks";
import type { Rule } from "../content/types";
import { localDate } from "../dates";
import { buildBackup, parseBackup, statsMarkdown, type Backup } from "../export";
import type { Attempt } from "../flow";
import { shareFiles } from "../share";
import { computeStats } from "../stats";
import { loadAttempts, replaceAll, type AppState, type Settings } from "../storage";

type Props = {
  state: AppState;
  attempts: Attempt[];
  rules: Map<string, Rule>;
  today: string;
  onSettings: (patch: Partial<Settings>) => void;
  onImported: (state: AppState, attempts: Attempt[]) => void;
  onBack: () => void;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
      const reason = errorText(e);
      // Closing the share sheet is a choice, not an error.
      setMessage(/cancel/i.test(reason) ? "" : `No se pudo exportar: ${reason}`);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    let backup: Backup;
    let written: AppState;
    try {
      backup = parseBackup(await file.text());
      if (!confirm(`Esto reemplaza tus datos con el respaldo del ${localDate(new Date(backup.exportedAt))}. ¿Seguir?`)) return;
      written = await replaceAll(backup);
    } catch (e) {
      setMessage(`No se pudo importar: ${errorText(e)}`);
      return;
    }
    // The import is committed: the app must show what was written, or its next save would overwrite the import.
    let attempts = backup.attempts;
    try {
      attempts = await loadAttempts();
    } catch {
      // The backup's attempts are what was written, so they stand in for the reload.
    }
    onImported(written, attempts);
    setMessage("Respaldo importado.");
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
            accept="application/json,.json,text/plain,application/octet-stream"
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
