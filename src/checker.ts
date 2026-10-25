export type Category = "accent" | "agreement" | "auxiliary" | "ending" | "stem" | "other";

export type CheckResult =
  | { verdict: "exact" }
  | { verdict: "near"; category: Category; closest: string }
  | { verdict: "far"; closest: string };

export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02BC`\u00B4]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = above;
    }
  }
  return row[b.length];
}

const stripAgreement = (word: string) => word.replace(/(es|e|s)$/, "");

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function categorize(n: string, c: string): Category | null {
  if (stripAccents(n) === stripAccents(c)) return "accent";

  const nw = n.split(" ");
  const cw = c.split(" ");
  if (nw.length >= 2 && nw.length === cw.length) {
    const samePrefix = nw.slice(0, -1).join(" ") === cw.slice(0, -1).join(" ");
    const sameParticiple = stripAgreement(nw[nw.length - 1]) === stripAgreement(cw[cw.length - 1]);
    if (samePrefix && sameParticiple) return "agreement";
    if (!samePrefix && sameParticiple) return "auxiliary";
  }

  const dist = levenshtein(n, c);
  const prefix = commonPrefix(n, c);
  if (dist <= 3 && prefix >= 3 && prefix >= c.length - 4) return "ending";
  const suffix = commonSuffix(n, c);
  if (dist <= 3 && suffix >= 2 && n.slice(0, n.length - suffix) !== c.slice(0, c.length - suffix)) return "stem";
  if (dist <= (c.length > 8 ? 3 : 2)) return "other";
  return null;
}

export function check(input: string, accepted: string[]): CheckResult {
  const n = normalize(input);
  const candidates = accepted.map(normalize);
  if (candidates.includes(n)) return { verdict: "exact" };
  let closest = candidates[0];
  for (const c of candidates) if (levenshtein(n, c) < levenshtein(n, closest)) closest = c;
  const category = n === "" ? null : categorize(n, closest);
  return category ? { verdict: "near", category, closest } : { verdict: "far", closest };
}
