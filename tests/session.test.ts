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
