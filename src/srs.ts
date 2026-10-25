import { addDays } from "./dates";

export type Box = 1 | 2 | 3 | 4 | 5;
export type CardState = { box: Box; due: string };
export type Outcome = "pass" | "near-fixed" | "fail";

export const INTERVALS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/** A new item counts as box 1, so its first pass lands in box 2. */
export function nextState(prev: CardState | undefined, outcome: Outcome, today: string): CardState {
  const box: Box = prev?.box ?? 1;
  const nextBox: Box =
    outcome === "pass" ? (Math.min(box + 1, 5) as Box) : outcome === "near-fixed" ? box : 1;
  return { box: nextBox, due: addDays(today, INTERVALS[nextBox]) };
}

export function isDue(state: CardState | undefined, today: string): boolean {
  return state !== undefined && state.due <= today;
}
