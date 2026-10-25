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
});
