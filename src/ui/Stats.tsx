import type { Rule } from "../content/types";
import type { Attempt } from "../flow";
import { computeStats, type Ratio } from "../stats";
import type { AppState } from "../storage";

type Props = { attempts: Attempt[]; state: AppState; rules: Map<string, Rule>; today: string; onBack: () => void };

const pct = (r: Ratio) => (r.total === 0 ? 0 : Math.round((100 * r.correct) / r.total));
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ERROR_LABELS: Record<string, string> = {
  accent: "Acentos",
  agreement: "Concordancia",
  auxiliary: "Auxiliar",
  ending: "Terminación",
  stem: "Raíz",
  other: "Ortografía",
  far: "Lejos",
};

function Bar({ label, ratio }: { label: string; ratio: Ratio }) {
  return (
    <div class="bar">
      <span>{label}</span>
      <span class="bar-track">
        <span class="bar-fill" style={{ width: `${pct(ratio)}%` }} />
      </span>
      <span class="bar-value">{ratio.total === 0 ? "-" : `${pct(ratio)}%`}</span>
    </div>
  );
}

export function StatsScreen({ attempts, state, rules, today, onBack }: Props) {
  const s = computeStats(attempts, state.states, state.completedDays, today);
  const lang = state.settings.lang;
  const errors = Object.entries(s.writingErrors).filter(([, n]) => n > 0);
  return (
    <main class="app">
      <header class="top">
        <h1>Estadísticas</h1>
        <button class="ghost" onClick={onBack}>Volver</button>
      </header>
      <section class="card">
        <h2>Resumen</h2>
        <p>Racha: {s.streak} {s.streak === 1 ? "día" : "días"}. Dominadas: {s.mastered}.</p>
        <Bar label="Últimos 7 días" ratio={s.accuracy7} />
        <Bar label="Últimos 30 días" ratio={s.accuracy30} />
      </section>
      <section class="card">
        <h2>En qué</h2>
        <Bar label="Elegir tiempo o modo" ratio={s.byStep[1]} />
        <Bar label="Auxiliar o raíz" ratio={s.byStep[2]} />
        <Bar label="Escritura" ratio={s.byStep[3]} />
        <Bar label="PC vs. imparfait" ratio={s.byKind.past} />
        <Bar label="Ind. vs. subj." ratio={s.byKind.mood} />
      </section>
      <section class="card">
        <h2>Por qué</h2>
        {s.topRules.length === 0 && <p class="muted">Todavía no hay fallos.</p>}
        {s.topRules.map((r) => {
          const rule = rules.get(r.key);
          return (
            <details key={r.key}>
              <summary>{rule ? rule.title[lang] : r.key}: {r.fails} de {r.total}</summary>
              {rule && <p>{rule.explanation[lang]}</p>}
              {rule?.trap && <p class="trap">{rule.trap[lang]}</p>}
            </details>
          );
        })}
        <h2>Errores al escribir</h2>
        {errors.length === 0 ? <p class="muted">Ninguno todavía.</p> : errors.map(([k, n]) => <p key={k}>{ERROR_LABELS[k]}: {n}</p>)}
      </section>
      <section class="card">
        <h2>Verbos</h2>
        {s.topVerbs.length === 0 ? <p class="muted">Todavía no hay fallos.</p> : s.topVerbs.map((v) => <p key={v.key}>{v.key}: {v.fails} de {v.total}</p>)}
      </section>
      <section class="card">
        <h2>Cuándo</h2>
        <Bar label="Mañana" ratio={s.byBand.morning} />
        <Bar label="Tarde" ratio={s.byBand.afternoon} />
        <Bar label="Noche" ratio={s.byBand.evening} />
        {s.byWeekday.map((r, i) => <Bar key={WEEKDAYS[i]} label={WEEKDAYS[i]} ratio={r} />)}
        <h2>Por semana</h2>
        {s.weekly.map((w) => <Bar key={w.week} label={w.week.slice(5)} ratio={w.ratio} />)}
      </section>
    </main>
  );
}
