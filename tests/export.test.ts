import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildBackup, parseBackup, statsMarkdown, type Backup } from "../src/export";
import type { Attempt } from "../src/flow";
import { computeStats } from "../src/stats";
import { rules as ruleList } from "./fixtures";

const rules = new Map(ruleList.map((r) => [r.id, r]));
const TODAY = "2026-10-25";
const fail: Attempt = {
  at: "2026-10-25T10:00:00.000Z",
  itemId: "p-test-1",
  slot: 0,
  kind: "past",
  verb: "lire",
  ruleId: "IMP-ongoing-interrupted",
  step: 1,
  chosen: "pc",
  correct: false,
  attempt: 1,
  help: false,
  ms: 800,
};

describe("backup", () => {
  it("round-trips through JSON", () => {
    const b = buildBackup(
      { attempts: [fail], states: { "p-test-1": { box: 1, due: "2026-10-26" } }, completedDays: [TODAY], reports: [] },
      "2026-10-25T12:00:00.000Z",
    );
    expect(parseBackup(JSON.stringify(b))).toEqual(b);
  });

  it("rejects files that are not a Déclic backup", () => {
    expect(() => parseBackup('{"app":"other"}')).toThrow("Archivo de respaldo no válido");
    expect(() => parseBackup("not json")).toThrow();
  });

  it("round-trips a backup with attempts, states, days and reports", () => {
    const b = buildBackup(
      {
        attempts: [fail, { ...fail, step: 3, attempt: 2, category: "accent", chosen: "lisait", correct: true }],
        states: { "p-test-1": { box: 5, due: "2026-11-24" }, "m-007": { box: 1, due: TODAY } },
        completedDays: ["2026-10-24", TODAY],
        reports: [{ itemId: "m-007", at: "2026-10-24T08:00:00.000Z" }],
      },
      "2026-10-25T12:00:00.000Z",
    );
    expect(parseBackup(JSON.stringify(b))).toEqual(b);
  });
});

describe("parseBackup validation", () => {
  const valid = (): Backup =>
    buildBackup(
      {
        attempts: [fail],
        states: { "p-test-1": { box: 1, due: "2026-10-26" } },
        completedDays: [TODAY],
        reports: [{ itemId: "m-007", at: "2026-10-24T08:00:00.000Z" }],
      },
      "2026-10-25T12:00:00.000Z",
    );
  // Builds a backup JSON text where `patch` edits the plain object before it is serialised.
  const withPatch = (patch: (b: Record<string, any>) => void) => {
    const b = JSON.parse(JSON.stringify(valid()));
    patch(b);
    return JSON.stringify(b);
  };

  const rejected: [string, string][] = [
    ["invalid JSON", "{not json"],
    ["JSON null", "null"],
    ["wrong version", withPatch((b) => (b.version = 2))],
    ["missing exportedAt", withPatch((b) => delete b.exportedAt)],
    ["states null", withPatch((b) => (b.states = null))],
    ["states array", withPatch((b) => (b.states = []))],
    ["a state with box 6", withPatch((b) => (b.states["p-test-1"].box = 6))],
    ["a state with a bad due", withPatch((b) => (b.states["p-test-1"].due = "26-10-26"))],
    ["an attempt missing at", withPatch((b) => delete b.attempts[0].at)],
    ["an attempt with at x", withPatch((b) => (b.attempts[0].at = "x"))],
    ["an attempt with step 4", withPatch((b) => (b.attempts[0].step = 4))],
    ["an attempt with a bad category", withPatch((b) => (b.attempts[0].category = "typo"))],
    ["an attempt with negative ms", withPatch((b) => (b.attempts[0].ms = -1))],
    ["completedDays with 2026-1-5", withPatch((b) => (b.completedDays = ["2026-1-5"]))],
    ["a report without at", withPatch((b) => delete b.reports[0].at)],
    ["attempts that is not an array", withPatch((b) => (b.attempts = {}))],
    ["completedDays that is not an array", withPatch((b) => (b.completedDays = TODAY))],
    ["reports that is not an array", withPatch((b) => (b.reports = null))],
    ["a state value that is not an object", withPatch((b) => (b.states["p-test-1"] = 5))],
    ["an attempt with an empty itemId", withPatch((b) => (b.attempts[0].itemId = ""))],
    ["an attempt with slot -1", withPatch((b) => (b.attempts[0].slot = -1))],
    ["an attempt with slot 1.5", withPatch((b) => (b.attempts[0].slot = 1.5))],
    ["an attempt with kind x", withPatch((b) => (b.attempts[0].kind = "x"))],
    ["an attempt whose verb is not a string", withPatch((b) => (b.attempts[0].verb = 5))],
    ["an attempt whose ruleId is not a string", withPatch((b) => (b.attempts[0].ruleId = 5))],
    ["an attempt whose chosen is not a string", withPatch((b) => (b.attempts[0].chosen = 5))],
    ["an attempt whose correct is not a boolean", withPatch((b) => (b.attempts[0].correct = "yes"))],
    ["an attempt with attempt 3", withPatch((b) => (b.attempts[0].attempt = 3))],
    ["an attempt whose help is not a boolean", withPatch((b) => (b.attempts[0].help = 0))],
    ["an attempt with ms as a string", withPatch((b) => (b.attempts[0].ms = "5"))],
    ["a report with an empty itemId", withPatch((b) => (b.reports[0].itemId = ""))],
  ];

  it.each(rejected)("rejects %s", (_name, json) => {
    let error: unknown;
    try {
      parseBackup(json);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^Archivo de respaldo no válido/);
  });

  it("names the offending attempt", () => {
    const json = withPatch((b) => b.attempts.push({ ...b.attempts[0], step: 4 }));
    expect(() => parseBackup(json)).toThrow("Archivo de respaldo no válido: intento 2");
  });

  it("accepts an attempt without a category and one with far", () => {
    const json = withPatch((b) => b.attempts.push({ ...b.attempts[0], category: "far" }));
    expect(parseBackup(json).attempts).toHaveLength(2);
  });
});

