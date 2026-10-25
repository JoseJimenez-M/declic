import type { Lang, MoodItem, PastItem, Rule } from "../src/content/types";

const t = (es: string, fr: string): Lang => ({ es, fr });

export const rules: Rule[] = [
  {
    id: "IMP-ongoing-interrupted",
    title: t("Acción en curso interrumpida", "Action en cours interrompue"),
    explanation: t("La acción que estaba pasando va en imparfait (en español, 'leía').", "L'action en cours se met à l'imparfait."),
  },
  {
    id: "PC-interrupting-event",
    title: t("Hecho que interrumpe", "Événement qui interrompt"),
    explanation: t("El hecho puntual que corta la acción va en passé composé (en español, 'llegó').", "L'événement ponctuel se met au passé composé."),
  },
  {
    id: "AUX-etre-motion",
    title: t("Movimiento con être", "Mouvement avec être"),
    explanation: t("Los verbos de movimiento o cambio de estado usan être.", "Les verbes de mouvement ou de changement d'état prennent être."),
  },
  {
    id: "SUBJ-necessity",
    title: t("Necesidad", "Nécessité"),
    explanation: t("Il faut que siempre pide subjuntivo.", "Il faut que est toujours suivi du subjonctif."),
  },
  {
    id: "IND-esperer",
    title: t("Espérer que", "Espérer que"),
    explanation: t("Espérer que va con indicativo.", "Espérer que se construit avec l'indicatif."),
    trap: t("En español 'espero que vengas' va en subjuntivo; en francés no.", "En espagnol, « espero que » demande le subjonctif."),
  },
  {
    id: "STEM-regular",
    title: t("Raíz regular", "Radical régulier"),
    explanation: t("Raíz de 'ils' en presente + -e, -es, -e, -ions, -iez, -ent.", "Radical de « ils » au présent + -e, -es, -e, -ions, -iez, -ent."),
  },
  {
    id: "STEM-irregular",
    title: t("Raíz irregular", "Radical irrégulier"),
    explanation: t("Être, avoir, aller, faire, pouvoir, savoir y vouloir tienen raíz propia.", "Être, avoir, aller, faire, pouvoir, savoir et vouloir ont un radical propre."),
  },
];

export const pastItem: PastItem = {
  id: "p-test-1",
  kind: "past",
  context: "daily",
  present: "Je [lis] quand Marie [arrive].",
  past: "Je lisais quand Marie est arrivée.",
  slots: [
    {
      verb: "lire",
      subject: "je",
      tense: "imp",
      accepted: ["lisais"],
      ruleId: "IMP-ongoing-interrupted",
      why: t("Leer es la acción en curso: 'leía'.", "Lire est l'action en cours."),
    },
    {
      verb: "arriver",
      subject: "Marie",
      tense: "pc",
      aux: "etre",
      auxRuleId: "AUX-etre-motion",
      accepted: ["est arrivée"],
      ruleId: "PC-interrupting-event",
      why: t("Llegar es el hecho que interrumpe: 'llegó'.", "Arriver est l'événement qui interrompt."),
    },
  ],
};

export const moodSubj: MoodItem = {
  id: "m-test-1",
  kind: "mood",
  context: "daily",
  sentence: "Il faut que tu ___ (faire) tes devoirs.",
  verb: "faire",
  mood: "subj",
  stem: "irregular",
  accepted: ["fasses"],
  ruleId: "SUBJ-necessity",
  why: t("'Il faut que' pide subjuntivo.", "« Il faut que » demande le subjonctif."),
};

export const moodInd: MoodItem = {
  id: "m-test-2",
  kind: "mood",
  context: "daily",
  sentence: "J'espère que tu ___ (venir) demain.",
  verb: "venir",
  mood: "ind",
  accepted: ["viendras", "viens"],
  ruleId: "IND-esperer",
  why: t("Espérer que va con indicativo, aunque en español digas 'espero que vengas'.", "Espérer que est suivi de l'indicatif."),
};
