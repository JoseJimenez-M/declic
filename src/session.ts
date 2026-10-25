import type { Item } from "./content/types";
import { isDue, type CardState } from "./srs";

export type Filter = "all" | "past" | "mood";

const BUCKETS = ["past:daily", "mood:daily", "past:exam", "mood:exam"];

/** Round-robin over the four kind x context buckets, keeping bank order inside each. */
export function interleave(items: Item[]): Item[] {
  const buckets = BUCKETS.map((key) => items.filter((i) => `${i.kind}:${i.context}` === key));
  const out: Item[] = [];
  const rounds = Math.max(0, ...buckets.map((b) => b.length));
  for (let round = 0; round < rounds; round++) {
    for (const b of buckets) if (round < b.length) out.push(b[round]);
  }
  return out;
}

/** Alternates past and mood items as far as possible, keeping the order within each kind. */
export function alternateKinds(items: Item[]): Item[] {
  const past = items.filter((i) => i.kind === "past");
  const mood = items.filter((i) => i.kind === "mood");
  const out: Item[] = [];
  while (past.length > 0 || mood.length > 0) {
    if (past.length > 0) out.push(past.shift()!);
    if (mood.length > 0) out.push(mood.shift()!);
  }
  return out;
}

export function buildSession(items: Item[], states: Record<string, CardState>, today: string, filter: Filter, size: number): Item[] {
  const pool = items.filter((i) => filter === "all" || i.kind === filter);
  const due = pool
    .filter((i) => isDue(states[i.id], today))
    .sort((a, b) => states[a.id].due.localeCompare(states[b.id].due) || a.id.localeCompare(b.id));
  const fresh = interleave(pool.filter((i) => states[i.id] === undefined));
  return alternateKinds([...due.slice(0, size), ...fresh].slice(0, size));
}
