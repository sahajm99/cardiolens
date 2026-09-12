import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { Prevalence } from "../types.ts";
import { CONFIG, errorBars, layoutTemplate, series } from "./theme.ts";

/** Two lines rather than one long tick: the names are wider than the bars. */
function wrap(name: string): string {
  return name.length > 16 ? name.replace("/", "/<br>") : name;
}

interface Point {
  race: string;
  p: number;
  lo: number;
  hi: number;
  n: number;
  smallN: boolean;
}

function pointsFor(data: Prevalence, stroke: string): Point[] {
  const out: Point[] = [];
  for (const race of data.levels["Race"] ?? []) {
    const row = data.rows.find(
      (r) => r.key[0] === stroke && r.key[1] === race,
    );
    if (!row || row.p === null || row.lo === null || row.hi === null) continue;
    out.push({
      race,
      p: row.p,
      lo: row.lo,
      hi: row.hi,
      n: row.n,
      smallN: row.small_n,
    });
  }
  return out;
}

function range(points: Point[]): { lo: number; hi: number } {
  return {
    lo: Math.min(...points.map((d) => d.p)),
    hi: Math.max(...points.map((d) => d.p)),
  };
}

export async function render(container: HTMLElement): Promise<void> {
  let data: Prevalence;
  try {
    data = await loadJson<Prevalence>("race_stroke_hd.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error
        ? err.message
        : "Could not load the stroke interaction data.",
      () => void render(container),
    );
    return;
  }

  const without = pointsFor(data, "No");
  const withStroke = pointsFor(data, "Yes");
  if (!without.length || !withStroke.length) {
    showError(container, "The stroke interaction file carries no rows.", () =>
      void render(container),
    );
    return;
  }

  const no = range(without);
  const yes = range(withStroke);
  // The claim names every group, so it only stands if it holds in every group.
  const everywhere = withStroke.every((d) => {
    const other = without.find((o) => o.race === d.race);
    return other !== undefined && d.p > other.p;
  });
  const title = everywhere
    ? `A prior stroke multiplies heart disease in every group: ${pct(yes.lo)} to ${pct(yes.hi)} with a stroke, against ${pct(no.lo)} to ${pct(no.hi)} without`
    : `Heart disease with and without a prior stroke: ${pct(yes.lo)} to ${pct(yes.hi)} with a stroke, against ${pct(no.lo)} to ${pct(no.hi)} without`;

  const drawn = new Set([...without, ...withStroke].map((d) => d.race));
  const missing = (data.levels["Race"] ?? []).filter((r) => !drawn.has(r));
  const thin = [...without, ...withStroke].filter((d) => d.smallN);

  let note = "Source: Kaggle extract of CDC BRFSS 2020.";
  if (missing.length) {
    note += ` Groups left out of the chart because a cell was suppressed: ${missing.join(", ")}.`;
  }
  if (thin.length) {
    note += ` Grey bars stand on fewer than 300 adults: ${thin.map((d) => `${d.race} with a stroke`).join(", ")}.`;
  }

  const spec: FigureSpec = {
    id: "fig-race-stroke",
    title,
    subtitle:
      "Prevalence within each group, split by whether the respondent has ever had a stroke; 95% Wilson intervals, wide where the group is small",
    note,
    alt: `Grouped bar chart. For each group, the share reporting heart disease without a prior stroke and with one. ${title}.`,
    table: {
      columns: ["Group", "Prior stroke", "Adults", "Prevalence", "95% CI"],
      rows: [
        ...without.map((d) => [
          d.race,
          "No",
          int(d.n),
          pct(d.p),
          ciText(d.lo, d.hi),
        ]),
        ...withStroke.map((d) => [
          d.race,
          "Yes",
          int(d.n) + (d.smallN ? " (thin)" : ""),
          pct(d.p),
          ciText(d.lo, d.hi),
        ]),
      ],
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const traces = (
      [
        ["No prior stroke", without, c.s1],
        ["Prior stroke", withStroke, c.s2],
      ] as const
    ).map(([name, points, color]): Partial<Plotly.PlotData> => ({
      type: "bar",
      name,
      x: points.map((d) => wrap(d.race)),
      y: points.map((d) => d.p),
      customdata: points.map((d) => [d.lo, d.hi, d.n, d.race]),
      hovertemplate:
        "%{customdata[3]}<br><b>%{y:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}" +
        `<extra>${name}</extra>`,
      marker: { color: points.map((d) => (d.smallN ? c.muted : color)) },
      error_y: errorBars(
        points.map((d) => d.p),
        points.map((d) => d.lo),
        points.map((d) => d.hi),
        errorColor,
      ),
    }));

    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      barmode: "group",
      bargap: 0.28,
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.04,
        yanchor: "bottom",
        font: { color: cssVar("--ink-2") },
      },
      margin: { ...base.margin, t: 30 },
      xaxis: {
        ...base.xaxis,
        type: "category",
        showgrid: false,
        automargin: true,
        tickfont: { ...base.xaxis?.tickfont, size: 12 },
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
