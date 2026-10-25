import { describe, expect, it } from "vitest";
import { apply, outcomeOf, start, type Attempt, type FlowEvent, type FlowState } from "../src/flow";
import { moodInd, moodSubj, pastItem } from "./fixtures";

const NOW = "2026-10-25T14:00:00.000Z";

function run(state: FlowState, events: FlowEvent[]) {
  const attempts: Attempt[] = [];
  for (const e of events) {
    const r = apply(state, e, NOW);
    state = r.state;
    attempts.push(...r.attempts);
  }
  return { state, attempts };
}

const choose = (option: string): FlowEvent => ({ type: "choose", option, ms: 1000 });
const type = (input: string): FlowEvent => ({ type: "type", input, ms: 2000 });
const help: FlowEvent = { type: "help", ms: 500 };
const next: FlowEvent = { type: "next" };

describe("flow", () => {
  it("runs a clean two-slot past item", () => {
    const { state, attempts } = run(start(pastItem), [choose("imp"), type("lisais"), choose("pc"), choose("etre"), type("est arrivée")]);
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("pass");
    expect(attempts.map((a) => [a.slot, a.step, a.correct])).toEqual([
      [0, 1, true],
      [0, 3, true],
      [1, 1, true],
      [1, 2, true],
      [1, 3, true],
    ]);
    expect(attempts[0]).toMatchObject({ itemId: "p-test-1", kind: "past", verb: "lire", ruleId: "IMP-ongoing-interrupted", attempt: 1, help: false, ms: 1000, at: NOW });
    expect(attempts[3].ruleId).toBe("AUX-etre-motion");
  });

  it("skips step 2 for imparfait", () => {
    const { state } = run(start(pastItem), [choose("imp")]);
    expect(state.step).toBe(3);
  });

  it("explains a wrong choice, blocks until next, then continues with the right choice", () => {
    let { state, attempts } = run(start(pastItem), [choose("pc")]);
    expect(state.feedback).toEqual({ kind: "wrong-choice", answer: "imp", ruleId: "IMP-ongoing-interrupted", why: pastItem.slots[0].why });
    expect(attempts[0].correct).toBe(false);
    expect(apply(state, choose("imp"), NOW).attempts).toEqual([]);
    ({ state } = run(state, [next]));
    expect(state.step).toBe(3);
    expect(state.feedback).toBeNull();
  });

  it("gives a second attempt after a near answer and scores near-fixed", () => {
    const { state, attempts } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("fasse"), type("fasses")]);
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("near-fixed");
    expect(attempts[2]).toMatchObject({ step: 3, attempt: 1, correct: false, category: "ending" });
    expect(attempts[3]).toMatchObject({ step: 3, attempt: 2, correct: true });
  });

  it("keeps near feedback non-blocking so the answer can be retyped", () => {
    const { state } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("fasse")]);
    expect(state.feedback).toEqual({ kind: "near", category: "ending" });
    expect(state.typingAttempt).toBe(2);
  });

  it("reveals the answer after two failed attempts", () => {
    let { state } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("allons"), type("faisons")]);
    expect(state.feedback).toEqual({ kind: "revealed", answer: "fasses", ruleId: "SUBJ-necessity", why: moodSubj.why });
    ({ state } = run(state, [next]));
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("fail");
  });

  it("scores fail when the first typed attempt is far, even if fixed", () => {
    const { state } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("allons"), type("fasses")]);
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("fail");
  });

  it("Help reveals the answer, counts as failure and continues", () => {
    let { state, attempts } = run(start(moodSubj), [help]);
    expect(state.feedback).toEqual({ kind: "revealed", answer: "subj", ruleId: "SUBJ-necessity", why: moodSubj.why });
    expect(attempts[0]).toMatchObject({ help: true, correct: false, chosen: "", step: 1 });
    ({ state } = run(state, [next]));
    expect(state.step).toBe(2);
    ({ state } = run(state, [choose("irregular"), type("fasses")]));
    expect(outcomeOf(state)).toBe("fail");
  });

  it("skips step 2 for indicatif and accepts any listed answer", () => {
    const { state } = run(start(moodInd), [choose("ind"), type("viens")]);
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("pass");
  });

  it("ignores events once done", () => {
    const { state } = run(start(moodInd), [choose("ind"), type("viendras")]);
    expect(apply(state, help, NOW).attempts).toEqual([]);
  });

  it("Help on step 3 after a near first attempt records attempt 2, reveals the form and fails the item", () => {
    let { state, attempts } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("fasse"), help]);
    expect(attempts).toHaveLength(4);
    expect(attempts[3]).toMatchObject({ step: 3, attempt: 2, help: true, chosen: "", correct: false });
    expect(state.feedback).toEqual({ kind: "revealed", answer: "fasses", ruleId: "SUBJ-necessity", why: moodSubj.why });
    ({ state } = run(state, [next]));
    expect(state.done).toBe(true);
    expect(outcomeOf(state)).toBe("fail");
  });

  it("Help on step 3 at the first attempt records attempt 1 and reveals the first accepted form", () => {
    const { state, attempts } = run(start(moodInd), [choose("ind"), help]);
    expect(attempts[1]).toMatchObject({ step: 3, attempt: 1, help: true, chosen: "", correct: false });
    expect(state.feedback).toMatchObject({ kind: "revealed", answer: "viendras" });
  });

  it("scores fail when the second slot fails and the first is clean", () => {
    // Slot 1 gets a wrong first choice (imp instead of pc); outcomeOf must look past the clean slot 0.
    const { state } = run(start(pastItem), [choose("imp"), type("lisais"), choose("imp"), next, choose("etre"), type("est arrivée")]);
    expect(state.done).toBe(true);
    expect(state.results).toEqual(["clean", "failed"]);
    expect(outcomeOf(state)).toBe("fail");
  });

  it("scores near-fixed when the first slot is near-fixed and the second is clean", () => {
    const { state, attempts } = run(start(pastItem), [choose("imp"), type("lisait"), type("lisais"), choose("pc"), choose("etre"), type("est arrivée")]);
    expect(attempts[1]).toMatchObject({ slot: 0, step: 3, attempt: 1, correct: false, category: "ending" });
    expect(state.done).toBe(true);
    expect(state.results).toEqual(["near-fixed", "clean"]);
    expect(outcomeOf(state)).toBe("near-fixed");
  });

  it("explains a wrong choice on step 2 and moves to typing after next", () => {
    let { state, attempts } = run(start(pastItem), [choose("imp"), type("lisais"), choose("pc"), choose("avoir")]);
    expect(state.slotIndex).toBe(1);
    expect(state.feedback).toEqual({ kind: "wrong-choice", answer: "etre", ruleId: "AUX-etre-motion", why: undefined });
    expect(attempts[3]).toMatchObject({ slot: 1, step: 2, chosen: "avoir", correct: false, ruleId: "AUX-etre-motion" });
    ({ state } = run(state, [next]));
    expect(state.slotIndex).toBe(1);
    expect(state.step).toBe(3);
    expect(state.feedback).toBeNull();
  });

  it("keeps far feedback non-blocking and ignores next on it", () => {
    const { state } = run(start(moodSubj), [choose("subj"), choose("irregular"), type("allons")]);
    expect(state.feedback).toEqual({ kind: "far" });
    expect(state.typingAttempt).toBe(2);
    const after = apply(state, next, NOW);
    expect(after.state).toBe(state);
    expect(after.attempts).toEqual([]);
  });

  it("ignores choose on the typing step and type on a choice step", () => {
    const typing = run(start(moodSubj), [choose("subj"), choose("irregular")]).state;
    expect(typing.step).toBe(3);
    const chosen = apply(typing, choose("subj"), NOW);
    expect(chosen.attempts).toEqual([]);
    expect(chosen.state).toBe(typing);

    const first = start(moodSubj);
    expect(first.step).toBe(1);
    const typed = apply(first, type("fasses"), NOW);
    expect(typed.attempts).toEqual([]);
    expect(typed.state).toBe(first);
  });
});
