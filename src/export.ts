import type { Rule } from "./content/types";
import { localDate } from "./dates";
import type { Attempt } from "./flow";
import type { CardState } from "./srs";
import type { Ratio, Stats } from "./stats";

export type Report = { itemId: string; at: string };

export type Backup = {
  app: "declic";
  version: 1;
  exportedAt: string;
  attempts: Attempt[];
  states: Record<string, CardState>;
  completedDays: string[];
  reports: Report[];
};

export function buildBackup(data: Omit<Backup, "app" | "version" | "exportedAt">, exportedAt: string): Backup {
  return { app: "declic", version: 1, exportedAt, ...data };
}

const BAD = "Archivo de respaldo no válido";
const bad = (why?: string) => new Error(why ? `${BAD}: ${why}` : BAD);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: readonly unknown[] = ["accent", "agreement", "auxiliary", "ending", "stem", "other", "far"];

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isDay = (v: unknown) => typeof v === "string" && DATE.test(v);
const isTime = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isId = (v: unknown) => typeof v === "string" && v !== "";

const isCardState = (v: unknown) => isObject(v) && isInt(v.box, 1, 5) && isDay(v.due);
const isReport = (v: unknown) => isObject(v) && isId(v.itemId) && isTime(v.at);
const isAttempt = (v: unknown) =>
  isObject(v) &&
  isTime(v.at) &&
  isId(v.itemId) &&
  isInt(v.slot, 0, Infinity) &&
  (v.kind === "past" || v.kind === "mood") &&
  typeof v.verb === "string" &&
  typeof v.ruleId === "string" &&
  (v.step === 1 || v.step === 2 || v.step === 3) &&
  typeof v.chosen === "string" &&
  typeof v.correct === "boolean" &&
  (v.attempt === 1 || v.attempt === 2) &&
  typeof v.help === "boolean" &&
  typeof v.ms === "number" &&
  Number.isFinite(v.ms) &&
  v.ms >= 0 &&
  (v.category === undefined || CATEGORIES.includes(v.category));

/** `what` is the singular Spanish name of an element; it names the first bad one, e.g. "intento 3". */
function checkList(list: unknown, ok: (v: unknown) => boolean, what: string): void {
  if (!Array.isArray(list)) throw bad(`${what}s`);
  const i = list.findIndex((v) => !ok(v));
  if (i >= 0) throw bad(`${what} ${i + 1}`);
}

/** Rejects anything that could crash the app later, before the caller replaces any data. */
export function parseBackup(json: string): Backup {
  let b: unknown;
  try {
    b = JSON.parse(json);
  } catch {
    throw bad("no es JSON");
  }
  if (!isObject(b) || b.app !== "declic" || b.version !== 1 || !isTime(b.exportedAt)) throw bad();
  if (!isObject(b.states) || !Object.values(b.states).every(isCardState)) throw bad("estados");
  checkList(b.attempts, isAttempt, "intento");
  checkList(b.completedDays, isDay, "día");
  checkList(b.reports, isReport, "reporte");
  return b as unknown as Backup;
}

const pct = (r: Ratio) => (r.total === 0 ? "n/a" : `${Math.round((100 * r.correct) / r.total)}% (${r.correct}/${r.total})`);

/** A pipe inside a cell would split the Markdown table row. */
const escapeCell = (s: string) => s.replace(/\|/g, "\\|");

function table(head: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ["None."];
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`)];
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function statsMarkdown(stats: Stats, rules: Map<string, Rule>, reports: Report[], today: string): string {
  const ruleName = (id: string) => rules.get(id)?.title.fr ?? id;
  return [
    "---",
    "type: note",
    "status: active",
    `created: ${today}`,
    `updated: ${today}`,
    "tags: [topic/personal-growth]",
    "---",
    "",
    `# Déclic stats ${today}`,
    "",
    "Exported from the Déclic app. Accuracy counts first tries; Help counts as wrong.",
    "",
    "## Summary",
    "",
    ...table(["Metric", "Value"], [
      ["Streak", `${stats.streak} days`],
      ["Items mastered (box 5)", String(stats.mastered)],
      ["Accuracy, last 7 days", pct(stats.accuracy7)],
      ["Accuracy, last 30 days", pct(stats.accuracy30)],
    ]),
    "",
    "## By step",
    "",
    ...table(["Step", "Accuracy"], [
      ["1. Choose tense or mood", pct(stats.byStep[1])],
      ["2. Auxiliary or stem", pct(stats.byStep[2])],
      ["3. Typing", pct(stats.byStep[3])],
    ]),
    "",
    "## By pair",
    "",
    ...table(["Pair", "Accuracy"], [
      ["Passé composé versus imparfait", pct(stats.byKind.past)],
      ["Indicatif versus subjonctif", pct(stats.byKind.mood)],
    ]),
    "",
    "## Most failed rules",
    "",
    ...table(["Rule", "Fails", "Seen"], stats.topRules.map((r) => [`${r.key} (${ruleName(r.key)})`, String(r.fails), String(r.total)])),
    "",
    "## Writing errors",
    "",
    ...table(["Category", "Count"], Object.entries(stats.writingErrors).map(([k, v]) => [k, String(v)])),
    "",
    "## Most failed verbs",
    "",
    ...table(["Verb", "Fails", "Seen"], stats.topVerbs.map((v) => [v.key, String(v.fails), String(v.total)])),
    "",
    "## When",
    "",
    ...table(["Time band", "Accuracy"], [
      ["Morning (5 to 12 h)", pct(stats.byBand.morning)],
      ["Afternoon (12 to 18 h)", pct(stats.byBand.afternoon)],
      ["Evening (18 to 5 h)", pct(stats.byBand.evening)],
    ]),
    "",
    ...table(["Weekday", "Accuracy"], stats.byWeekday.map((r, i) => [WEEKDAYS[i], pct(r)])),
    "",
    "## Weekly trend",
    "",
    ...table(["Week of", "Accuracy"], stats.weekly.map((w) => [w.week, pct(w.ratio)])),
    "",
    "## Reported sentences",
    "",
    ...(reports.length === 0 ? ["None."] : reports.map((r) => `- \`${r.itemId}\` (${localDate(new Date(r.at))})`)),
    "",
  ].join("\n");
}
