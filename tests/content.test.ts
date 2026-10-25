import { describe, expect, it } from "vitest";
import { loadContent } from "../src/content/load";
import { validateContent } from "../src/content/validate";

const RULE_IDS = [
  "IMP-background", "IMP-habit", "IMP-state", "IMP-ongoing-interrupted", "IMP-simultaneous",
  "PC-punctual-event", "PC-sequence", "PC-interrupting-event", "PC-sudden", "PC-bounded-duration", "PC-counted-repetition",
  "AUX-avoir-default", "AUX-etre-motion", "AUX-etre-pronominal", "AUX-transitive-switch",
  "SUBJ-necessity", "SUBJ-will", "SUBJ-emotion", "SUBJ-doubt", "SUBJ-negated-opinion", "SUBJ-impersonal-judgement", "SUBJ-conjunction",
  "IND-affirmed-opinion", "IND-certainty", "IND-esperer", "IND-apres-que", "IND-quand-futur",
  "STEM-regular", "STEM-irregular",
];

describe("bundled content", () => {
  const { rules, items } = loadContent();

  it("passes validation", () => {
    expect(validateContent([...rules.values()], items)).toEqual([]);
  });

  it("defines exactly the rule catalogue", () => {
    expect([...rules.keys()].sort()).toEqual([...RULE_IDS].sort());
  });

  it("has items of both kinds", () => {
    expect(items.some((i) => i.kind === "past")).toBe(true);
    expect(items.some((i) => i.kind === "mood")).toBe(true);
  });
});
