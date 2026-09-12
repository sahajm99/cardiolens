import { loadJson } from "../data.ts";
import { el, showError } from "../figure.ts";
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

/**
 * The three variables the caveat above promises are held at their reference
 * level. If a pipeline run ever changes the model's held set, the note would
 * quietly become false, so the panel refuses to draw instead.
 */
const HELD_IN_CAVEAT = ["AlcoholDrinking", "Asthma", "SkinCancer"];

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((v, i) => v === sorted[i]);
}

/**
 * The primary model's linear predictor for one set of answers. A coefficient
 * the file does not carry is an error rather than a skipped term: silently
 * treating the answer as the reference level would print a number that the
 * reader's answers did not produce.
 */
function probability(est: Estimator, chosen: Map<string, string>): number {
  let logit = est.intercept;
  for (const input of est.inputs) {
    const level = chosen.get(input.variable) ?? input.default;
    const coef = est.coefficients[input.variable]?.[level];
    if (typeof coef !== "number" || !Number.isFinite(coef)) {
      throw new Error(
        `The model file carries no coefficient for ${input.label} = "${level}".`,
      );
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

  if (!sameSet(est.held_at_reference, HELD_IN_CAVEAT)) {
    showError(
      container,
      "The model file holds different answers at their reference level than the note under this panel states, so the panel is not drawn.",
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
      void update();
    });
    const label = el("label", undefined, input.label);
    label.htmlFor = select.id;
    field.append(label, select);
    form.appendChild(field);
  }
  container.appendChild(form);

  const out = el("div", "est-out");
  const value = el("p", "est-value");
  const sentence = el("p", "est-sentence");
  out.append(value, sentence);
  const scale = buildScale();

  function update(): boolean {
    let p: number;
    try {
      p = probability(est, chosen);
    } catch (err) {
      showError(
        container,
        err instanceof Error
          ? err.message
          : "The model file is missing a coefficient this panel needs.",
        () => void render(container),
      );
      return false;
    }
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
    return true;
  }

  // The first value is written before the live region joins the document, so
  // a screen reader reads it as part of the panel rather than announcing it as
  // a change the reader did not make.
  if (!update()) return;
  out.setAttribute("aria-live", "polite");
  container.append(out, scale.node, el("p", "fig-note", CAVEAT));
}
