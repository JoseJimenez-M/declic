import { normalize } from "../checker";
import type { Item, Lang, Rule } from "./types";

const REQUIRED_RULES = ["STEM-regular", "STEM-irregular"];

// Content is parsed JSON cast to the types, so any field can be missing or the wrong type.
const text = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const filled = (l: Lang | undefined) => !!l && text(l.es) && text(l.fr);

export function validateContent(rules: Rule[], items: Item[]): string[] {
  const errors: string[] = [];

  const ruleIds = new Set<string>();
  for (const r of rules) {
    if (ruleIds.has(r.id)) errors.push(`rule ${r.id}: duplicate id`);
    ruleIds.add(r.id);
    if (!filled(r.title) || !filled(r.explanation)) errors.push(`rule ${r.id}: title and explanation need es and fr`);
    if (r.trap !== undefined && !filled(r.trap)) errors.push(`rule ${r.id}: trap needs es and fr`);
  }
  for (const id of REQUIRED_RULES) if (!ruleIds.has(id)) errors.push(`rule ${id}: missing`);

  const checkAnswers = (where: string, accepted: unknown[]) => {
    if (accepted.length === 0) errors.push(`${where}: no accepted answers`);
    for (const a of accepted) {
      if (!text(a)) errors.push(`${where}: empty answer`);
      else if (normalize(a) !== a) errors.push(`${where}: answer "${a}" is not normalised`);
    }
  };
  const checkRule = (where: string, id: string | undefined, prefix: string) => {
    if (id === undefined || !ruleIds.has(id)) errors.push(`${where}: unknown rule ${id}`);
    else if (!id.startsWith(prefix)) errors.push(`${where}: rule ${id} should start with ${prefix}`);
  };

  const itemIds = new Set<string>();
  for (const item of items) {
    const at = `item ${item.id}`;
    if (itemIds.has(item.id)) errors.push(`${at}: duplicate id`);
    itemIds.add(item.id);
    if (item.context !== "daily" && item.context !== "exam") errors.push(`${at}: bad context`);

    const kind: unknown = item.kind; // read before narrowing, so the bad-kind branch stays reachable
    if (kind !== "past" && kind !== "mood") {
      errors.push(`${at}: bad kind ${kind}`);
      continue;
    }

    if (item.kind === "past") {
      if (typeof item.present !== "string" || typeof item.past !== "string" || !Array.isArray(item.slots)) {
        errors.push(`${at}: missing present, past or slots`);
        continue;
      }
      const marks = item.present.match(/\[[^\]]+\]/g) ?? [];
      if (item.slots.length < 1 || item.slots.length > 2) errors.push(`${at}: needs 1 or 2 slots`);
      if (marks.length !== item.slots.length) errors.push(`${at}: ${marks.length} [verbs] for ${item.slots.length} slots`);
      if (item.past.trim() === "") errors.push(`${at}: empty past sentence`);
      if (item.frame !== undefined) {
        if (!text(item.frame)) errors.push(`${at}: empty frame`);
        else if (!item.past.toLowerCase().startsWith(item.frame.toLowerCase())) errors.push(`${at}: past must start with the frame`);
      }
      item.slots.forEach((s, i) => {
        const where = `${at} slot ${i}`;
        const tense: unknown = s.tense;
        if (tense !== "pc" && tense !== "imp") {
          errors.push(`${where}: bad tense ${tense}`);
          return;
        }
        if (!text(s.verb) || !text(s.subject)) errors.push(`${where}: verb and subject must not be empty`);
        checkAnswers(where, s.accepted);
        if (!filled(s.why)) errors.push(`${where}: why needs es and fr`);
        checkRule(where, s.ruleId, tense === "pc" ? "PC-" : "IMP-");
        if (tense === "pc") {
          if (s.aux !== "avoir" && s.aux !== "etre") errors.push(`${where}: pc needs aux`);
          if (s.auxRuleId === undefined) errors.push(`${where}: pc needs auxRuleId`);
          else checkRule(where, s.auxRuleId, "AUX-");
        } else if (s.aux !== undefined || s.auxRuleId !== undefined) {
          errors.push(`${where}: imp takes no aux`);
        }
      });
    } else {
      if (typeof item.sentence !== "string" || !Array.isArray(item.accepted)) {
        errors.push(`${at}: missing sentence or accepted`);
        continue;
      }
      const mood: unknown = item.mood;
      if (mood !== "ind" && mood !== "subj") {
        errors.push(`${at}: bad mood ${mood}`);
        continue;
      }
      if (!text(item.verb)) errors.push(`${at}: verb must not be empty`);
      if ((item.sentence.match(/___/g) ?? []).length !== 1) errors.push(`${at}: sentence needs exactly one ___`);
      checkAnswers(at, item.accepted);
      if (!filled(item.why)) errors.push(`${at}: why needs es and fr`);
      checkRule(at, item.ruleId, mood === "subj" ? "SUBJ-" : "IND-");
      if (mood === "subj" && item.stem !== "regular" && item.stem !== "irregular") errors.push(`${at}: subj needs stem`);
      if (mood === "ind" && item.stem !== undefined) errors.push(`${at}: ind takes no stem`);
    }
  }
  return errors;
}
