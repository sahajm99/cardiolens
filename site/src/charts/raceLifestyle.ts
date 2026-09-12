import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { RacePrevalence, Summary, SummaryRow } from "../types.ts";
import { CONFIG, errorBars, layoutTemplate, series } from "./theme.ts";

/** Below this width the three panels stack instead of sitting side by side. */
const NARROW = 640;
const HEIGHT_WIDE = "420px";
const HEIGHT_STACKED = "720px";

interface Value {
  mid: number;
  lo: number;
  hi: number;
}

interface Metric {
  heading: string;
  /** Null when the file does not carry this measure, or the row is suppressed. */
  value: (row: SummaryRow) => Value | null;
  tickformat: string;
  text: (v: number) => string;
}

function pair(
  mid: number | null | undefined,
  lo: number | null | undefined,
  hi: number | null | undefined,
): Value | null {
  if (mid === null || mid === undefined) return null;
  return { mid, lo: lo ?? mid, hi: hi ?? mid };
}

const one = (v: number): string => v.toFixed(1);

/**
 * Every measure the summary file can carry. Only the ones actually present are
 * drawn, so a later pipeline run that adds a measure needs no site change.
 */
const METRICS: Metric[] = [
  {
    heading: "Mean BMI (kg/m²)",
    value: (r) => pair(r.bmi_mean, r.bmi_lo, r.bmi_hi),
    tickformat: ".1f",
    text: one,
  },
  {
    heading: "Mean sleep (hours)",
    value: (r) => pair(r.sleep_mean, r.sleep_lo, r.sleep_hi),
    tickformat: ".1f",
    text: one,
  },
  {
    heading: "Physical activity (%)",
    value: (r) => pair(r.activity_rate, r.activity_lo, r.activity_hi),
    tickformat: ".0%",
    text: (v) => pct(v),
  },
];

/**
 * Plotly stacks the first y category at the bottom, so the array is reversed:
 * the groups read top to bottom in the order the file delivers them.
 */
function reversed<T>(xs: T[]): T[] {
  return xs.slice().reverse();
}

function fold(values: number[]): number {
  const lo = Math.min(...values);
  return lo > 0 ? Math.max(...values) / lo : Number.POSITIVE_INFINITY;
}

