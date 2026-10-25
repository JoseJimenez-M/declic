import type { Rule } from "./content/types";
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

export function parseBackup(json: string): Backup {
  const b = JSON.parse(json);
  const ok =
    b?.app === "declic" &&
    b.version === 1 &&
    typeof b.exportedAt === "string" &&
    Array.isArray(b.attempts) &&
    typeof b.states === "object" &&
    b.states !== null &&
    Array.isArray(b.completedDays) &&
    Array.isArray(b.reports);
  if (!ok) throw new Error("Archivo de respaldo no válido");
  return b as Backup;
}

const pct = (r: Ratio) => (r.total === 0 ? "n/a" : `${Math.round((100 * r.correct) / r.total)}% (${r.correct}/${r.total})`);

function table(head: string[], rows: string[][]): string[] {
  if (rows.length === 0) return ["None."];
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
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
    ...(reports.length === 0 ? ["None."] : reports.map((r) => `- \`${r.itemId}\` (${r.at.slice(0, 10)})`)),
    "",
  ].join("\n");
}
