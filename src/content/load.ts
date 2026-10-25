import rulesJson from "./rules.json";
import type { Content, Item, Rule } from "./types";

const itemFiles = import.meta.glob<Item[]>("./items/*.json", { eager: true, import: "default" });

export function loadContent(): Content {
  const rules = new Map((rulesJson as Rule[]).map((r) => [r.id, r] as const));
  const items = Object.keys(itemFiles)
    .sort()
    .flatMap((path) => itemFiles[path]);
  return { rules, items };
}
