import { cssVar } from "../theme.ts";

/**
 * Plotly chrome derived from the CSS tokens, so light and dark never drift
 * apart: hairline gridlines one step off the surface, no modebar, axis text in
 * the secondary ink.
 */
export function layoutTemplate(): Partial<Plotly.Layout> {
  const surface = cssVar("--surface");
  const grid = cssVar("--grid");
  const ink = cssVar("--ink");
  const ink2 = cssVar("--ink-2");
  const axis = {
    gridcolor: grid,
    zerolinecolor: grid,
    linecolor: grid,
    tickfont: { color: ink2 },
  };
  return {
    paper_bgcolor: surface,
    plot_bgcolor: surface,
    font: {
      family: '"Source Sans 3 Variable", system-ui, sans-serif',
      color: ink2,
      size: 13,
    },
    xaxis: { ...axis },
    yaxis: { ...axis },
    margin: { l: 8, r: 16, t: 8, b: 40 },
    hoverlabel: {
      bgcolor: cssVar("--surface-2"),
      bordercolor: grid,
      font: {
        color: ink,
        family: '"Source Sans 3 Variable", system-ui, sans-serif',
        size: 13,
      },
    },
  };
}

/** Series colours, read fresh on every render so the toggle recolours charts. */
export const series = () => ({
  s1: cssVar("--series-1"),
  s2: cssVar("--series-2"),
  s3: cssVar("--series-3"),
  s4: cssVar("--series-4"),
  muted: cssVar("--ink-3"),
  grid: cssVar("--grid"),
});

export const CONFIG: Partial<Plotly.Config> = {
  displayModeBar: false,
  responsive: true,
  scrollZoom: false,
};
