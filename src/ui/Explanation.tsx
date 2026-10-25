import type { Lang, Rule } from "../content/types";

type Props = { why?: Lang; rule?: Rule; lang: "es" | "fr"; onLang: (lang: "es" | "fr") => void };

export function Explanation({ why, rule, lang, onLang }: Props) {
  return (
    <div class="explain">
      <div class="toggle">
        <button class={lang === "es" ? "on" : ""} onClick={() => onLang("es")}>ES</button>
        <button class={lang === "fr" ? "on" : ""} onClick={() => onLang("fr")}>FR</button>
      </div>
      {why && <p>{why[lang]}</p>}
      {rule && (
        <p>
          <strong>{rule.title[lang]}</strong>: {rule.explanation[lang]}
        </p>
      )}
      {rule?.trap && <p class="trap">{rule.trap[lang]}</p>}
    </div>
  );
}
