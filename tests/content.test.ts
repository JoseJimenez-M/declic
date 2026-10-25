import { describe, expect, it } from "vitest";
import rulesJson from "../src/content/rules.json";
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

  it("has no duplicated rule ids in rules.json", () => {
    // loadContent() keys a Map by id, so a duplicate would silently drop a rule
    const rawIds = rulesJson.map((r) => r.id);
    expect(rawIds.filter((id, i) => rawIds.indexOf(id) !== i)).toEqual([]);
    expect(rawIds.length).toBe(new Set(rawIds).size);
    expect(rawIds.length).toBe(RULE_IDS.length);
  });

  it("uses every rule in at least one item", () => {
    const used = new Set<string>();
    for (const item of items) {
      if (item.kind === "past") {
        for (const slot of item.slots) {
          used.add(slot.ruleId);
          if (slot.auxRuleId) used.add(slot.auxRuleId);
        }
      } else {
        used.add(item.ruleId);
        // STEM rules are referenced through the stem field, not by id
        if (item.mood === "subj" && item.stem) used.add(`STEM-${item.stem}`);
      }
    }
    const unused = RULE_IDS.filter((id) => !used.has(id));
    expect(unused).toEqual([]);
  });
});
