import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { int, ratio } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { OddsModel, OddsRatios, OddsTerm } from "../types.ts";
import {
  CONFIG,
  errorBars,
  layoutTemplate,
  reversed,
  series,
} from "./theme.ts";

/** Ticks of the log axis: the odds ratios this file carries span 0.7 to 38. */
const TICKS = [0.5, 1, 2, 5, 10, 20, 40];

const UPSTREAM_HEADING =
  "Adjusted for each other: plausibly upstream factors (primary model)";
const DOWNSTREAM_HEADING =
  "Markers that travel with heart disease: not causes (full model)";

function findTerm(
  model: OddsModel,
  variable: string,
  level: string,
): OddsTerm | undefined {
  return model.terms.find((t) => t.variable === variable && t.level === level);
}

/** The file writes an exact zero for anything the fit reports below 0.001. */
function pText(p: number | null): string {
  if (p === null) return "";
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}

/** Marginal effect in percentage points, signed, as the table prints it. */
function ameText(ame: number | null): string {
  if (ame === null) return "—";
  const pp = ame * 100;
  return `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)} pp`;
}

function ciRatio(lo: number | null, hi: number | null): string {
  if (lo === null || hi === null) return "—";
  return `${ratio(lo)} to ${ratio(hi)}`;
}

const HOVER =
  "<b>%{x:.2f}x</b> %{customdata[0]}<br>n = %{customdata[1]:,}%{customdata[2]}<extra>%{y}</extra>";

/**
 * One group of rows. `open` draws the hollow marker a reference level gets;
 * `bars` is false for any row the file gives no interval for, so an estimate
 * without a 95% interval never shows a bar of zero length instead of none.
 */
function termTrace(
  terms: OddsTerm[],
  axis: "y" | "y2",
  color: string,
  open: boolean,
  bars: boolean,
): Partial<Plotly.PlotData> {
  const ts = reversed(terms);
  return {
    type: "scatter",
    mode: "markers",
    yaxis: axis,
    xaxis: "x",
    showlegend: false,
    y: ts.map((t) => t.label),
    x: ts.map((t) => t.or),
    customdata: ts.map((t) => [
      t.is_reference
        ? "(reference level)"
        : t.lo === null || t.hi === null
          ? "(no interval in the file)"
          : `(95% CI ${ciRatio(t.lo, t.hi)})`,
      t.n_level,
      t.p_value === null ? "" : `<br>${pText(t.p_value)}`,
    ]),
    hovertemplate: HOVER,
    marker: {
      symbol: open ? "circle-open" : "circle",
      color,
      size: 7,
      line: { color, width: 1.5 },
    },
    error_x: bars
      ? {
          ...errorBars(
            ts.map((t) => t.or),
            ts.map((t) => t.lo ?? t.or),
            ts.map((t) => t.hi ?? t.or),
            color,
          ),
          width: 0,
        }
      : undefined,
  };
}

/**
 * Reference rows, stable estimates, and the rows that get the muted colour:
 * an estimate the fit flagged unstable, and any estimate the file carries no
 * interval for. Neither of those is drawn with a bar.
 */
function panelTraces(
  terms: OddsTerm[],
  axis: "y" | "y2",
  color: string,
  mutedColor: string,
): Partial<Plotly.PlotData>[] {
  const out: Partial<Plotly.PlotData>[] = [];
  const hasCi = (t: OddsTerm): boolean => t.lo !== null && t.hi !== null;
  const refs = terms.filter((t) => t.is_reference);
  const rest = terms.filter((t) => !t.is_reference);
  const stable = rest.filter((t) => hasCi(t) && !t.unstable);
  const unstable = rest.filter((t) => hasCi(t) && t.unstable);
  const noCi = rest.filter((t) => !hasCi(t));
  if (refs.length) out.push(termTrace(refs, axis, color, true, false));
  if (stable.length) out.push(termTrace(stable, axis, color, false, true));
  if (unstable.length)
    out.push(termTrace(unstable, axis, mutedColor, false, true));
  if (noCi.length) out.push(termTrace(noCi, axis, mutedColor, false, false));
  return out;
}

function tableRows(terms: OddsTerm[]): (string | number)[][] {
  return terms.map((t) => [
    t.variable,
    t.label,
    t.is_reference ? "1 (reference)" : ratio(t.or),
    ciRatio(t.lo, t.hi),
    ameText(t.ame),
    int(t.n_level),
  ]);
}

