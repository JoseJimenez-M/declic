import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, localDate, weekStart } from "../src/dates";

describe("dates", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-21")).toBe("2026-10-19");
  });
});

describe("localDate in a non-UTC zone", () => {
  beforeAll(() => {
    process.env.TZ = "America/Toronto";
  });
  afterAll(() => {
    process.env.TZ = "UTC";
  });

  it("uses the local calendar day, not the UTC one", () => {
    // 02:30 UTC on 2026-10-25 is still 22:30 on 2026-10-24 in Montreal (UTC-4 until 2026-11-01).
    expect(localDate(new Date("2026-10-25T02:30:00.000Z"))).toBe("2026-10-24");
  });
});
