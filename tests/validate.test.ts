import { describe, expect, it } from "vitest";
import type { Item, MoodItem, PastItem } from "../src/content/types";
import { validateContent } from "../src/content/validate";
import { moodInd, moodSubj, pastItem, rules } from "./fixtures";

const valid: Item[] = [pastItem, moodSubj, moodInd];

describe("validateContent", () => {
  it("accepts the fixtures", () => {
    expect(validateContent(rules, valid)).toEqual([]);
  });

  it("requires the stem rules", () => {
    const errors = validateContent(rules.filter((r) => r.id !== "STEM-regular"), valid);
    expect(errors).toContain("rule STEM-regular: missing");
  });

  it("matches [verbs] to slots", () => {
    const bad: PastItem = { ...pastItem, present: "Je [lis] quand Marie arrive." };
    expect(validateContent(rules, [bad])).toContain("item p-test-1: 1 [verbs] for 2 slots");
  });

  it("rejects answers that are not normalised", () => {
    const bad: MoodItem = { ...moodSubj, accepted: ["Fasses"] };
    expect(validateContent(rules, [bad])).toContain('item m-test-1: answer "Fasses" is not normalised');
  });

  it("requires an auxiliary for passé composé", () => {
    const bad: PastItem = { ...pastItem, slots: [pastItem.slots[0], { ...pastItem.slots[1], aux: undefined }] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 1: pc needs aux");
  });

  it("checks the rule prefix against the tense", () => {
    const bad: PastItem = { ...pastItem, slots: [{ ...pastItem.slots[0], ruleId: "PC-interrupting-event" }, pastItem.slots[1]] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 0: rule PC-interrupting-event should start with IMP-");
  });

  it("needs exactly one blank in mood sentences", () => {
    const bad: MoodItem = { ...moodSubj, sentence: "Il faut que tu ___ (faire) ___." };
    expect(validateContent(rules, [bad])).toContain("item m-test-1: sentence needs exactly one ___");
  });

  it("flags duplicate ids and unknown rules", () => {
    const errors = validateContent(rules, [moodSubj, { ...moodSubj, ruleId: "SUBJ-nope" }]);
    expect(errors).toContain("item m-test-1: duplicate id");
    expect(errors).toContain("item m-test-1: unknown rule SUBJ-nope");
  });

  it("requires the frame to open the past sentence", () => {
    const bad: PastItem = { ...pastItem, frame: "Hier soir" };
    expect(validateContent(rules, [bad])).toContain("item p-test-1: past must start with the frame");
  });
});

// Content comes from JSON and is only cast to the types, so these build values outside them on purpose.
const asItem = (v: unknown) => v as Item;
const [impSlot, pcSlot] = pastItem.slots;

describe("validateContent on malformed content", () => {
  it("rejects a bad context", () => {
    const bad = asItem({ ...moodSubj, context: "weekend" });
    expect(validateContent(rules, [bad])).toContain("item m-test-1: bad context");
  });

  it("needs 1 or 2 slots (0 slots)", () => {
    const bad: PastItem = { ...pastItem, present: "Je lis.", slots: [] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1: needs 1 or 2 slots");
  });

  it("needs 1 or 2 slots (3 slots)", () => {
    const bad: PastItem = { ...pastItem, present: "Je [lis], Marie [arrive] et [lis].", slots: [impSlot, pcSlot, impSlot] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1: needs 1 or 2 slots");
  });

  it("rejects an empty past sentence", () => {
    const bad: PastItem = { ...pastItem, past: "  " };
    expect(validateContent(rules, [bad])).toContain("item p-test-1: empty past sentence");
  });

  it("needs accepted answers", () => {
    const bad: MoodItem = { ...moodSubj, accepted: [] };
    expect(validateContent(rules, [bad])).toContain("item m-test-1: no accepted answers");
  });

  it("rejects an empty answer without calling it not normalised", () => {
    const bad: MoodItem = { ...moodSubj, accepted: ["fasses", ""] };
    const errors = validateContent(rules, [bad]);
    expect(errors).toContain("item m-test-1: empty answer");
    expect(errors.some((e) => e.includes("not normalised"))).toBe(false);
  });

  it("rejects a blank or non-string answer without throwing", () => {
    const bad = asItem({ ...moodSubj, accepted: ["  ", null] });
    const errors = validateContent(rules, [bad]);
    expect(errors.filter((e) => e === "item m-test-1: empty answer")).toHaveLength(2);
    expect(errors.some((e) => e.includes("not normalised"))).toBe(false);
  });

  it("needs the why in French (slot)", () => {
    const bad: PastItem = { ...pastItem, slots: [{ ...impSlot, why: { es: "Leer es la acción en curso.", fr: "" } }, pcSlot] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 0: why needs es and fr");
  });

  it("needs the why in French (mood item)", () => {
    const bad: MoodItem = { ...moodSubj, why: { es: "Pide subjuntivo.", fr: "" } };
    expect(validateContent(rules, [bad])).toContain("item m-test-1: why needs es and fr");
  });

  it("needs the why text even when the fr key is missing", () => {
    const bad = asItem({ ...moodSubj, why: { es: "Pide subjuntivo." } });
    expect(validateContent(rules, [bad])).toContain("item m-test-1: why needs es and fr");
  });

  it("gives imparfait no auxiliary", () => {
    const bad: PastItem = { ...pastItem, slots: [{ ...impSlot, aux: "avoir" }, pcSlot] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 0: imp takes no aux");
  });

  it("needs a stem on subjonctif items", () => {
    const bad: MoodItem = { ...moodSubj, stem: undefined };
    expect(validateContent(rules, [bad])).toContain("item m-test-1: subj needs stem");
  });

  it("gives indicatif items no stem", () => {
    const bad: MoodItem = { ...moodInd, stem: "regular" };
    expect(validateContent(rules, [bad])).toContain("item m-test-2: ind takes no stem");
  });

  it("flags a duplicate rule id", () => {
    expect(validateContent([...rules, rules[0]], valid)).toContain("rule IMP-ongoing-interrupted: duplicate id");
  });

  it("needs a rule title in French", () => {
    const broken = rules.map((r) => (r.id === "SUBJ-necessity" ? { ...r, title: { es: "Necesidad", fr: "" } } : r));
    expect(validateContent(broken, valid)).toContain("rule SUBJ-necessity: title and explanation need es and fr");
  });

  it("needs a rule trap in Spanish", () => {
    const broken = rules.map((r) => (r.id === "IND-esperer" ? { ...r, trap: { es: "", fr: "Piège." } } : r));
    expect(validateContent(broken, valid)).toContain("rule IND-esperer: trap needs es and fr");
  });

  it("requires the irregular stem rule", () => {
    const errors = validateContent(rules.filter((r) => r.id !== "STEM-irregular"), valid);
    expect(errors).toContain("rule STEM-irregular: missing");
  });

  it("accepts a frame that opens the past sentence", () => {
    const ok: PastItem = { ...pastItem, frame: "Hier", past: "Hier, je lisais quand Marie est arrivée." };
    expect(validateContent(rules, [ok])).toEqual([]);
  });

  it("rejects an empty frame", () => {
    const bad: PastItem = { ...pastItem, frame: "  " };
    const errors = validateContent(rules, [bad]);
    expect(errors).toContain("item p-test-1: empty frame");
    expect(errors).not.toContain("item p-test-1: past must start with the frame");
  });

  it("rejects an unknown kind and skips the rest of the item", () => {
    const bad = asItem({ ...moodSubj, kind: "verb" });
    expect(validateContent(rules, [bad])).toEqual(["item m-test-1: bad kind verb"]);
  });

  it("rejects a bad tense and skips the rest of the slot", () => {
    const bad = asItem({ ...pastItem, slots: [{ ...impSlot, tense: "PC" }, pcSlot] });
    expect(validateContent(rules, [bad])).toEqual(["item p-test-1 slot 0: bad tense PC"]);
  });

  it("rejects a bad mood and skips the rest of the item", () => {
    const bad = asItem({ ...moodSubj, mood: "sub" });
    expect(validateContent(rules, [bad])).toEqual(["item m-test-1: bad mood sub"]);
  });

  it("rejects an empty verb (slot)", () => {
    const bad: PastItem = { ...pastItem, slots: [{ ...impSlot, verb: " " }, pcSlot] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 0: verb and subject must not be empty");
  });

  it("rejects an empty subject (slot)", () => {
    const bad: PastItem = { ...pastItem, slots: [impSlot, { ...pcSlot, subject: "" }] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 1: verb and subject must not be empty");
  });

  it("rejects an empty verb (mood item)", () => {
    const bad: MoodItem = { ...moodSubj, verb: "" };
    expect(validateContent(rules, [bad])).toContain("item m-test-1: verb must not be empty");
  });

  it("rejects a missing verb (mood item)", () => {
    const bad = asItem({ ...moodSubj, verb: undefined });
    expect(validateContent(rules, [bad])).toContain("item m-test-1: verb must not be empty");
  });

  it("reports a missing slots array instead of throwing", () => {
    const bad = asItem({ ...pastItem, slots: undefined });
    expect(validateContent(rules, [bad])).toEqual(["item p-test-1: missing present, past or slots"]);
  });

  it("reports a missing present or past instead of throwing", () => {
    const noPresent = asItem({ ...pastItem, present: undefined });
    const noPast = asItem({ ...pastItem, past: 3 });
    expect(validateContent(rules, [noPresent])).toEqual(["item p-test-1: missing present, past or slots"]);
    expect(validateContent(rules, [noPast])).toEqual(["item p-test-1: missing present, past or slots"]);
  });

  it("reports a missing sentence or accepted instead of throwing", () => {
    const noSentence = asItem({ ...moodSubj, sentence: undefined });
    const noAccepted = asItem({ ...moodSubj, accepted: "fasses" });
    expect(validateContent(rules, [noSentence])).toEqual(["item m-test-1: missing sentence or accepted"]);
    expect(validateContent(rules, [noAccepted])).toEqual(["item m-test-1: missing sentence or accepted"]);
  });

  it("needs an auxRuleId on a passé composé slot", () => {
    const bad: PastItem = { ...pastItem, slots: [impSlot, { ...pcSlot, auxRuleId: undefined }] };
    const errors = validateContent(rules, [bad]);
    expect(errors).toContain("item p-test-1 slot 1: pc needs auxRuleId");
    expect(errors.some((e) => e.includes("unknown rule undefined"))).toBe(false);
  });

  it("keeps the unknown-rule message for an auxRuleId that is not a rule", () => {
    const bad: PastItem = { ...pastItem, slots: [impSlot, { ...pcSlot, auxRuleId: "AUX-nope" }] };
    expect(validateContent(rules, [bad])).toContain("item p-test-1 slot 1: unknown rule AUX-nope");
  });
});
