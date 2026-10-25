import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Attempt } from "../src/flow";
import { bandOf, computeStats, streak } from "../src/stats";

const TODAY = "2026-10-25"; // Sunday; tests run in UTC

const at = (iso: string, over: Partial<Attempt> = {}): Attempt => ({
  at: iso,
  itemId: "p1",
  slot: 0,
  kind: "past",
  verb: "lire",
  ruleId: "IMP-habit",
  step: 1,
  chosen: "imp",
  correct: true,
  attempt: 1,
  help: false,
  ms: 1000,
  ...over,
});

const attempts: Attempt[] = [
  at("2026-10-25T09:00:00.000Z"),
  at("2026-10-24T13:00:00.000Z", { correct: false, ruleId: "IMP-ongoing-interrupted", verb: "arriver" }),
  at("2026-10-20T19:00:00.000Z", { help: true, correct: false, ruleId: "IMP-ongoing-interrupted" }),
  at("2026-10-01T09:00:00.000Z"),
  at("2026-10-25T09:05:00.000Z", { step: 3, attempt: 2, correct: true }),
  at("2026-10-25T09:04:00.000Z", { step: 3, correct: false, category: "ending", verb: "arriver", ruleId: "PC-sequence" }),
];

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    expect(streak(["2026-10-23", "2026-10-24", "2026-10-25"], TODAY)).toBe(3);
  });
  it("still counts from yesterday when today is not done yet", () => {
    expect(streak(["2026-10-23", "2026-10-24"], TODAY)).toBe(2);
  });
  it("is zero after a missed day", () => {
    expect(streak(["2026-10-22"], TODAY)).toBe(0);
  });
});

describe("bandOf", () => {
  it("splits the day in three", () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(bandOf)).toEqual(["evening", "morning", "morning", "afternoon", "afternoon", "evening", "evening"]);
  });
});

describe("computeStats", () => {
  const s = computeStats(attempts, { a: { box: 5, due: TODAY }, b: { box: 4, due: TODAY }, c: { box: 5, due: TODAY } }, [], TODAY);

  it("counts mastered items", () => {
    expect(s.mastered).toBe(2);
  });
  it("computes first-try accuracy over 7 and 30 days, Help counting as wrong", () => {
    expect(s.accuracy7).toEqual({ correct: 1, total: 4 });
    expect(s.accuracy30).toEqual({ correct: 2, total: 5 });
  });
  it("splits by step and kind", () => {
    expect(s.byStep[1]).toEqual({ correct: 2, total: 4 });
    expect(s.byStep[2]).toEqual({ correct: 0, total: 0 });
    expect(s.byStep[3]).toEqual({ correct: 0, total: 1 });
    expect(s.byKind.past).toEqual({ correct: 2, total: 5 });
    expect(s.byKind.mood).toEqual({ correct: 0, total: 0 });
  });
  it("ranks failed rules and verbs", () => {
    expect(s.topRules).toEqual([
      { key: "IMP-ongoing-interrupted", fails: 2, total: 2 },
      { key: "PC-sequence", fails: 1, total: 1 },
    ]);
    expect(s.topVerbs).toEqual([
      { key: "arriver", fails: 2, total: 2 },
      { key: "lire", fails: 1, total: 3 },
    ]);
  });
  it("counts writing error categories", () => {
    expect(s.writingErrors).toEqual({ accent: 0, agreement: 0, auxiliary: 0, ending: 1, stem: 0, other: 0, far: 0 });
  });
  it("splits by time band and weekday", () => {
    expect(s.byBand).toEqual({
      morning: { correct: 2, total: 3 },
      afternoon: { correct: 0, total: 1 },
      evening: { correct: 0, total: 1 },
    });
    expect(s.byWeekday[6]).toEqual({ correct: 1, total: 2 }); // Sunday
    expect(s.byWeekday[3]).toEqual({ correct: 1, total: 1 }); // Thursday 2026-10-01
  });
  it("builds an 8-week trend, oldest first", () => {
    expect(s.weekly).toHaveLength(8);
    expect(s.weekly[7]).toEqual({ week: "2026-10-19", ratio: { correct: 1, total: 4 } });
    expect(s.weekly[4]).toEqual({ week: "2026-09-28", ratio: { correct: 1, total: 1 } });
    expect(s.weekly[0].week).toBe("2026-08-31");
  });
});

const statsOf = (list: Attempt[], today: string) => computeStats(list, {}, [], today);

