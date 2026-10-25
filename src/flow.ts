import { check, type Category } from "./checker";
import type { Item, Lang } from "./content/types";
import type { Outcome } from "./srs";

export type Step = 1 | 2 | 3;

export type Attempt = {
  at: string;
  itemId: string;
  slot: number;
  kind: "past" | "mood";
  verb: string;
  ruleId: string;
  step: Step;
  chosen: string;
  correct: boolean;
  category?: Category | "far";
  attempt: 1 | 2;
  help: boolean;
  ms: number;
};

export type Choice = { options: [string, string]; answer: string; ruleId: string; why?: Lang };

export type SlotView = {
  index: number;
  verb: string;
  subject: string;
  first: Choice;
  second?: Choice;
  accepted: string[];
};

export type Feedback =
  | { kind: "wrong-choice"; answer: string; ruleId: string; why?: Lang }
  | { kind: "near"; category: Category }
  | { kind: "far" }
  | { kind: "revealed"; answer: string; ruleId: string; why?: Lang };

export type SlotResult = "clean" | "near-fixed" | "failed";

export type FlowState = {
  item: Item;
  slots: SlotView[];
  slotIndex: number;
  step: Step;
  typingAttempt: 1 | 2;
  feedback: Feedback | null;
  results: SlotResult[];
  done: boolean;
};

export type FlowEvent =
  | { type: "choose"; option: string; ms: number }
  | { type: "type"; input: string; ms: number }
  | { type: "help"; ms: number }
  | { type: "next" };

export function slotsOf(item: Item): SlotView[] {
  if (item.kind === "past") {
    return item.slots.map((s, index) => ({
      index,
      verb: s.verb,
      subject: s.subject,
      first: { options: ["pc", "imp"], answer: s.tense, ruleId: s.ruleId, why: s.why },
      second: s.tense === "pc" ? { options: ["avoir", "etre"], answer: s.aux!, ruleId: s.auxRuleId! } : undefined,
      accepted: s.accepted,
    }));
  }
  return [
    {
      index: 0,
      verb: item.verb,
      subject: "",
      first: { options: ["ind", "subj"], answer: item.mood, ruleId: item.ruleId, why: item.why },
      second:
        item.mood === "subj"
          ? { options: ["regular", "irregular"], answer: item.stem!, ruleId: item.stem === "regular" ? "STEM-regular" : "STEM-irregular" }
          : undefined,
      accepted: item.accepted,
    },
  ];
}

export function start(item: Item): FlowState {
  const slots = slotsOf(item);
  return { item, slots, slotIndex: 0, step: 1, typingAttempt: 1, feedback: null, results: slots.map(() => "clean"), done: false };
}

const isBlocking = (f: Feedback | null) => f !== null && (f.kind === "wrong-choice" || f.kind === "revealed");

const ORDER: SlotResult[] = ["clean", "near-fixed", "failed"];

function withResult(state: FlowState, result: SlotResult): SlotResult[] {
  const results = [...state.results];
  const current = results[state.slotIndex];
  results[state.slotIndex] = ORDER.indexOf(result) > ORDER.indexOf(current) ? result : current;
  return results;
}

function nextStep(state: FlowState): FlowState {
  const slot = state.slots[state.slotIndex];
  const step: Step = state.step === 1 && slot.second ? 2 : 3;
  return { ...state, step, typingAttempt: 1, feedback: null };
}

function nextSlot(state: FlowState): FlowState {
  if (state.slotIndex + 1 < state.slots.length) {
    return { ...state, slotIndex: state.slotIndex + 1, step: 1, typingAttempt: 1, feedback: null };
  }
  return { ...state, feedback: null, done: true };
}

export function apply(state: FlowState, event: FlowEvent, now: string): { state: FlowState; attempts: Attempt[] } {
  const none = { state, attempts: [] as Attempt[] };
  if (state.done) return none;

  if (event.type === "next") {
    if (!isBlocking(state.feedback)) return none;
    return { state: state.step === 3 ? nextSlot(state) : nextStep(state), attempts: [] };
  }
  if (isBlocking(state.feedback)) return none;

  const slot = state.slots[state.slotIndex];
  const base = { at: now, itemId: state.item.id, slot: slot.index, kind: state.item.kind, verb: slot.verb, step: state.step, ms: event.ms };

  if (event.type === "help") {
    const choice = state.step === 1 ? slot.first : state.step === 2 ? slot.second! : undefined;
    const answer = choice ? choice.answer : slot.accepted[0];
    const ruleId = choice ? choice.ruleId : slot.first.ruleId;
    const why = choice ? choice.why : slot.first.why;
    return {
      state: { ...state, results: withResult(state, "failed"), feedback: { kind: "revealed", answer, ruleId, why } },
      attempts: [{ ...base, ruleId, chosen: "", correct: false, attempt: state.step === 3 ? state.typingAttempt : 1, help: true }],
    };
  }

  if (event.type === "choose") {
    if (state.step === 3) return none;
    const choice = state.step === 1 ? slot.first : slot.second!;
    const correct = event.option === choice.answer;
    const attempt: Attempt = { ...base, ruleId: choice.ruleId, chosen: event.option, correct, attempt: 1, help: false };
    if (correct) return { state: nextStep(state), attempts: [attempt] };
    return {
      state: {
        ...state,
        results: withResult(state, "failed"),
        feedback: { kind: "wrong-choice", answer: choice.answer, ruleId: choice.ruleId, why: choice.why },
      },
      attempts: [attempt],
    };
  }

  if (state.step !== 3) return none;
  const result = check(event.input, slot.accepted);
  const category = result.verdict === "near" ? result.category : result.verdict === "far" ? "far" : undefined;
  const attempt: Attempt = {
    ...base,
    ruleId: slot.first.ruleId,
    chosen: event.input,
    correct: result.verdict === "exact",
    category,
    attempt: state.typingAttempt,
    help: false,
  };
  if (result.verdict === "exact") return { state: nextSlot(state), attempts: [attempt] };
  if (state.typingAttempt === 1) {
    const feedback: Feedback = result.verdict === "near" ? { kind: "near", category: result.category } : { kind: "far" };
    return {
      state: { ...state, typingAttempt: 2, results: withResult(state, result.verdict === "near" ? "near-fixed" : "failed"), feedback },
      attempts: [attempt],
    };
  }
  return {
    state: {
      ...state,
      results: withResult(state, "failed"),
      feedback: { kind: "revealed", answer: slot.accepted[0], ruleId: slot.first.ruleId, why: slot.first.why },
    },
    attempts: [attempt],
  };
}

export function outcomeOf(state: FlowState): Outcome {
  if (state.results.includes("failed")) return "fail";
  if (state.results.includes("near-fixed")) return "near-fixed";
  return "pass";
}
