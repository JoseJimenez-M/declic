import { describe, expect, it } from "vitest";
import { completeIfExhausted, finishItem, type Daily } from "../src/daily";

const DAY = "2026-10-25";
const YESTERDAY = "2026-10-24";
const DAILY = 10;

const at = (date: string, done: number, completedDays: string[] = []): Daily => ({ today: { date, done }, completedDays });

describe("finishItem", () => {
  it("counts a normal item without completing the day", () => {
    const next = finishItem(at(DAY, 3), DAY, false, 5, DAILY);
    expect(next).toEqual(at(DAY, 4));
  });

  it("completes the day on the 10th item, once", () => {
    const tenth = finishItem(at(DAY, 9), DAY, false, 5, DAILY);
    expect(tenth).toEqual(at(DAY, 10, [DAY]));
    const eleventh = finishItem(tenth, DAY, false, 5, DAILY);
    expect(eleventh.completedDays).toEqual([DAY]);
    expect(eleventh.today.done).toBe(11);
  });

  it("does not count an extra round on the same day", () => {
    const prev = at(DAY, 10, [DAY]);
    expect(finishItem(prev, DAY, true, 5, DAILY)).toBe(prev);
  });

  it("counts an extra round that started yesterday and finished today, and resets done", () => {
    const prev = at(YESTERDAY, 10, [YESTERDAY]);
    expect(finishItem(prev, DAY, true, 5, DAILY)).toEqual(at(DAY, 1, [YESTERDAY]));
  });

  it("counts every item of an extra round that finishes after midnight", () => {
    const first = finishItem(at(YESTERDAY, 10, [YESTERDAY]), DAY, true, 5, DAILY);
    expect(first).toEqual(at(DAY, 1, [YESTERDAY]));
    expect(finishItem(first, DAY, true, 5, DAILY)).toEqual(at(DAY, 2, [YESTERDAY]));
  });

  it("leaves the state unchanged for an extra-round item on a day that is already complete", () => {
    const prev = at(DAY, 3, [DAY]);
    expect(finishItem(prev, DAY, true, 5, DAILY)).toBe(prev);
  });

  it("resets done on a new day for a normal item", () => {
    expect(finishItem(at(YESTERDAY, 7), DAY, false, 5, DAILY)).toEqual(at(DAY, 1));
  });

  it("completes the day with fewer than 10 items when nothing remains", () => {
    expect(finishItem(at(DAY, 2), DAY, false, 0, DAILY)).toEqual(at(DAY, 3, [DAY]));
  });

  it("does not add the day twice when nothing remains on an already complete day", () => {
    const next = finishItem(at(DAY, 10, [DAY]), DAY, false, 0, DAILY);
    expect(next.completedDays).toEqual([DAY]);
  });

  it("does not mutate the previous value", () => {
    const prev = at(DAY, 9);
    finishItem(prev, DAY, false, 0, DAILY);
    expect(prev).toEqual(at(DAY, 9));
  });
});

describe("completeIfExhausted", () => {
  it("adds the day when nothing is available and the day is not complete", () => {
    expect(completeIfExhausted(at(DAY, 4), DAY, 0)).toEqual(at(DAY, 4, [DAY]));
  });

  it("sets today to the new day with done 0 when the stored day is older", () => {
    expect(completeIfExhausted(at(YESTERDAY, 7, [YESTERDAY]), DAY, 0)).toEqual({
      today: { date: DAY, done: 0 },
      completedDays: [YESTERDAY, DAY],
    });
  });

  it("returns the same object when items are still available", () => {
    const prev = at(DAY, 4);
    expect(completeIfExhausted(prev, DAY, 3)).toBe(prev);
  });

  it("returns the same object when the day is already complete", () => {
    const prev = at(DAY, 10, [DAY]);
    expect(completeIfExhausted(prev, DAY, 0)).toBe(prev);
  });
});
