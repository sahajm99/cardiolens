import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { ciText, int, pct, ratio } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { FactorContrast, FactorPrevalence, FactorSide } from "../types.ts";
import { CONFIG, layoutTemplate, series } from "./theme.ts";

const HOVER =
  "%{customdata[3]}<br><b>%{x:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}<extra>%{y}</extra>";

/**
 * Plotly stacks the first y category at the bottom, so the array is reversed:
 * the widest gap sits at the top, in the order the file delivers.
 */
function reversed<T>(xs: T[]): T[] {
  return xs.slice().reverse();
}

function dotTrace(
  factors: FactorContrast[],
  side: (f: FactorContrast) => FactorSide,
  name: string,
  color: string,
  errorColor: string,
  open: boolean,
): Partial<Plotly.PlotData> {
  const fs = reversed(factors);
  const cells = fs.map(side);
  return {
    type: "scatter",
    mode: "markers",
    name,
    y: fs.map((f) => f.label),
    x: cells.map((c) => c.p),
    customdata: cells.map((c) => [c.lo, c.hi, c.n, c.label]),
    hovertemplate: HOVER,
    marker: {
      symbol: open ? "circle-open" : "circle",
      color,
      size: 10,
      line: { color, width: 2 },
    },
    error_x: {
      type: "data",
      symmetric: false,
      array: cells.map((c) => c.hi - c.p),
      arrayminus: cells.map((c) => c.p - c.lo),
      color: errorColor,
      thickness: 1,
      width: 3,
    },
  };
}

export async function render(container: HTMLElement): Promise<void> {
  let data: FactorPrevalence;
  try {
    data = await loadJson<FactorPrevalence>("prevalence_by_factor.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the factor data.",
      () => void render(container),
    );
    return;
  }

  const factors = data.factors;
  const top = factors[0];
  if (!top) {
    showError(container, "The factor file carries no factors.", () =>
      void render(container),
    );
    return;
  }
  const maxHi = Math.max(
    ...factors.map((f) => Math.max(f.exposed.hi, f.unexposed.hi)),
  );

  const spec: FigureSpec = {
    id: "fig-factors",
    title: `${ratio(top.ratio)} the prevalence: ${top.label.toLowerCase()} shows the widest crude gap of any factor`,
    subtitle:
      "Crude (unadjusted) prevalence with 95% Wilson intervals; hollow = without the factor, filled = with it",
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Dot plot of ${int(factors.length)} factors. For each, the share reporting heart disease with and without the factor. The widest crude gap is ${top.label.toLowerCase()}: ${pct(top.exposed.p)} of adults with ${top.exposed.label.toLowerCase()} against ${pct(top.unexposed.p)} of adults with ${top.unexposed.label.toLowerCase()}, a ratio of ${ratio(top.ratio)}.`,
    table: {
      columns: ["Factor", "Group", "Adults", "Prevalence", "95% CI", "Ratio"],
      rows: factors.flatMap((f) => [
        [
          f.label,
          f.exposed.label,
          int(f.exposed.n),
          pct(f.exposed.p),
          ciText(f.exposed.lo, f.exposed.hi),
          ratio(f.ratio),
        ],
        [
          f.label,
          f.unexposed.label,
          int(f.unexposed.n),
          pct(f.unexposed.p),
          ciText(f.unexposed.lo, f.unexposed.hi),
          "reference",
        ],
      ]),
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const traces = [
      dotTrace(
        factors,
        (f) => f.unexposed,
        "Without the factor",
        c.s1,
        errorColor,
        true,
      ),
      dotTrace(
        factors,
        (f) => f.exposed,
        "With the factor",
        c.s1,
        errorColor,
        false,
      ),
    ];
    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.04,
        yanchor: "bottom",
        font: { color: cssVar("--ink-2") },
      },
      margin: { ...base.margin, t: 30 },
      hovermode: "closest",
      xaxis: {
        ...base.xaxis,
        tickformat: ".0%",
        range: [0, maxHi + 0.02],
        title: { text: "Report heart disease", standoff: 8 },
      },
      yaxis: { ...base.yaxis, automargin: true, showgrid: false },
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
