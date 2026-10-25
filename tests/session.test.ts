import { describe, expect, it } from "vitest";
import type { Item } from "../src/content/types";
import { alternateKinds, buildSession, interleave } from "../src/session";
import { moodSubj, pastItem } from "./fixtures";

const mk = (id: string, kind: "past" | "mood", context: "daily" | "exam"): Item =>
  kind === "past" ? { ...pastItem, id, context } : { ...moodSubj, id, context };

const bank: Item[] = [
  mk("p1", "past", "daily"),
  mk("p2", "past", "exam"),
  mk("p3", "past", "daily"),
  mk("m1", "mood", "daily"),
  mk("m2", "mood", "exam"),
  mk("m3", "mood", "daily"),
];
const ids = (items: Item[]) => items.map((i) => i.id);
const TODAY = "2026-10-25";

describe("buildSession", () => {
  it("puts due items first, most overdue first, then fills with new items", () => {
    const states = {
      p3: { box: 2 as const, due: "2026-10-20" },
      m3: { box: 1 as const, due: "2026-10-24" },
      p1: { box: 3 as const, due: "2026-10-30" },
    };
    expect(ids(buildSession(bank, states, TODAY, "all", 4))).toEqual(["p3", "m3", "p2", "m1"]);
  });

  it("caps the session at the requested size", () => {
    expect(buildSession(bank, {}, TODAY, "all", 3)).toHaveLength(3);
  });

  it("applies the filter", () => {
    expect(ids(buildSession(bank, {}, TODAY, "mood", 10))).toEqual(["m1", "m2", "m3"]);
  });

  it("returns nothing when the bank is exhausted and nothing is due", () => {
    const states = Object.fromEntries(bank.map((i) => [i.id, { box: 2 as const, due: "2026-11-01" }]));
    expect(buildSession(bank, states, TODAY, "all", 10)).toEqual([]);
  });
});

describe("ordering helpers", () => {
  it("interleaves kinds and contexts", () => {
    expect(ids(interleave(bank))).toEqual(["p1", "m1", "p2", "m2", "p3", "m3"]);
  });

  it("alternates kinds, keeping order within each kind", () => {
    expect(ids(alternateKinds([bank[0], bank[1], bank[2], bank[3]]))).toEqual(["p1", "m1", "p2", "p3"]);
  });
});

describe("session cap and mixing", () => {
  const dueIn = (item: Item, due: string) => [item.id, { box: 2 as const, due }] as const;

  it("keeps only the most overdue items when more are due than the size", () => {
    // Overdue order: dp1, dm1, dp2, dm2, ... dp6, dm6 (dp1 is the most overdue).
    const due: Item[] = [];
    for (let n = 1; n <= 6; n++) due.push(mk(`dp${n}`, "past", "daily"), mk(`dm${n}`, "mood", "daily"));
    const states = Object.fromEntries(due.map((item, n) => dueIn(item, `2026-10-${String(n + 1).padStart(2, "0")}`)));
    const fresh = [mk("np1", "past", "daily"), mk("nm1", "mood", "daily"), mk("np2", "past", "exam")];
    const result = ids(buildSession([...fresh, ...due], states, TODAY, "all", 10));
    const mostOverdue = due.slice(0, 10).map((i) => i.id);
    expect(result).toHaveLength(10);
    expect([...result].sort()).toEqual([...mostOverdue].sort());
    expect(result).not.toContain("dp6");
    expect(result).not.toContain("dm6");
    expect(result.some((id) => id.startsWith("n"))).toBe(false);
  });

  it("admits every due item before any new item, then alternates kinds", () => {
    const due = [mk("dp1", "past", "daily"), mk("dm1", "mood", "daily"), mk("dp2", "past", "exam")];
    const fresh = [mk("np1", "past", "daily"), mk("nm1", "mood", "daily"), mk("np2", "past", "daily"), mk("nm2", "mood", "daily")];
    const states = {
      dp1: { box: 1 as const, due: "2026-10-20" },
      dm1: { box: 1 as const, due: "2026-10-21" },
      dp2: { box: 1 as const, due: "2026-10-22" },
    };
    // New items come first in the bank on purpose, so bank order cannot explain the result.
    const result = buildSession([...fresh, ...due], states, TODAY, "all", 5);
    expect(new Set(ids(result))).toEqual(new Set(["dp1", "dm1", "dp2", "np1", "nm1"]));
    expect(result.map((i) => i.kind)).toEqual(["past", "mood", "past", "mood", "past"]);
  });

  it("returns nothing for size 0 or an empty bank", () => {
    const states = { p1: { box: 1 as const, due: "2026-10-20" } };
    expect(buildSession(bank, {}, TODAY, "all", 0)).toEqual([]);
    expect(buildSession(bank, states, TODAY, "all", 0)).toEqual([]);
    expect(buildSession([], {}, TODAY, "all", 10)).toEqual([]);
    expect(buildSession([], states, TODAY, "all", 10)).toEqual([]);
  });
});

describe("interleave with an unknown context", () => {
  it("terminates and leaves the unplaceable item out", () => {
    const stray: Item = { ...pastItem, id: "stray", context: "weird" as unknown as Item["context"] };
    expect(ids(interleave([...bank, stray]))).toEqual(["p1", "m1", "p2", "m2", "p3", "m3"]);
  });
});
