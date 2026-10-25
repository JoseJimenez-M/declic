import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Backup } from "../src/export";
import type { Attempt } from "../src/flow";
import type { AppState } from "../src/storage";

let storage: typeof import("../src/storage");

beforeEach(async () => {
  globalThis.indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
  vi.resetModules();
  storage = await import("../src/storage");
});

afterEach(() => {
  vi.restoreAllMocks();
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
    // Seeded newest first, so storing order is the reverse of time order.
    await storage.addAttempts([attempt("2026-10-26T10:00:00.000Z"), attempt("2026-10-25T10:00:00.000Z"), attempt("2026-10-24T10:00:00.000Z")]);
    expect((await storage.loadAttempts()).map((a) => a.at)).toEqual([
      "2026-10-24T10:00:00.000Z",
      "2026-10-25T10:00:00.000Z",
      "2026-10-26T10:00:00.000Z",
    ]);
  });

  it("keeps two attempts that share the same timestamp", async () => {
    await storage.addAttempts([attempt("2026-10-25T10:00:00.000Z"), { ...attempt("2026-10-25T10:00:00.000Z"), slot: 1 }]);
    expect((await storage.loadAttempts()).map((a) => a.slot).sort()).toEqual([0, 1]);
  });

  it("adding no attempts does nothing", async () => {
    const open = vi.spyOn(globalThis.indexedDB, "open");
    await storage.addAttempts([]);
    expect(open).not.toHaveBeenCalled();
    expect(await storage.loadAttempts()).toEqual([]);
  });

  it("uses one database with an attempts store and a state store", async () => {
    await storage.addAttempts([attempt("2026-10-25T10:00:00.000Z")]);
    await storage.saveState(await storage.loadState());
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("declic");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames].sort()).toEqual(["attempts", "state"]);
    db.close();
  });

  it("opens the database again after a failed open", async () => {
    globalThis.indexedDB = {
      open() {
        const req = {} as IDBOpenDBRequest;
        setTimeout(() => {
          Object.defineProperty(req, "error", { value: new Error("boom") });
          req.onerror?.(new Event("error"));
        });
        return req;
      },
    } as unknown as IDBFactory;
    await expect(storage.loadState()).rejects.toThrow("boom");
    globalThis.indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
    expect((await storage.loadState()).settings.lang).toBe("es");
  });

  describe("closed connections", () => {
    it("reopens the database after another tab deletes it", async () => {
      await storage.saveState({ ...(await storage.loadState()), settings: { lang: "fr", filter: "past" } });
      // A versionchange handler that does not close the connection would leave the delete blocked.
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("declic");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("the connection did not close on versionchange"));
      });
      expect((await storage.loadState()).settings).toEqual({ lang: "es", filter: "all" });
      await storage.addAttempts([attempt("2026-10-25T10:00:00.000Z")]);
      expect(await storage.loadAttempts()).toHaveLength(1);
    });

    it("reopens the database after the browser closes the connection", async () => {
      const real = indexedDB.open.bind(indexedDB);
      let db: IDBDatabase | undefined;
      vi.spyOn(globalThis.indexedDB, "open").mockImplementation((name, version) => {
        const req = real(name, version);
        req.addEventListener("success", () => (db = req.result));
        return req;
      });
      await storage.loadState();
      expect(db).toBeDefined();
      // A forced close fires `close` on the connection; closing it by hand stands in for the browser doing so.
      db!.close();
      db!.onclose?.(new Event("close"));
      expect((await storage.loadState()).settings.lang).toBe("es");
    });
  });

  it("fills in the default filter for a state saved before the filter existed", async () => {
    const base = await storage.loadState();
    const older = { ...base, settings: { lang: "fr" } } as unknown as AppState;
    await storage.saveState(older);
    expect((await storage.loadState()).settings).toEqual({ lang: "fr", filter: "all" });
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

  describe("replaceAll", () => {
    const seed = async () => {
      const s = await storage.loadState();
      s.states = { old: { box: 4, due: "2026-11-01" } };
      s.completedDays = ["2026-10-01"];
      s.reports = [{ itemId: "old-item", at: "2026-10-02T10:00:00.000Z" }];
      s.settings = { lang: "fr", filter: "past" };
      s.today = { date: "2026-10-20", done: 4 };
      await storage.saveState(s);
      await storage.addAttempts([attempt("2026-10-02T10:00:00.000Z")]);
      return s;
    };
    const backup = (attempts: Attempt[]): Backup => ({
      app: "declic",
      version: 1,
      exportedAt: "2026-10-25T00:00:00.000Z",
      attempts,
      states: { fresh: { box: 2, due: "2026-10-28" } },
      completedDays: ["2026-10-25"],
      reports: [{ itemId: "fresh-item", at: "2026-10-25T08:00:00.000Z" }],
    });

    it("swaps states, days and reports, and keeps settings and today", async () => {
      const before = await seed();
      await storage.replaceAll(backup([attempt("2026-10-25T09:00:00.000Z")]));
      const after = await storage.loadState();
      expect(after.states).toEqual({ fresh: { box: 2, due: "2026-10-28" } });
      expect(after.completedDays).toEqual(["2026-10-25"]);
      expect(after.reports).toEqual([{ itemId: "fresh-item", at: "2026-10-25T08:00:00.000Z" }]);
      expect(after.settings).toEqual(before.settings);
      expect(after.today).toEqual(before.today);
      expect((await storage.loadAttempts()).map((a) => a.at)).toEqual(["2026-10-25T09:00:00.000Z"]);
    });

    it("resolves with the state it wrote, so the caller does not have to read it back", async () => {
      const before = await seed();
      const written = await storage.replaceAll(backup([attempt("2026-10-25T09:00:00.000Z")]));
      expect(written.states).toEqual({ fresh: { box: 2, due: "2026-10-28" } });
      expect(written.completedDays).toEqual(["2026-10-25"]);
      expect(written.reports).toEqual([{ itemId: "fresh-item", at: "2026-10-25T08:00:00.000Z" }]);
      expect(written.settings).toEqual(before.settings);
      expect(written.today).toEqual(before.today);
      expect(written).toEqual(await storage.loadState());
    });

    it("rejects with a real Error when a request fails inside the transaction", async () => {
      await seed();
      // Two adds under one key make the second request fail with a ConstraintError.
      vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
      const twin = attempt("2026-10-25T09:00:00.000Z");
      const error = await storage.replaceAll(backup([twin, twin])).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toBe("");
      expect((await storage.loadAttempts()).map((a) => a.at)).toEqual(["2026-10-02T10:00:00.000Z"]);
    });

    it("leaves the old data untouched when the write fails", async () => {
      const before = await seed();
      const broken = { ...attempt("2026-10-25T09:00:00.000Z"), chosen: () => "not cloneable" } as unknown as Attempt;
      await expect(storage.replaceAll(backup([attempt("2026-10-25T08:00:00.000Z"), broken]))).rejects.toThrow();
      expect(await storage.loadState()).toEqual(before);
      expect((await storage.loadAttempts()).map((a) => a.at)).toEqual(["2026-10-02T10:00:00.000Z"]);
    });
  });
});