export async function render(container: HTMLElement): Promise<void> {
  let data: OddsRatios;
  try {
    data = await loadJson<OddsRatios>("odds_ratios.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the model data.",
      () => void render(container),
    );
    return;
  }

  const primary = data.models.primary;
  const full = data.models.full;
  const upstream = primary.terms.filter((t) => t.group === "upstream");
  const downstream = full.terms.filter((t) => t.group === "downstream");

  const quoted = [
    ["smoking", findTerm(primary, "Smoking", "Yes")],
    ["stroke", findTerm(primary, "Stroke", "Yes")],
    ["diabetes", findTerm(primary, "Diabetic", "Yes")],
    ["kidney disease", findTerm(primary, "KidneyDisease", "Yes")],
  ] as const;
  if (quoted.some(([, t]) => !t) || !upstream.length || !downstream.length) {
    showError(
      container,
      "The model file is missing terms this chart quotes.",
      () => void render(container),
    );
    return;
  }
  const named = quoted.map(([name, t]) => `${name} (${ratio(t!.or)})`);
  const claim = `After adjusting for age and each other, ${named.slice(0, -1).join(", ")} and ${named[named.length - 1]} still stand out`;

  // Both panels share one x range, so a marker's distance from the line at 1
  // means the same thing in each.
  const values = [...upstream, ...downstream].flatMap((t) => [
    t.or,
    t.lo ?? t.or,
    t.hi ?? t.or,
  ]);
  const xRange: [number, number] = [
    Math.log10(Math.min(...values) / 1.25),
    Math.log10(Math.max(...values) * 1.25),
  ];

  // Rows are the same height in both panels, with a gap for the second heading.
  const gap = 0.08;
  const share = (1 - gap) * (downstream.length / (upstream.length + downstream.length));
  const topDomain: [number, number] = [share + gap, 1];
  const bottomDomain: [number, number] = [0, share];

  const spec: FigureSpec = {
    id: "fig-forest",
    title: claim,
    subtitle: `Adjusted odds ratios with 95% intervals, logistic regression on ${int(primary.n_obs)} adults; an odds ratio is not a prevalence ratio, and this survey cannot show cause`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Forest plot on a log scale. The upper panel shows the primary model's adjusted odds ratios for age, sex, BMI class and diagnosed conditions; the lower panel shows physical activity, difficulty walking and self-rated health from the full model. ${claim}.`,
    table: {
      columns: [
        "Variable",
        "Level",
        "Odds ratio",
        "95% CI",
        "Marginal effect",
        "Adults",
      ],
      rows: [...tableRows(upstream), ...tableRows(downstream)],
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    const c = series();
    const ink = cssVar("--ink");
    const traces = [
      ...panelTraces(upstream, "y", c.s1, c.muted),
      ...panelTraces(downstream, "y2", c.s1, c.muted),
    ];
    const base = layoutTemplate();
    const yAxis = {
      ...base.yaxis,
      automargin: true,
      showgrid: false,
      anchor: "x" as const,
      categoryorder: "array" as const,
      tickfont: { color: cssVar("--ink-2"), size: 11 },
      dtick: 1,
    };
    const heading = (text: string, y: number) => ({
      text: `<b>${text}</b>`,
      xref: "paper" as const,
      yref: "paper" as const,
      x: 0,
      y,
      xanchor: "left" as const,
      yanchor: "bottom" as const,
      showarrow: false,
      font: { color: ink, size: 13 },
    });
    const layout: Partial<Plotly.Layout> = {
      ...base,
      showlegend: false,
      hovermode: "closest",
      margin: { ...base.margin, t: 34, b: 44 },
      grid: { rows: 2, columns: 1, roworder: "top to bottom" },
      xaxis: {
        ...base.xaxis,
        type: "log",
        range: xRange,
        anchor: "y2",
        domain: [0, 1],
        tickmode: "array",
        tickvals: TICKS,
        ticktext: TICKS.map((t) => `${t}x`),
        title: { text: "Adjusted odds ratio (log scale)", standoff: 6 },
      },
      yaxis: {
        ...yAxis,
        domain: topDomain,
        categoryarray: reversed(upstream.map((t) => t.label)),
      },
      yaxis2: {
        ...yAxis,
        domain: bottomDomain,
        categoryarray: reversed(downstream.map((t) => t.label)),
      },
      // Shape coordinates are data values: Plotly applies the axis transform,
      // so 1 lands on the tick marked 1x rather than at log10(1).
      shapes: [
        {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: 1,
          x1: 1,
          y0: 0,
          y1: 1,
          line: { color: cssVar("--ink-3"), width: 1, dash: "dot" },
        },
      ],
      annotations: [
        heading(UPSTREAM_HEADING, 1.005),
        heading(DOWNSTREAM_HEADING, bottomDomain[1] + 0.012),
      ],
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
