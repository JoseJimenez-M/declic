import { describe, expect, it } from "vitest";
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
