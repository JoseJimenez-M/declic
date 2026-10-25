import { useEffect, useRef, useState } from "preact/hooks";
import type { Item, Rule } from "../content/types";
import { apply, outcomeOf, start, type Attempt, type FlowEvent, type FlowState } from "../flow";
import type { Outcome } from "../srs";
import { Explanation } from "./Explanation";

const LABELS: Record<string, string> = {
  pc: "Passé composé",
  imp: "Imparfait",
  avoir: "avoir",
  etre: "être",
  ind: "Indicatif",
  subj: "Subjonctif",
  regular: "Raíz regular",
  irregular: "Irregular",
};

const NEAR_HINT: Record<string, string> = {
  accent: "Casi: revisa los acentos.",
  agreement: "Casi: revisa la concordancia del participio.",
  auxiliary: "Casi: revisa el auxiliar.",
  ending: "Casi: revisa la terminación.",
  stem: "Casi: revisa la raíz.",
  other: "Casi: revisa la ortografía.",
};

type Props = {
  queue: Item[];
  rules: Map<string, Rule>;
  lang: "es" | "fr";
  onLang: (lang: "es" | "fr") => void;
  onAttempts: (list: Attempt[]) => void;
  onItemDone: (item: Item, outcome: Outcome) => void;
  onReport: (itemId: string) => void;
  onExit: () => void;
};

function Sentence({ flow }: { flow: FlowState }) {
  const item = flow.item;
  if (item.kind === "mood") return <p class="sentence">{item.sentence}</p>;
  let slot = -1;
  return (
    <p class="sentence">
      {item.present.split(/(\[[^\]]+\])/).map((part, i) => {
        if (!part.startsWith("[")) return <span key={i}>{part}</span>;
        slot += 1;
        return (
          <span key={i} class={!flow.done && slot === flow.slotIndex ? "current" : "verb"}>
            {part.slice(1, -1)}
          </span>
        );
      })}
    </p>
  );
}

const finalSentence = (item: Item) =>
  item.kind === "past" ? item.past : item.sentence.replace(/___ \([^)]*\)|___/, item.accepted[0]);

export function Exercise(p: Props) {
  const [index, setIndex] = useState(0);
  const [flow, setFlow] = useState<FlowState | null>(() => (p.queue.length > 0 ? start(p.queue[0]) : null));
  const [input, setInput] = useState("");
  const [reported, setReported] = useState(false);
  const shownAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus only applies on first mount, so focus the field explicitly whenever the typing step becomes active.
  const fbKind = flow?.feedback?.kind;
  const typingActive = !!flow && !flow.done && flow.step === 3 && fbKind !== "wrong-choice" && fbKind !== "revealed";
  useEffect(() => {
    if (typingActive) inputRef.current?.focus();
  }, [index, flow?.slotIndex, flow?.step, flow?.typingAttempt, typingActive]);

  if (!flow) {
    return (
      <main class="app">
        <p class="big">No hay frases pendientes por ahora.</p>
        <button onClick={p.onExit}>Volver</button>
      </main>
    );
  }

  const ms = () => Date.now() - shownAt.current;

  const send = (event: FlowEvent) => {
    const r = apply(flow, event, new Date().toISOString());
    if (r.attempts.length > 0) p.onAttempts(r.attempts);
    if (r.state.done && !flow.done) p.onItemDone(flow.item, outcomeOf(r.state));
    const retyping = !r.state.done && r.state.step === 3 && r.state.slotIndex === flow.slotIndex && r.state.typingAttempt === 2;
    if (!retyping) setInput("");
    setFlow(r.state);
    shownAt.current = Date.now();
  };

  const nextItem = () => {
    const i = index + 1;
    if (i >= p.queue.length) {
      p.onExit();
      return;
    }
    setIndex(i);
    setFlow(start(p.queue[i]));
    setInput("");
    setReported(false);
    shownAt.current = Date.now();
  };

  const submit = () => {
    if (input.trim() !== "") send({ type: "type", input, ms: ms() });
  };

  const slot = flow.slots[flow.slotIndex];
  const choice = flow.step === 1 ? slot.first : flow.step === 2 ? slot.second : undefined;
  const fb = flow.feedback;
  const blocked = fb && (fb.kind === "wrong-choice" || fb.kind === "revealed") ? fb : null;
  const isPast = flow.item.kind === "past";
  const question = isPast
    ? flow.step === 1 ? "¿Qué tiempo va?" : "¿Con qué auxiliar?"
    : flow.step === 1 ? "¿Qué modo pide?" : "¿La raíz es regular o irregular?";

  return (
    <main class="app">
      <header class="top">
        <span class="muted">{index + 1} / {p.queue.length}</span>
        <button class="ghost" onClick={p.onExit}>Salir</button>
      </header>

      <section class="card">
        <p class="muted">{isPast ? "Pásala a pasado" : "Completa con el modo correcto"}</p>
        {flow.item.kind === "past" && flow.item.frame && <p class="muted">{flow.item.frame}…</p>}
        <Sentence flow={flow} />
        {!flow.done && <p class="muted">Verbo: {slot.verb}</p>}
      </section>

      {flow.done ? (
        <section class="card">
          <p class="ok">{finalSentence(flow.item)}</p>
          <div class="row">
            <button
              disabled={reported}
              onClick={() => {
                p.onReport(flow.item.id);
                setReported(true);
              }}
            >
              {reported ? "Reportada" : "Reportar frase"}
            </button>
            <button class="primary" onClick={nextItem}>Siguiente</button>
          </div>
        </section>
      ) : blocked ? (
        <section class="card">
          <p class="bad">
            {blocked.kind === "wrong-choice" ? `No. Era ${LABELS[blocked.answer] ?? blocked.answer}.` : `Respuesta: ${LABELS[blocked.answer] ?? blocked.answer}`}
          </p>
          <Explanation why={blocked.why} rule={p.rules.get(blocked.ruleId)} lang={p.lang} onLang={p.onLang} />
          <button class="primary" onClick={() => send({ type: "next" })}>Continuar</button>
        </section>
      ) : choice ? (
        <section class="card">
          <p class="big">{question}</p>
          <div class="choices">
            {choice.options.map((o) => (
              <button key={o} onClick={() => send({ type: "choose", option: o, ms: ms() })}>
                {LABELS[o]}
              </button>
            ))}
          </div>
          <button class="ghost" onClick={() => send({ type: "help", ms: ms() })}>Ayuda</button>
        </section>
      ) : (
        <section class="card">
          <p class="big">Escribe la forma{isPast ? `: ${slot.subject} ___ (${slot.verb})` : ""}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellcheck={false}
            />
          </form>
          {fb?.kind === "near" && <p class="hint">{NEAR_HINT[fb.category]}</p>}
          {fb?.kind === "far" && <p class="bad">Lejos. Inténtalo otra vez o pide ayuda.</p>}
          <div class="row">
            <button class="ghost" onClick={() => send({ type: "help", ms: ms() })}>Ayuda</button>
            <button class="primary" onClick={submit}>Comprobar</button>
          </div>
        </section>
      )}
    </main>
  );
}
