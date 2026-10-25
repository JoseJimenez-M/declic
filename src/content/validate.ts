import { normalize } from "../checker";
import type { Item, Lang, Rule } from "./types";

const REQUIRED_RULES = ["STEM-regular", "STEM-irregular"];

const filled = (l: Lang | undefined) => !!l && l.es.trim() !== "" && l.fr.trim() !== "";

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

  const checkAnswers = (where: string, accepted: string[]) => {
    if (accepted.length === 0) errors.push(`${where}: no accepted answers`);
    for (const a of accepted) if (normalize(a) !== a) errors.push(`${where}: answer "${a}" is not normalised`);
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

    if (item.kind === "past") {
      const marks = item.present.match(/\[[^\]]+\]/g) ?? [];
      if (item.slots.length < 1 || item.slots.length > 2) errors.push(`${at}: needs 1 or 2 slots`);
      if (marks.length !== item.slots.length) errors.push(`${at}: ${marks.length} [verbs] for ${item.slots.length} slots`);
      if (item.past.trim() === "") errors.push(`${at}: empty past sentence`);
      if (item.frame !== undefined && !item.past.toLowerCase().startsWith(item.frame.toLowerCase())) {
        errors.push(`${at}: past must start with the frame`);
      }
      item.slots.forEach((s, i) => {
        const where = `${at} slot ${i}`;
        checkAnswers(where, s.accepted);
        if (!filled(s.why)) errors.push(`${where}: why needs es and fr`);
        checkRule(where, s.ruleId, s.tense === "pc" ? "PC-" : "IMP-");
        if (s.tense === "pc") {
          if (s.aux !== "avoir" && s.aux !== "etre") errors.push(`${where}: pc needs aux`);
          checkRule(where, s.auxRuleId, "AUX-");
        } else if (s.aux !== undefined || s.auxRuleId !== undefined) {
          errors.push(`${where}: imp takes no aux`);
        }
      });
    } else {
      if ((item.sentence.match(/___/g) ?? []).length !== 1) errors.push(`${at}: sentence needs exactly one ___`);
      checkAnswers(at, item.accepted);
      if (!filled(item.why)) errors.push(`${at}: why needs es and fr`);
      checkRule(at, item.ruleId, item.mood === "subj" ? "SUBJ-" : "IND-");
      if (item.mood === "subj" && item.stem !== "regular" && item.stem !== "irregular") errors.push(`${at}: subj needs stem`);
      if (item.mood === "ind" && item.stem !== undefined) errors.push(`${at}: ind takes no stem`);
    }
  }
  return errors;
}