describe("computeStats in a non-UTC zone", () => {
  beforeAll(() => {
    process.env.TZ = "America/Toronto";
  });
  afterAll(() => {
    process.env.TZ = "UTC";
  });

  // Toronto is UTC-4 until 2026-11-01. All three attempts below fall on Saturday 2026-10-24 locally. The morning and
  // afternoon ones land in a different band under UTC (a local evening is always a UTC evening, so it cannot tell them apart).
  it("uses local time for band, weekday and week", () => {
    const s = statsOf(
      [
        at("2026-10-25T02:30:00.000Z"), // Sat 22:30 local, Sun 02:30 UTC
        at("2026-10-24T12:30:00.000Z"), // Sat 08:30 local (morning), 12:30 UTC (afternoon)
        at("2026-10-24T18:30:00.000Z"), // Sat 14:30 local (afternoon), 18:30 UTC (evening)
      ],
      "2026-10-31",
    );
    expect(s.byBand).toEqual({
      morning: { correct: 1, total: 1 },
      afternoon: { correct: 1, total: 1 },
      evening: { correct: 1, total: 1 },
    });
    expect(s.byWeekday[5]).toEqual({ correct: 3, total: 3 }); // Saturday
    expect(s.byWeekday[6]).toEqual({ correct: 0, total: 0 }); // not Sunday, as UTC would say for the first one
    expect(s.weekly[6]).toEqual({ week: "2026-10-19", ratio: { correct: 3, total: 3 } });
  });

  it("puts a Sunday-night attempt in the week that is ending locally", () => {
    // Sun 2026-10-25 22:30 local is Mon 2026-10-26 02:30 UTC, which would start the next week.
    const s = statsOf([at("2026-10-26T02:30:00.000Z")], "2026-10-31");
    expect(s.weekly[6]).toEqual({ week: "2026-10-19", ratio: { correct: 1, total: 1 } });
    expect(s.weekly[7]).toEqual({ week: "2026-10-26", ratio: { correct: 0, total: 0 } });
    expect(s.byWeekday[6]).toEqual({ correct: 1, total: 1 });
    expect(s.byWeekday[0]).toEqual({ correct: 0, total: 0 });
  });

  it("measures the 7-day window in local days", () => {
    // Today 2026-10-31: the window starts on 2026-10-25 (day -6).
    const s = statsOf(
      [
        at("2026-10-25T03:30:00.000Z"), // local 2026-10-24 (day -7): outside, although 2026-10-25 in UTC
        at("2026-10-25T16:00:00.000Z"), // local 2026-10-25 (day -6): inside
      ],
      "2026-10-31",
    );
    expect(s.accuracy7).toEqual({ correct: 1, total: 1 });
    expect(s.accuracy30).toEqual({ correct: 2, total: 2 });
  });
});

describe("computeStats window edges", () => {
  it("includes day -6 and excludes day -7 in the 7-day window", () => {
    const s = statsOf(
      [
        at("2026-10-19T12:00:00.000Z"), // day -6, right
        at("2026-10-18T12:00:00.000Z", { correct: false }), // day -7, wrong
      ],
      TODAY,
    );
    expect(s.accuracy7).toEqual({ correct: 1, total: 1 });
    expect(s.accuracy30).toEqual({ correct: 1, total: 2 });
  });

  it("includes day -29 and excludes day -30 in the 30-day window", () => {
    const s = statsOf(
      [
        at("2026-09-26T12:00:00.000Z"), // day -29, right
        at("2026-09-25T12:00:00.000Z", { correct: false }), // day -30, wrong
      ],
      TODAY,
    );
    expect(s.accuracy30).toEqual({ correct: 1, total: 1 });
    expect(s.accuracy7).toEqual({ correct: 0, total: 0 });
  });
});

describe("computeStats ranking", () => {
  const failed = (ruleId: string, times: number) => Array.from({ length: times }, () => at("2026-10-25T09:00:00.000Z", { correct: false, ruleId }));

  it("keeps only the five most failed rules", () => {
    // Names sort in the opposite order to the fail counts, so only a sort by fails gives this result.
    const list = [1, 2, 3, 4, 5, 6].flatMap((n) => failed(`rule-${n}-fails`, n));
    const keys = statsOf(list, TODAY).topRules.map((r) => r.key);
    expect(keys).toEqual(["rule-6-fails", "rule-5-fails", "rule-4-fails", "rule-3-fails", "rule-2-fails"]);
    expect(keys).not.toContain("rule-1-fails");
  });

  it("orders rules with equal fails alphabetically by key", () => {
    // Inserted in reverse alphabetical order, so insertion order alone would give the wrong result.
    const list = [...failed("PC-sequence", 2), ...failed("IMP-habit", 2)];
    expect(statsOf(list, TODAY).topRules).toEqual([
      { key: "IMP-habit", fails: 2, total: 2 },
      { key: "PC-sequence", fails: 2, total: 2 },
    ]);
  });
});
