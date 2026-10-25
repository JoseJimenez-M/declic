import { describe, expect, it } from "vitest";
import { check, levenshtein, normalize, stripAccents } from "../src/checker";

describe("normalize", () => {
  it("trims, lowercases, collapses spaces and straightens apostrophes", () => {
    expect(normalize("  J\u2019Avais   faim ")).toBe("j'avais faim");
  });
});

describe("stripAccents", () => {
  it("removes diacritics", () => {
    expect(stripAccents("étais été")).toBe("etais ete");
  });
});

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("venes", "viennes")).toBe(2);
    expect(levenshtein("mangeait", "mangeais")).toBe(1);
  });
});

describe("check", () => {
  const cases: Array<[string, string[], string, string | null]> = [
    ["mangeais", ["mangeais"], "exact", null],
    ["  Mangeais ", ["mangeais"], "exact", null],
    ["viens", ["viendras", "viens"], "exact", null],
    ["etais", ["étais"], "near", "accent"],
    ["est parti", ["est partie"], "near", "agreement"],
    ["me suis levé", ["me suis levée"], "near", "agreement"],
    ["a parti", ["est partie"], "near", "auxiliary"],
    ["mangeait", ["mangeais"], "near", "ending"],
    ["parlons", ["parlions"], "near", "ending"],
    ["venes", ["viennes"], "near", "stem"],
    ["aie", ["ait"], "near", "other"],
    ["dormerais", ["dormirais"], "near", "stem"],
    ["parle", ["parlions"], "far", null],
    ["voulais", ["mangeais"], "far", null],
    ["allais", ["irai"], "far", null],
    ["soit", ["est"], "far", null],
    ["", ["mangeais"], "far", null],
  ];

  it.each(cases)("%s against %j is %s (%s)", (input, accepted, verdict, category) => {
    const r = check(input, accepted);
    expect(r.verdict).toBe(verdict);
    expect(r.verdict === "near" ? r.category : null).toBe(category);
  });

  it("compares against the closest accepted answer", () => {
    expect(check("vas venit", ["viendras", "vas venir"])).toEqual({
      verdict: "near",
      category: "ending",
      closest: "vas venir",
    });
  });
});
