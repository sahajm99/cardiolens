import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { RacePrevalence, RaceRow } from "../types.ts";
import {
  CONFIG,
  errorBars,
  hexToRgba,
  layoutTemplate,
  series,
} from "./theme.ts";

/**
 * Plotly stacks the first y category at the bottom, so the array is reversed:
 * the groups read top to bottom in the order the file delivers them.
 */
function reversed<T>(xs: T[]): T[] {
  return xs.slice().reverse();
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

export async function render(container: HTMLElement): Promise<void> {
  let data: RacePrevalence;
  try {
    data = await loadJson<RacePrevalence>("race_prevalence.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error
        ? err.message
        : "Could not load the standardised prevalence data.",
      () => void render(container),
    );
    return;
  }

  const rows = data.rows;
  const first = rows[0];
  if (!first) {
    showError(container, "The race prevalence file carries no groups.", () =>
      void render(container),
    );
    return;
  }

  const label = (row: RaceRow): string => row.key[0] ?? "";
  const moved = rows.reduce((a, b) =>
    Math.abs(b.crude - b.std) > Math.abs(a.crude - a.std) ? b : a,
  );
  // Standardising can pull the middle groups together and still leave the
  // extremes further apart; the title says which of the two happened.
  const narrows =
    spread(rows.map((r) => r.std)) < spread(rows.map((r) => r.crude));
  const title = narrows
    ? `Age-standardising narrows the gap between groups: ${label(moved)} moves from ${pct(moved.crude)} to ${pct(moved.std)}`
    : `Age-standardising does not narrow the gap between groups: ${label(moved)} moves from ${pct(moved.crude)} to ${pct(moved.std)}`;
  const thin = rows.filter((r) => r.small_n).map(label);

  const spec: FigureSpec = {
    id: "fig-race-std",
    title,
    subtitle:
      "Standard population is this sample's own age mix; standardised intervals use the Fay-Feuer gamma method; small-n groups are flagged in the table",
    note: thin.length
      ? `Source: Kaggle extract of CDC BRFSS 2020. Standardised rates for these groups rest on a thin age band: ${thin.join(", ")}.`
      : "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Dumbbell chart. For each group, the crude share reporting heart disease and the same share standardised to one age mix, each with a 95% interval. ${title}.`,
    table: {
      columns: [
        "Group",
        "Adults",
        "Crude",
        "95% CI",
        "Age-standardised",
        "95% CI",
        "Thinnest age band",
      ],
      rows: rows.map((r) => [
        label(r) + (r.small_n ? " (small n)" : ""),
        int(r.n),
        pct(r.crude),
        ciText(r.crude_lo, r.crude_hi),
        pct(r.std),
        ciText(r.std_lo, r.std_hi),
        int(r.min_band_n),
      ]),
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const rs = reversed(rows);
    const names = rs.map(label);
    const colors = rs.map((r) => (r.small_n ? c.muted : c.s1));

    // The connector is first in the array, so the markers are drawn over it.
    // A dimmed ink rather than the grid token: at the grid's own contrast the
    // line disappears into the dark theme, and the pairing goes with it.
    const connectorX: (number | null)[] = [];
    const connectorY: (string | null)[] = [];
    for (const r of rs) {
      connectorX.push(r.crude, r.std, null);
      connectorY.push(label(r), label(r), null);
    }

    const connector: Partial<Plotly.PlotData> = {
      type: "scatter",
      mode: "lines",
      x: connectorX,
      y: connectorY,
      line: { color: hexToRgba(c.muted, 0.55), width: 2 },
      hoverinfo: "skip",
      showlegend: false,
    };

    const crude: Partial<Plotly.PlotData> = {
      type: "scatter",
      mode: "markers",
      name: "Crude",
      x: rs.map((r) => r.crude),
      y: names,
      customdata: rs.map((r) => [r.crude_lo, r.crude_hi, r.n]),
      hovertemplate:
        "%{y}<br><b>%{x:.1%}</b> crude (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}<extra></extra>",
      marker: {
        symbol: "circle-open",
        size: 10,
        color: colors,
        line: { color: colors, width: 2 },
      },
      error_x: errorBars(
        rs.map((r) => r.crude),
        rs.map((r) => r.crude_lo),
        rs.map((r) => r.crude_hi),
        errorColor,
      ),
    };

    const std: Partial<Plotly.PlotData> = {
      type: "scatter",
      mode: "markers",
      name: "Age-standardised",
      x: rs.map((r) => r.std),
      y: names,
      customdata: rs.map((r) => [r.std_lo, r.std_hi, r.min_band_n]),
      hovertemplate:
        "%{y}<br><b>%{x:.1%}</b> standardised (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>thinnest age band n = %{customdata[2]:,}<extra></extra>",
      marker: { symbol: "circle", size: 10, color: colors },
      error_x: errorBars(
        rs.map((r) => r.std),
        rs.map((r) => r.std_lo),
        rs.map((r) => r.std_hi),
        errorColor,
      ),
    };

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
        rangemode: "tozero",
        title: { text: "Report heart disease", standoff: 8 },
      },
      yaxis: { ...base.yaxis, automargin: true, showgrid: false },
    };
    return Plotly.react(plot, [connector, crude, std], layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
