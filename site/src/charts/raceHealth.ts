import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { int, pct, pct0 } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { Distribution, DistributionRow } from "../types.ts";
import {
  CONFIG,
  horizontalLegend,
  inkOn,
  layoutTemplate,
  reversed,
  seqColorscale,
} from "./theme.ts";

/** Below this share a segment is too narrow to carry a legible label. */
const LABEL_MIN = 0.08;

/** Roughly the width of "38%" plus its padding, in pixels. */
const LABEL_PX = 40;

/** Width the group names take off the plot before any bar is drawn. */
const NAMES_PX = 150;

/** The width below which the page is a phone and fewer labels fit. */
const NARROW = 640;

const FAIR_OR_POOR = ["Fair", "Poor"];

/** One resize listener for the module, however often `render` is called. */
let listening = false;

function share(row: DistributionRow, category: string): number {
  return row.shares[category] ?? 0;
}

function fairOrPoor(row: DistributionRow): number {
  return FAIR_OR_POOR.reduce((sum, c) => sum + share(row, c), 0);
}

export async function render(container: HTMLElement): Promise<void> {
  let data: Distribution;
  try {
    data = await loadJson<Distribution>("race_genhealth.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error
        ? err.message
        : "Could not load the self-rated health data.",
      () => void render(container),
    );
    return;
  }

  const rows = data.rows.filter((r) => !r.suppressed);
  const first = rows[0];
  if (!first) {
    showError(container, "The self-rated health file carries no groups.", () =>
      void render(container),
    );
    return;
  }
  const categories = data.categories;
  const label = (row: DistributionRow): string => row.key[0] ?? "";
  const highest = rows.reduce((a, b) => (fairOrPoor(b) > fairOrPoor(a) ? b : a));
  const lowest = rows.reduce((a, b) => (fairOrPoor(b) < fairOrPoor(a) ? b : a));

  const spec: FigureSpec = {
    id: "fig-race-health",
    title: `Self-rated health differs by group: ${pct0(fairOrPoor(highest))} of ${label(highest)} adults call their health fair or poor, against ${pct0(fairOrPoor(lowest))} of ${label(lowest)}`,
    subtitle:
      "Share of adults in each self-rated health category, all respondents (not only those with heart disease)",
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Stacked bar chart. Each group's adults split across five self-rated health categories, from excellent to poor. ${pct0(fairOrPoor(highest))} of ${label(highest)} adults call their health fair or poor, against ${pct0(fairOrPoor(lowest))} of ${label(lowest)}.`,
    table: {
      columns: ["Group", "Adults", ...categories, "Fair or poor"],
      rows: rows.map((r) => [
        label(r),
        int(r.n),
        ...categories.map((c) => pct(share(r, c))),
        pct(fairOrPoor(r)),
      ]),
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    // `--seq-5` is the end that contrasts most with the page in either theme,
    // so excellent stays the loudest band and poor the quietest.
    const ramp = reversed(seqColorscale().map(([, color]) => color));
    const surface = cssVar("--surface");
    const rs = reversed(rows);
    const names = rs.map(label);
    // A share is only labelled if its segment is wide enough to hold the
    // label flat: on a phone that is a much larger share than on a laptop.
    const bars = Math.max((container.clientWidth || 880) - NAMES_PX, 120);
    const minShare = Math.max(LABEL_MIN, LABEL_PX / bars);

    const traces = categories.map((category, i): Partial<Plotly.PlotData> => {
      const color = ramp[i] ?? ramp[ramp.length - 1] ?? "";
      const values = rs.map((r) => share(r, category));
      return {
        type: "bar",
        orientation: "h",
        name: category,
        y: names,
        x: values,
        customdata: rs.map((r) => [r.n]),
        hovertemplate:
          `%{y}<br><b>%{x:.1%}</b> say ${category.toLowerCase()}<br>n = %{customdata[0]:,}<extra></extra>`,
        text: values.map((v) => (v >= minShare ? pct0(v) : "")),
        texttemplate: "%{text}",
        textposition: "inside",
        insidetextanchor: "middle",
        textangle: 0,
        constraintext: "inside",
        textfont: { color: inkOn(color), size: 12 },
        marker: { color, line: { color: surface, width: 2 } },
      };
    });

    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      barmode: "stack",
      bargap: 0.3,
      showlegend: true,
      legend: { ...horizontalLegend(), traceorder: "normal" },
      margin: { ...base.margin, t: 30 },
      xaxis: {
        ...base.xaxis,
        showgrid: false,
        tickformat: ".0%",
        range: [0, 1],
        title: { text: "Share of adults", standoff: 8 },
      },
      yaxis: { ...base.yaxis, automargin: true, showgrid: false },
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  // The label threshold is a width, so a resize can change which labels fit.
  // Only the crossing of the phone threshold changes enough of them to be
  // worth a redraw, and the listener is registered once rather than on every
  // call to render.
  let narrow = container.clientWidth > 0 && container.clientWidth < NARROW;
  if (!listening) {
    listening = true;
    window.addEventListener("resize", () => {
      if (!plot.isConnected) return;
      const next = container.clientWidth > 0 && container.clientWidth < NARROW;
      if (next === narrow) return;
      narrow = next;
      void draw();
    });
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
