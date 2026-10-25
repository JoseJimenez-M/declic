import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attempt } from "../src/flow";

let storage: typeof import("../src/storage");

beforeEach(async () => {
  globalThis.indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
  vi.resetModules();
  storage = await import("../src/storage");
});

const attempt = (at: string): Attempt => ({
  at,
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
  ms: 900,
});

describe("storage", () => {
  it("starts from the default state", async () => {
    const s = await storage.loadState();
    expect(s.settings).toEqual({ lang: "es", filter: "all" });
    expect(s.states).toEqual({});
    expect(s.today).toEqual({ date: "", done: 0 });
  });

  it("stores attempts and returns them in time order", async () => {
    await storage.addAttempts([attempt("2026-10-25T10:00:00.000Z"), attempt("2026-10-24T10:00:00.000Z")]);
    expect((await storage.loadAttempts()).map((a) => a.at)).toEqual(["2026-10-24T10:00:00.000Z", "2026-10-25T10:00:00.000Z"]);
  });

  it("round-trips the app state", async () => {
    const s = await storage.loadState();
    s.states["p1"] = { box: 3, due: "2026-11-01" };
    s.settings.lang = "fr";
    await storage.saveState(s);
    expect(await storage.loadState()).toEqual(s);
  });

  it("replaces data on import but keeps settings", async () => {
    await storage.addAttempts([attempt("2026-10-20T10:00:00.000Z")]);
    const s = await storage.loadState();
    s.settings.lang = "fr";
    await storage.saveState(s);
    await storage.replaceAll({
      app: "declic",
      version: 1,
      exportedAt: "2026-10-25T00:00:00.000Z",
      attempts: [attempt("2026-10-25T09:00:00.000Z")],
      states: { m1: { box: 2, due: "2026-10-28" } },
      completedDays: ["2026-10-25"],
      reports: [],
    });
    expect((await storage.loadAttempts()).map((a) => a.at)).toEqual(["2026-10-25T09:00:00.000Z"]);
    const after = await storage.loadState();
    expect(after.states).toEqual({ m1: { box: 2, due: "2026-10-28" } });
    expect(after.completedDays).toEqual(["2026-10-25"]);
    expect(after.settings.lang).toBe("fr");
  });
});
