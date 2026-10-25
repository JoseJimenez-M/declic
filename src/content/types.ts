export type Lang = { es: string; fr: string };

export type Rule = {
  id: string;
  title: Lang;
  explanation: Lang;
  trap?: Lang;
};

export type PastSlot = {
  verb: string;
  subject: string;
  tense: "pc" | "imp";
  aux?: "avoir" | "etre";
  auxRuleId?: string;
  accepted: string[];
  ruleId: string;
  why: Lang;
};

export type PastItem = {
  id: string;
  kind: "past";
  context: "daily" | "exam";
  frame?: string;
  present: string;
  past: string;
  slots: PastSlot[];
};

export type MoodItem = {
  id: string;
  kind: "mood";
  context: "daily" | "exam";
  sentence: string;
  verb: string;
  mood: "ind" | "subj";
  stem?: "regular" | "irregular";
  accepted: string[];
  ruleId: string;
  why: Lang;
};

export type Item = PastItem | MoodItem;

export type Content = { rules: Map<string, Rule>; items: Item[] };
