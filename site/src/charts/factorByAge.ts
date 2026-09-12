import { loadJson } from "../data.ts";
import {
  mountFigure,
  showError,
  updateFigure,
  type FigureSpec,
} from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type {
  FactorAgeCell,
  FactorAgeSeries,
  FactorByAge,
} from "../types.ts";
import { CONFIG, hexToRgba, layoutTemplate, series } from "./theme.ts";

/** A cell with an estimate. Suppressed cells break the line and the ribbon. */
interface Point {
  age: string;
  p: number;
  lo: number;
  hi: number;
  n: number;
  smallN: boolean;
}

type Side = (row: FactorAgeSeries["rows"][number]) => FactorAgeCell;

const EXPOSED: Side = (r) => r.exposed;
const UNEXPOSED: Side = (r) => r.unexposed;

const HOVER =
  "%{x}<br><b>%{y:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}";

function point(age: string, cell: FactorAgeCell): Point | null {
  if (cell.suppressed || cell.p === null || cell.lo === null || cell.hi === null)
    return null;
  return {
    age,
    p: cell.p,
    lo: cell.lo,
    hi: cell.hi,
    n: cell.n,
    smallN: cell.small_n,
  };
}

/** Runs of consecutive drawable points: a suppressed band ends the polygon. */
function runs(factor: FactorAgeSeries, side: Side): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  for (const row of factor.rows) {
    const pt = point(row.age, side(row));
    if (pt) {
      run.push(pt);
      continue;
    }
    if (run.length) out.push(run);
    run = [];
  }
  if (run.length) out.push(run);
  return out;
}

/**
 * The interval band behind a line. One trace holds every run: with
 * `fill: "toself"` a null coordinate closes one polygon and starts the next.
 */
function ribbonTrace(
  factor: FactorAgeSeries,
  side: Side,
  color: string,
): Partial<Plotly.PlotData> {
  const x: (string | null)[] = [];
  const y: (number | null)[] = [];
  for (const run of runs(factor, side)) {
    const back = run.slice().reverse();
    x.push(...run.map((d) => d.age), ...back.map((d) => d.age), null);
    y.push(...run.map((d) => d.hi), ...back.map((d) => d.lo), null);
  }
  return {
    type: "scatter",
    mode: "lines",
    x,
    y,
    fill: "toself",
    fillcolor: hexToRgba(color, 0.12),
    line: { width: 0 },
    hoverinfo: "skip",
    showlegend: false,
  };
}

function lineTrace(
  factor: FactorAgeSeries,
  side: Side,
  name: string,
  color: string,
): Partial<Plotly.PlotData> {
  const pts = factor.rows.map((row) => point(row.age, side(row)));
  return {
    type: "scatter",
    mode: "lines+markers",
    name,
    x: factor.rows.map((row) => row.age),
    y: pts.map((d) => (d ? d.p : null)),
    customdata: pts.map((d) => [d?.lo ?? null, d?.hi ?? null, d?.n ?? null]),
    hovertemplate: `${HOVER}<extra>${name}</extra>`,
    connectgaps: false,
    line: { color, width: 2 },
    marker: { size: 6, color },
  };
}

/**
 * Thin cells restated in grey on top of the line. An overlay rather than a
 * per-point colour array, so the legend keeps the series colour.
 */
function smallNTrace(
  factor: FactorAgeSeries,
  side: Side,
  mutedColor: string,
): Partial<Plotly.PlotData> | null {
  const thin = factor.rows
    .map((row) => point(row.age, side(row)))
    .filter((d): d is Point => d !== null && d.smallN);
  if (!thin.length) return null;
  return {
    type: "scatter",
    mode: "markers",
    x: thin.map((d) => d.age),
    y: thin.map((d) => d.p),
    marker: { size: 6, color: mutedColor },
    hoverinfo: "skip",
    showlegend: false,
  };
}

