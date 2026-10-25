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
