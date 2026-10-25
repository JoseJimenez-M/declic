import { describe, expect, it } from "vitest";
import { INTERVALS, isDue, nextState } from "../src/srs";

const TODAY = "2026-10-25";

describe("nextState", () => {
  it("moves a new item to box 2 on a pass", () => {
    expect(nextState(undefined, "pass", TODAY)).toEqual({ box: 2, due: "2026-10-28" });
  });
  it("keeps a new item in box 1 on near-fixed", () => {
    expect(nextState(undefined, "near-fixed", TODAY)).toEqual({ box: 1, due: "2026-10-26" });
  });
  it("caps at box 5", () => {
    expect(nextState({ box: 5, due: TODAY }, "pass", TODAY)).toEqual({ box: 5, due: "2026-11-24" });
  });
  it("keeps the box on near-fixed", () => {
    expect(nextState({ box: 3, due: TODAY }, "near-fixed", TODAY)).toEqual({ box: 3, due: "2026-11-01" });
  });
  it("resets to box 1 on fail", () => {
    expect(nextState({ box: 4, due: TODAY }, "fail", TODAY)).toEqual({ box: 1, due: "2026-10-26" });
  });
  it("uses the spec intervals", () => {
    expect(INTERVALS).toEqual({ 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 });
  });
});

describe("isDue", () => {
  it("is false for new items", () => {
    expect(isDue(undefined, TODAY)).toBe(false);
  });
  it("is true on or after the due date", () => {
    expect(isDue({ box: 2, due: TODAY }, TODAY)).toBe(true);
    expect(isDue({ box: 2, due: "2026-10-20" }, TODAY)).toBe(true);
    expect(isDue({ box: 2, due: "2026-10-26" }, TODAY)).toBe(false);
  });
});