function picker(
  factors: FactorAgeSeries[],
  selected: string,
  onChange: (id: string) => void,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "fig-picker";

  const select = document.createElement("select");
  select.id = "fig-factor-by-age-picker";
  for (const f of factors) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.label;
    opt.selected = f.id === selected;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onChange(select.value));

  const label = document.createElement("label");
  label.htmlFor = select.id;
  label.textContent = "Factor";

  wrap.append(label, select);
  return wrap;
}

/** The claim only holds if the gap survives in nearly every band. */
function claim(factor: FactorAgeSeries): string {
  let compared = 0;
  let higher = 0;
  for (const row of factor.rows) {
    const a = point(row.age, EXPOSED(row));
    const b = point(row.age, UNEXPOSED(row));
    if (!a || !b) continue;
    compared += 1;
    if (a.p > b.p) higher += 1;
  }
  // Ten of the thirteen bands, or the same three-quarters share of however
  // many bands the file delivers.
  return higher >= Math.ceil(compared * 0.75)
    ? `Within every age band, ${factor.exposed_label.toLowerCase()} adults report more heart disease`
    : `${factor.exposed_label} and ${factor.unexposed_label.toLowerCase()} adults look alike once age is held fixed`;
}

function specFor(factor: FactorAgeSeries): FigureSpec {
  const rows: (string | number)[][] = [];
  for (const row of factor.rows) {
    for (const [name, side] of [
      [factor.exposed_label, EXPOSED],
      [factor.unexposed_label, UNEXPOSED],
    ] as const) {
      const cell = side(row);
      const pt = point(row.age, cell);
      rows.push([
        row.age,
        name,
        int(cell.n),
        pt ? pct(pt.p) : "suppressed",
        pt ? ciText(pt.lo, pt.hi) : "—",
      ]);
    }
  }
  return {
    id: "fig-factor-by-age",
    title: claim(factor),
    subtitle:
      "Prevalence by five-year age band, 95% Wilson intervals; grey points have n under 300",
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Line chart. Heart disease prevalence by age band for ${factor.exposed_label.toLowerCase()} and ${factor.unexposed_label.toLowerCase()} adults, each with a 95% interval band. ${claim(factor)}.`,
    table: {
      columns: ["Age band", "Group", "Adults", "Prevalence", "95% CI"],
      rows,
    },
  };
}

export async function render(container: HTMLElement): Promise<void> {
  let data: FactorByAge;
  try {
    data = await loadJson<FactorByAge>("factor_by_age.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error
        ? err.message
        : "Could not load the factor-by-age data.",
      () => void render(container),
    );
    return;
  }

  const first = data.factors[0];
  if (!first) {
    showError(container, "The factor-by-age file carries no factors.", () =>
      void render(container),
    );
    return;
  }
  let factor: FactorAgeSeries = first;

  const plot = mountFigure(container, specFor(factor));
  plot.before(
    picker(data.factors, factor.id, (id) => {
      const next = data.factors.find((f) => f.id === id);
      if (!next) return;
      factor = next;
      updateFigure(container, specFor(factor));
      void draw();
    }),
  );

  function draw(): Promise<unknown> {
    const c = series();
    const traces = [
      ribbonTrace(factor, UNEXPOSED, c.muted),
      ribbonTrace(factor, EXPOSED, c.s1),
      lineTrace(factor, UNEXPOSED, factor.unexposed_label, c.muted),
      lineTrace(factor, EXPOSED, factor.exposed_label, c.s1),
      smallNTrace(factor, UNEXPOSED, c.muted),
      smallNTrace(factor, EXPOSED, c.muted),
    ].filter((t): t is Partial<Plotly.PlotData> => t !== null);
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
        type: "category",
        showgrid: false,
        automargin: true,
      },
      yaxis: {
        ...base.yaxis,
        automargin: true,
        tickformat: ".0%",
        rangemode: "tozero",
        title: { text: "Report heart disease", standoff: 8 },
      },
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
