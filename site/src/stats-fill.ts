import { int, oneIn, pct, pct0, ratio } from "./fmt.ts";

type Formatter = (value: number) => string;

const FORMATTERS: Record<string, Formatter> = {
  pct,
  pct0,
  ratio,
  int,
  oneIn,
  raw: (v) => String(v),
};

/**
 * Fill every `<span data-stat="key|fmt">` from claims.json, so no number that
 * describes the data is hand-typed in the HTML.
 */
export function fillStats(claims: Record<string, number | string>): void {
  for (const node of document.querySelectorAll<HTMLElement>("[data-stat]")) {
    const spec = node.dataset.stat ?? "";
    const [key, fmtName = "raw"] = spec.split("|");
    const value = claims[key];
    if (value === undefined) {
      console.warn(`stats-fill: claims.json has no key "${key}"`);
      continue;
    }
    if (typeof value === "string") {
      node.textContent = value;
      continue;
    }
    const fmt = FORMATTERS[fmtName];
    if (!fmt) {
      console.warn(`stats-fill: unknown format "${fmtName}" for "${key}"`);
      continue;
    }
    node.textContent = fmt(value);
  }
}

