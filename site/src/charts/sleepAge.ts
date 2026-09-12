import { loadJson } from "../data.ts";
import { mountFigure, showError, type FigureSpec } from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { Prevalence, PrevalenceRow } from "../types.ts";
import { CONFIG, errorBars, layoutTemplate, series } from "./theme.ts";

const SHORT = "Under 6h";
const MIDDLE = "6-7h";

interface Point {
  band: string;
  p: number;
  lo: number;
  hi: number;
  n: number;
  smallN: boolean;
}

function pointsFor(data: Prevalence, age: string): Point[] {
  const bands = data.levels["SleepBand"] ?? [];
  const out: Point[] = [];
  for (const band of bands) {
    const row: PrevalenceRow | undefined = data.rows.find(
      (r) => r.key[0] === age && r.key[1] === band,
    );
    if (!row || row.p === null || row.lo === null || row.hi === null) continue;
    out.push({
      band,
      p: row.p,
      lo: row.lo,
      hi: row.hi,
      n: row.n,
      smallN: row.small_n,
    });
  }
  return out;
}

/**
 * The claim only stands if short sleepers are above the 6-to-7-hour group in
 * every age band and the widest gap is in the oldest one. Otherwise the title
 * drops the claim and the subtitle carries what the data do show.
 */
function claim(
  groups: { age: string; points: Point[] }[],
): { title: string; extra: string } {
  const gaps = groups.map((g) => {
    const short = g.points.find((d) => d.band === SHORT);
    const middle = g.points.find((d) => d.band === MIDDLE);
    return short && middle ? { age: g.age, gap: short.p - middle.p } : null;
  });
  const usable = gaps.filter((g): g is { age: string; gap: number } => g !== null);
  const everywhere = usable.length === groups.length && usable.every((g) => g.gap > 0);
  const widest = usable.reduce(
    (a, b) => (b.gap > a.gap ? b : a),
    usable[0] ?? { age: "", gap: 0 },
  );
  const oldest = groups[groups.length - 1]?.age ?? "";
  if (everywhere && widest.age === oldest) {
    return {
      title: `Sleeping under six hours goes with more heart disease at every age, and the gap is widest after 65`,
      extra: "",
    };
  }
  return {
    title: "Sleep and heart disease, by age group",
    extra: everywhere
      ? `; short sleepers are above the six-to-seven-hour group in every age band, and the widest gap is in the ${widest.age} group`
      : "; the short-sleep gap does not hold in every age band",
  };
}

export async function render(container: HTMLElement): Promise<void> {
  let data: Prevalence;
  try {
    data = await loadJson<Prevalence>("sleep_by_agegroup.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the sleep data.",
      () => void render(container),
    );
    return;
  }

  const ages = data.levels["AgeGroup3"] ?? [];
  const groups = ages.map((age) => ({ age, points: pointsFor(data, age) }));
  const { title, extra } = claim(groups);

  const spec: FigureSpec = {
    id: "fig-sleep-age",
    title,
    subtitle: `Prevalence by usual hours of sleep within three age groups, 95% Wilson intervals${extra}`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Grouped bar chart. Heart disease prevalence by usual hours of sleep, one group of bars per sleep band and one bar per age group. ${title}.`,
    table: {
      columns: ["Sleep", "Age group", "Adults", "Prevalence", "95% CI"],
      rows: groups.flatMap((g) =>
        g.points.map((d) => [
          d.band,
          g.age,
          int(d.n),
          pct(d.p),
          ciText(d.lo, d.hi),
        ]),
      ),
    },
  };

  const plot = mountFigure(container, spec);

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const colors = [c.s1, c.s2, c.s3];
    const traces: Partial<Plotly.PlotData>[] = groups.map((g, i) => ({
      type: "bar",
      name: g.age,
      x: g.points.map((d) => d.band),
      y: g.points.map((d) => d.p),
      customdata: g.points.map((d) => [d.lo, d.hi, d.n]),
      hovertemplate:
        "%{x}<br><b>%{y:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}" +
        `<extra>${g.age}</extra>`,
      marker: { color: g.points.map((d) => (d.smallN ? c.muted : colors[i] ?? c.s1)) },
      error_y: errorBars(
        g.points.map((d) => d.p),
        g.points.map((d) => d.lo),
        g.points.map((d) => d.hi),
        errorColor,
      ),
    }));

    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      barmode: "group",
      bargap: 0.3,
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.04,
        yanchor: "bottom",
        font: { color: cssVar("--ink-2") },
      },
      margin: { ...base.margin, t: 30, l: 8 },
      xaxis: {
        ...base.xaxis,
        type: "category",
        showgrid: false,
        automargin: true,
        title: { text: "Usual hours of sleep", standoff: 8 },
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
