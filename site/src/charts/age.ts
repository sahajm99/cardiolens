import { loadJson } from "../data.ts";
import {
  controlSlot,
  mountFigure,
  showError,
  type FigureSpec,
} from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { Prevalence, PrevalenceRow } from "../types.ts";
import {
  CONFIG,
  errorBars,
  horizontalLegend,
  layoutTemplate,
  reversed,
  series,
} from "./theme.ts";

type Mode = "all" | "sex";

/** A row with an estimate. Suppressed cells carry nulls and are not drawn. */
interface Point {
  band: string;
  p: number;
  lo: number;
  hi: number;
  n: number;
}

function toPoints(rows: PrevalenceRow[], bandIndex = 0): Point[] {
  return rows
    .filter((r) => r.p !== null && r.lo !== null && r.hi !== null)
    .map((r) => ({
      band: r.key[bandIndex]!,
      p: r.p as number,
      lo: r.lo as number,
      hi: r.hi as number,
      n: r.n,
    }));
}

const HOVER =
  "%{y}<br><b>%{x:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}";

function barTrace(
  points: Point[],
  color: string,
  errorColor: string,
  name: string,
  showName: boolean,
): Partial<Plotly.PlotData> {
  const pts = reversed(points);
  return {
    type: "bar",
    orientation: "h",
    name,
    y: pts.map((d) => d.band),
    x: pts.map((d) => d.p),
    customdata: pts.map((d) => [d.lo, d.hi, d.n]),
    hovertemplate: `${HOVER}<extra>${showName ? name : ""}</extra>`,
    marker: { color },
    width: 0.6,
    error_x: errorBars(
      pts.map((d) => d.p),
      pts.map((d) => d.lo),
      pts.map((d) => d.hi),
      errorColor,
    ),
  };
}

function segControl(mode: Mode, onChange: (m: Mode) => void): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "seg";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Split the age bands");

  const options: { value: Mode; label: string }[] = [
    { value: "all", label: "All adults" },
    { value: "sex", label: "By sex" },
  ];
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.textContent = opt.label;
    btn.setAttribute("aria-pressed", String(opt.value === mode));
    btn.addEventListener("click", () => {
      for (const other of group.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      onChange(opt.value);
    });
    group.appendChild(btn);
  }
  return group;
}

export async function render(container: HTMLElement): Promise<void> {
  let byAge: Prevalence;
  let byAgeSex: Prevalence;
  try {
    [byAge, byAgeSex] = await Promise.all([
      loadJson<Prevalence>("prevalence_by_age.json"),
      loadJson<Prevalence>("prevalence_by_age_sex.json"),
    ]);
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the age data.",
      () => void render(container),
    );
    return;
  }

  const all = toPoints(byAge.rows);
  const young = all[0]!;
  const old = all[all.length - 1]!;
  const sexLevels = byAgeSex.levels["Sex"] ?? ["Female", "Male"];
  const bySex = sexLevels.map((level) => ({
    level,
    points: toPoints(byAgeSex.rows.filter((r) => r.key[1] === level)),
  }));

  const spec: FigureSpec = {
    id: "fig-age",
    title: `Heart disease climbs from ${pct(young.p)} of adults aged ${young.band} to ${pct(old.p)} of adults aged ${old.band}`,
    subtitle: `${int(byAge.n_total)} adults, unweighted, 95% Wilson intervals`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Bar chart. Self-reported heart disease prevalence rises with age, from ${pct(young.p)} of adults aged ${young.band} to ${pct(old.p)} of adults aged ${old.band}.`,
    table: {
      columns: ["Age band", "Adults", "Prevalence", "95% CI"],
      rows: all.map((d) => [d.band, int(d.n), pct(d.p), ciText(d.lo, d.hi)]),
    },
  };

  const plot = mountFigure(container, spec);
  let mode: Mode = "all";
  controlSlot(plot).before(
    segControl(mode, (m) => {
      mode = m;
      void draw();
    }),
  );

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    // Plotly gives the first trace the lowest offset, which is the bottom of
    // each group, so the traces are reversed and the legend with them: the
    // bars then read top to bottom in the order the legend lists them.
    const traces =
      mode === "all"
        ? [barTrace(all, c.s1, errorColor, "All adults", false)]
        : reversed(
            bySex.map((s, i) =>
              barTrace(
                s.points,
                i === 0 ? c.s1 : c.s2,
                errorColor,
                s.level,
                true,
              ),
            ),
          );
    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      barmode: "group",
      bargroupgap: 0.08,
      showlegend: mode === "sex",
      legend: { ...horizontalLegend(1.06), traceorder: "reversed" },
      margin: { ...base.margin, t: mode === "sex" ? 28 : 8 },
      xaxis: {
        ...base.xaxis,
        tickformat: ".0%",
        rangemode: "tozero",
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