export async function render(container: HTMLElement): Promise<void> {
  let data: Summary;
  let prevalence: RacePrevalence;
  try {
    [data, prevalence] = await Promise.all([
      loadJson<Summary>("race_lifestyle.json"),
      loadJson<RacePrevalence>("race_prevalence.json"),
    ]);
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the lifestyle data.",
      () => void render(container),
    );
    return;
  }

  const rows = data.rows.filter((r) => !r.suppressed);
  const metrics = METRICS.filter((m) => rows.some((r) => m.value(r) !== null));
  const bmi = METRICS[0] as Metric;
  const bmiValues = rows
    .map((r) => bmi.value(r))
    .filter((v): v is Value => v !== null)
    .map((v) => v.mid);
  if (!rows.length || !metrics.length || !bmiValues.length) {
    showError(container, "The lifestyle file carries no measures.", () =>
      void render(container),
    );
    return;
  }

  const label = (row: SummaryRow): string => row.key[0] ?? "";
  // "Far less" is a comparison, so it is checked: every measure's spread,
  // as a ratio of its own smallest group, against heart disease prevalence.
  const hdFold = fold(prevalence.rows.map((r) => r.crude));
  const flatter = metrics.every((m) => {
    const values = rows
      .map((r) => m.value(r))
      .filter((v): v is Value => v !== null)
      .map((v) => v.mid);
    return values.length > 0 && fold(values) < hdFold;
  });
  const span = `mean BMI spans ${one(Math.min(...bmiValues))} to ${one(Math.max(...bmiValues))}`;
  const title = flatter
    ? `Lifestyle measures vary far less between groups than heart disease does: ${span}`
    : `Lifestyle measures by group: ${span}`;

  const spec: FigureSpec = {
    id: "fig-race-lifestyle",
    title,
    subtitle: `${metrics.length === 1 ? "One measure" : `${metrics.length === 2 ? "Two" : "Three"} measures`} per group, each on its own scale; 95% intervals`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `${metrics.length} small panels side by side, one per lifestyle measure, each with a dot and 95% interval per group. ${title}.`,
    table: {
      columns: [
        "Group",
        "Adults",
        ...metrics.flatMap((m) => [m.heading, "95% CI"]),
      ],
      rows: rows.map((r) => [
        label(r) + (r.small_n ? " (small n)" : ""),
        int(r.n),
        ...metrics.flatMap((m) => {
          const v = m.value(r);
          if (!v) return ["—", "—"];
          return [m.text(v.mid), `${m.text(v.lo)} to ${m.text(v.hi)}`];
        }),
      ]),
    },
  };

  const plot = mountFigure(container, spec);
  let stacked = container.clientWidth > 0 && container.clientWidth < NARROW;

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const ink2 = cssVar("--ink-2");
    const rs = reversed(rows);
    const names = rs.map(label);

    const traces: Partial<Plotly.PlotData>[] = [];
    const annotations: Partial<Plotly.Annotations>[] = [];
    const axes: Record<string, Partial<Plotly.LayoutAxis>> = {};
    const base = layoutTemplate();

    metrics.forEach((metric, i) => {
      const suffix = i === 0 ? "" : String(i + 1);
      const drawn = rs
        .map((r) => ({ row: r, value: metric.value(r) }))
        .filter((d): d is { row: SummaryRow; value: Value } => d.value !== null);

      traces.push({
        type: "scatter",
        mode: "markers",
        name: metric.heading,
        xaxis: `x${suffix}`,
        yaxis: `y${suffix}`,
        x: drawn.map((d) => d.value.mid),
        y: drawn.map((d) => label(d.row)),
        customdata: drawn.map((d) => [d.value.lo, d.value.hi, d.row.n]),
        hovertemplate:
          `%{y}<br><b>%{x:${metric.tickformat}}</b> (95% CI %{customdata[0]:${metric.tickformat}} to %{customdata[1]:${metric.tickformat}})<br>n = %{customdata[2]:,}<extra>${metric.heading}</extra>`,
        marker: {
          size: 9,
          color: drawn.map((d) => (d.row.small_n ? c.muted : c.s1)),
        },
        error_x: errorBars(
          drawn.map((d) => d.value.mid),
          drawn.map((d) => d.value.lo),
          drawn.map((d) => d.value.hi),
          errorColor,
        ),
        showlegend: false,
      });

      // Room either side of the widest interval, so no marker is half-drawn
      // against the edge of its panel.
      const ends = drawn.flatMap((d) => [d.value.lo, d.value.hi]);
      const lo = Math.min(...ends);
      const hi = Math.max(...ends);
      const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;

      axes[`xaxis${suffix}`] = {
        ...base.xaxis,
        tickformat: metric.tickformat,
        nticks: stacked ? 6 : 4,
        range: [lo - pad, hi + pad],
        automargin: true,
      };
      axes[`yaxis${suffix}`] = {
        ...base.yaxis,
        type: "category",
        categoryorder: "array",
        categoryarray: names,
        showgrid: false,
        automargin: true,
        showticklabels: stacked || i === 0,
      };

      annotations.push({
        text: metric.heading,
        xref: `x${suffix} domain` as Plotly.XAxisName,
        yref: `y${suffix} domain` as Plotly.YAxisName,
        x: 0,
        y: 1,
        xanchor: "left",
        yanchor: "bottom",
        yshift: 8,
        showarrow: false,
        font: { color: ink2, size: 13 },
      });
    });

    const layout: Partial<Plotly.Layout> = {
      ...base,
      ...axes,
      annotations,
      showlegend: false,
      grid: {
        rows: stacked ? metrics.length : 1,
        columns: stacked ? 1 : metrics.length,
        pattern: "independent",
        xgap: stacked ? 0.1 : 0.16,
        ygap: stacked ? 0.34 : 0.1,
      },
      margin: { ...base.margin, t: 30, l: 8, r: 16, b: 40 },
      hovermode: "closest",
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  function applyHeight(): void {
    container.style.setProperty(
      "--fig-h",
      stacked ? HEIGHT_STACKED : HEIGHT_WIDE,
    );
  }

  window.addEventListener("resize", () => {
    if (!plot.isConnected) return;
    const next = container.clientWidth > 0 && container.clientWidth < NARROW;
    if (next === stacked) return;
    stacked = next;
    applyHeight();
    void draw();
  });

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  applyHeight();
  await draw();
}
