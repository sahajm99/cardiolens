import { loadJson } from "../data.ts";
import { showError } from "../figure.ts";
import { pct } from "../fmt.ts";
import type { Estimator } from "../types.ts";

/** The three marks on the scale, in the order they are drawn and keyed. */
const MARKS = [
  { key: "profile", label: "This profile" },
  { key: "age", label: "Same age band" },
  { key: "all", label: "All adults" },
] as const;

const CAVEAT =
  "This is the pattern of association in one 2020 survey sample, not a medical risk score, and it holds alcohol use, asthma and skin cancer at 'No'. Nothing here is advice.";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The primary model's linear predictor for one set of answers. A coefficient
 * the file does not carry is skipped rather than added as NaN, so the output
 * degrades to "as if at the reference level" instead of breaking.
 */
function probability(est: Estimator, chosen: Map<string, string>): number {
  let logit = est.intercept;
  for (const input of est.inputs) {
    const level = chosen.get(input.variable) ?? input.default;
    const coef = est.coefficients[input.variable]?.[level];
    if (typeof coef !== "number" || !Number.isFinite(coef)) {
      console.warn(`estimator: no coefficient for ${input.variable} = ${level}`);
      continue;
    }
    logit += coef;
  }
  return 1 / (1 + Math.exp(-logit));
}

function position(value: number, max: number): string {
  const share = max > 0 ? value / max : 0;
  return `${(Math.min(1, Math.max(0, share)) * 100).toFixed(2)}%`;
}

/** The scale: a CSS track with one mark per number in the sentence above it. */
function buildScale(): {
  node: HTMLDivElement;
  marks: Map<string, HTMLSpanElement>;
  max: HTMLSpanElement;
} {
  const node = el("div", "est-scale");
  node.setAttribute("aria-hidden", "true");

  const track = el("div", "est-track");
  const marks = new Map<string, HTMLSpanElement>();
  for (const mark of MARKS) {
    const span = el("span", `est-mark est-mark-${mark.key}`);
    marks.set(mark.key, span);
    track.appendChild(span);
  }
  node.appendChild(track);

  const ends = el("div", "est-ends");
  ends.appendChild(el("span", undefined, pct(0, 0)));
  const max = el("span");
  ends.appendChild(max);
  node.appendChild(ends);

  const key = el("ul", "est-key");
  for (const mark of MARKS) {
    const item = el("li");
    item.appendChild(el("span", `est-swatch est-mark-${mark.key}`));
    item.appendChild(document.createTextNode(mark.label));
    key.appendChild(item);
  }
  node.appendChild(key);

  return { node, marks, max };
}

export async function render(container: HTMLElement): Promise<void> {
  let est: Estimator;
  try {
    est = await loadJson<Estimator>("estimator.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the model inputs.",
      () => void render(container),
    );
    return;
  }

  container.replaceChildren();
  container.appendChild(el("h3", "fig-title", "Put a profile through the model"));
  container.appendChild(
    el(
      "p",
      "fig-sub",
      "Fitted probabilities from the primary logistic model; every answer it takes is on this list, and the rest are held at their reference level",
    ),
  );

  // The form is built from `inputs` only: `coefficients` carries levels the
  // model fitted but no reader should be asked about.
  const chosen = new Map<string, string>();
  const form = el("form", "est-form");
  form.addEventListener("submit", (e) => e.preventDefault());
  for (const input of est.inputs) {
    chosen.set(input.variable, input.default);
    const field = el("div", "est-field");
    const select = el("select");
    select.id = `est-${input.variable}`;
    for (const level of input.levels) {
      const opt = el("option", undefined, level);
      opt.value = level;
      opt.selected = level === input.default;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      chosen.set(input.variable, select.value);
      update();
    });
    const label = el("label", undefined, input.label);
    label.htmlFor = select.id;
    field.append(label, select);
    form.appendChild(field);
  }
  container.appendChild(form);

  const out = el("div", "est-out");
  out.setAttribute("aria-live", "polite");
  const value = el("p", "est-value");
  const sentence = el("p", "est-sentence");
  out.append(value, sentence);
  container.appendChild(out);

  const scale = buildScale();
  container.appendChild(scale.node);
  container.appendChild(el("p", "fig-note", CAVEAT));

  function update(): void {
    const p = probability(est, chosen);
    const band = chosen.get("AgeCategory") ?? "";
    const bandRate = est.age_band_rates[band];
    // Room above the mark, but never past 100%: this is a share of people.
    const max = Math.min(1, Math.max(0.3, p * 1.2));

    value.textContent = pct(p);
    sentence.textContent =
      `Adults with these answers reported heart disease at ${pct(p)}. ` +
      `The survey average was ${pct(est.base_rate)}` +
      (bandRate === undefined
        ? "."
        : `; adults in the same age band, ${pct(bandRate)}.`);

    scale.marks.get("profile")?.style.setProperty("left", position(p, max));
    scale.marks
      .get("all")
      ?.style.setProperty("left", position(est.base_rate, max));
    const ageMark = scale.marks.get("age");
    if (ageMark) {
      ageMark.hidden = bandRate === undefined;
      if (bandRate !== undefined) {
        ageMark.style.setProperty("left", position(bandRate, max));
      }
    }
    scale.max.textContent = pct(max, 0);
  }

  update();
}