describe("statsMarkdown", () => {
  const md = statsMarkdown(computeStats([fail], {}, [], TODAY), rules, [{ itemId: "m-007", at: "2026-10-24T08:00:00.000Z" }], TODAY);

  it("has Cortex frontmatter and a dated title", () => {
    expect(md.startsWith("---\ntype: note\nstatus: active\ncreated: 2026-10-25\n")).toBe(true);
    expect(md).toContain("# Déclic stats 2026-10-25");
  });

  it("names failed rules with their French title", () => {
    expect(md).toContain("| IMP-ongoing-interrupted (Action en cours interrompue) | 1 | 1 |");
  });

  it("lists reported sentences", () => {
    expect(md).toContain("- `m-007` (2026-10-24)");
  });

  it("follows the vault style: no em dash", () => {
    expect(md).not.toContain("\u2014");
  });

  it("escapes pipes in table cells built from data", () => {
    const piped = new Map([["IMP-ongoing-interrupted", { id: "IMP-ongoing-interrupted", title: { es: "a", fr: "Imparfait | passé" }, explanation: { es: "a", fr: "b" } }]]);
    const out = statsMarkdown(computeStats([fail, { ...fail, verb: "a|b" }], {}, [], TODAY), piped, [], TODAY);
    expect(out).toContain("| IMP-ongoing-interrupted (Imparfait \\| passé) | 2 | 2 |");
    expect(out).toContain("| a\\|b | 1 | 1 |");
  });
});

describe("statsMarkdown in another time zone", () => {
  beforeAll(() => {
    process.env.TZ = "America/Toronto";
  });
  afterAll(() => {
    process.env.TZ = "UTC";
  });

  it("prints the reported date as the local day", () => {
    const out = statsMarkdown(computeStats([], {}, [], TODAY), rules, [{ itemId: "m-007", at: "2026-10-25T02:30:00.000Z" }], TODAY);
    expect(out).toContain("- `m-007` (2026-10-24)");
  });
});
