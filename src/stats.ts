import type { Category } from "./checker";
import { addDays, localDate, weekStart } from "./dates";
import type { Attempt } from "./flow";
import type { CardState } from "./srs";

export type Ratio = { correct: number; total: number };
export type Band = "morning" | "afternoon" | "evening";
export type RankedFail = { key: string; fails: number; total: number };

export type Stats = {
  streak: number;
  mastered: number;
  accuracy7: Ratio;
  accuracy30: Ratio;
  byStep: Record<1 | 2 | 3, Ratio>;
  byKind: Record<"past" | "mood", Ratio>;
  topRules: RankedFail[];
  writingErrors: Record<Category | "far", number>;
  topVerbs: RankedFail[];
  byBand: Record<Band, Ratio>;
  byWeekday: Ratio[]; // index 0 = Monday
  weekly: { week: string; ratio: Ratio }[]; // last 8 weeks, oldest first
};

export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function bandOf(hour: number): Band {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

const isRight = (a: Attempt) => a.correct && !a.help;
const ratioOf = (list: Attempt[]): Ratio => ({ correct: list.filter(isRight).length, total: list.length });

function rankFails(list: Attempt[], key: (a: Attempt) => string): RankedFail[] {
  const map = new Map<string, RankedFail>();
  for (const a of list) {
    const k = key(a);
    const r = map.get(k) ?? { key: k, fails: 0, total: 0 };
    r.total += 1;
    if (!isRight(a)) r.fails += 1;
    map.set(k, r);
  }
  return [...map.values()]
    .filter((r) => r.fails > 0)
    .sort((x, y) => y.fails - x.fails || x.key.localeCompare(y.key))
    .slice(0, 5);
}

export function computeStats(attempts: Attempt[], states: Record<string, CardState>, completedDays: string[], today: string): Stats {
  const first = attempts.filter((a) => a.attempt === 1);
  const dayOf = (a: Attempt) => localDate(new Date(a.at));
  const within = (days: number) => first.filter((a) => dayOf(a) >= addDays(today, -(days - 1)));
  const inBand = (band: Band) => first.filter((a) => bandOf(new Date(a.at).getHours()) === band);

  const writingErrors: Record<Category | "far", number> = { accent: 0, agreement: 0, auxiliary: 0, ending: 0, stem: 0, other: 0, far: 0 };
  for (const a of attempts) if (a.step === 3 && a.category) writingErrors[a.category] += 1;

  const thisWeek = weekStart(today);
  return {
    streak: streak(completedDays, today),
    mastered: Object.values(states).filter((s) => s.box === 5).length,
    accuracy7: ratioOf(within(7)),
    accuracy30: ratioOf(within(30)),
    byStep: {
      1: ratioOf(first.filter((a) => a.step === 1)),
      2: ratioOf(first.filter((a) => a.step === 2)),
      3: ratioOf(first.filter((a) => a.step === 3)),
    },
    byKind: {
      past: ratioOf(first.filter((a) => a.kind === "past")),
      mood: ratioOf(first.filter((a) => a.kind === "mood")),
    },
    topRules: rankFails(first, (a) => a.ruleId),
    writingErrors,
    topVerbs: rankFails(first, (a) => a.verb),
    byBand: { morning: ratioOf(inBand("morning")), afternoon: ratioOf(inBand("afternoon")), evening: ratioOf(inBand("evening")) },
    byWeekday: [0, 1, 2, 3, 4, 5, 6].map((d) => ratioOf(first.filter((a) => (new Date(a.at).getDay() + 6) % 7 === d))),
    weekly: [7, 6, 5, 4, 3, 2, 1, 0].map((k) => {
      const week = addDays(thisWeek, -7 * k);
      return { week, ratio: ratioOf(first.filter((a) => weekStart(dayOf(a)) === week)) };
    }),
  };
}
