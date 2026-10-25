import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup, statsMarkdown } from "../src/export";
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
    expect(md).not.toContain("—");
  });
});
