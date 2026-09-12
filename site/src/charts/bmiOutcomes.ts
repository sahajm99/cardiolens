import { loadJson } from "../data.ts";
import {
  controlSlot,
  mountFigure,
  showError,
  updateFigure,
  type FigureSpec,
} from "../figure.ts";
import { ciText, int, pct } from "../fmt.ts";
import Plotly from "../plotly.ts";
import { cssVar, onThemeChange } from "../theme.ts";
import type { BmiOutcomes, Prevalence } from "../types.ts";
import { pointsFor, type Point } from "./points.ts";
import {
  CONFIG,
  errorBars,
  horizontalLegend,
  layoutTemplate,
  series,
} from "./theme.ts";

/** The picker's faces and the fragment each one puts into the subtitle. */
const AGE_PHRASE: Record<string, string | undefined> = {
  All: "all adults",
  "18-44": "adults aged 18 to 44",
  "45-64": "adults aged 45 to 64",
  "65 and older": "adults aged 65 and older",
};

const NORMAL = "Normal";
const HEAVIEST = "Obese II+";

function bmiPoints(table: Prevalence, age: string): Point[] {
  return pointsFor(table, "BMIClass", age);
}

function at(points: Point[], bmi: string): Point | undefined {
  return points.find((d) => d.label === bmi);
}

/** True when prevalence only climbs from normal weight to the heaviest class. */
function rises(points: Point[]): boolean {
  const from = points.findIndex((d) => d.label === NORMAL);
  if (from < 0) return false;
  const run = points.slice(from);
  return run.every((d, i) => i === 0 || d.p > (run[i - 1] as Point).p);
}

function specFor(data: BmiOutcomes, age: string): FigureSpec {
  const hd = bmiPoints(data.tables.hd, age);
  const stroke = bmiPoints(data.tables.stroke, age);
  const normal = at(hd, NORMAL);
  const heaviest = at(hd, HEAVIEST);
  const phrase = AGE_PHRASE[age] ?? age;

  const both = rises(hd) && rises(stroke);
  const title =
    both && normal && heaviest
      ? `Both heart disease and stroke rise with BMI class, from ${pct(normal.p)} to ${pct(heaviest.p)} for heart disease`
      : `Heart disease and stroke by BMI class, ${phrase}`;

  const rows: (string | number)[][] = [];
  for (const [outcome, points] of [
    ["Heart disease", hd],
    ["Stroke", stroke],
  ] as const) {
    for (const d of points) {
      rows.push([
        d.label,
        outcome,
        int(d.n) + (d.smallN ? " (thin)" : ""),
        pct(d.p),
        ciText(d.lo, d.hi),
      ]);
    }
  }

  return {
    id: "fig-bmi-outcomes",
    title,
    subtitle: `Prevalence by WHO BMI class, ${phrase}; 95% Wilson intervals; underweight adults are few and their interval is wide`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Line chart with two series, heart disease and stroke, across five BMI classes for ${phrase}. ${title}.`,
    table: {
      columns: ["BMI class", "Outcome", "Adults", "Prevalence", "95% CI"],
      rows,
    },
  };
}

function picker(
  ages: string[],
  selected: string,
  onChange: (age: string) => void,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "fig-picker";

  const select = document.createElement("select");
  select.id = "fig-bmi-outcomes-picker";
  for (const age of ages) {
    const opt = document.createElement("option");
    opt.value = age;
    opt.textContent = age;
    opt.selected = age === selected;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onChange(select.value));

  const label = document.createElement("label");
  label.htmlFor = select.id;
  label.textContent = "Age group";

  wrap.append(label, select);
  return wrap;
}

export async function render(container: HTMLElement): Promise<void> {
  let data: BmiOutcomes;
  try {
    data = await loadJson<BmiOutcomes>("bmi_outcomes.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error
        ? err.message
        : "Could not load the BMI outcomes data.",
      () => void render(container),
    );
    return;
  }

  const ages = data.tables.hd.levels["AgeGroupAll"] ?? ["All"];
  let age = ages[0] ?? "All";

  const plot = mountFigure(container, specFor(data, age));
  controlSlot(plot).before(
    picker(ages, age, (next) => {
      age = next;
      updateFigure(container, specFor(data, age));
      void draw();
    }),
  );

  function draw(): Promise<unknown> {
    const c = series();
    const errorColor = cssVar("--ink-2");
    const surface = cssVar("--surface");
    const traces = (
      [
        ["Heart disease", bmiPoints(data.tables.hd, age), c.s1],
        ["Stroke", bmiPoints(data.tables.stroke, age), c.s2],
      ] as const
    ).map(([name, points, color]): Partial<Plotly.PlotData> => ({
      type: "scatter",
      mode: "lines+markers",
      name,
      x: points.map((d) => d.label),
      y: points.map((d) => d.p),
      customdata: points.map((d) => [d.lo, d.hi, d.n]),
      hovertemplate:
        "%{x}<br><b>%{y:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}" +
        `<extra>${name}</extra>`,
      line: { color, width: 2 },
      marker: {
        size: 9,
        color: points.map((d) => (d.smallN ? c.muted : color)),
        line: { color: surface, width: 2 },
      },
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
      showlegend: true,
      legend: horizontalLegend(),
      margin: { ...base.margin, t: 30 },
      hovermode: "closest",
      xaxis: {
        ...base.xaxis,
        type: "category",
        showgrid: false,
        automargin: true,
        title: { text: "WHO BMI class", standoff: 8 },
      },
      yaxis: {
        ...base.yaxis,
        automargin: true,
        tickformat: ".0%",
        rangemode: "tozero",
        title: { text: "Report this outcome", standoff: 8 },
      },
    };
    return Plotly.react(plot, traces, layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
