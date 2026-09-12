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
import type { Prevalence, PrevalenceRow } from "../types.ts";
import {
  CONFIG,
  contrastRatio,
  inkOn,
  layoutTemplate,
  seqColorscale,
} from "./theme.ts";

/** The button face and the sentence fragment for each mental-health stratum. */
const STRATA: Record<string, { button: string; phrase: string } | undefined> = {
  All: { button: "All", phrase: "all adults" },
  "0 days": { button: "0 days", phrase: "adults with no poor mental-health days" },
  "1-13 days": {
    button: "1 to 13 days",
    phrase: "adults with 1 to 13 poor mental-health days",
  },
  "14 or more days": {
    button: "14 or more days",
    phrase: "adults with 14 or more poor mental-health days",
  },
};

/** Sleep bands read as a phrase inside the claim, not as an axis tick. */
const SLEEP_PHRASE: Record<string, string | undefined> = {
  "Under 6h": "under 6 hours",
  "6-7h": "6 to 7 hours",
  "8-9h": "8 to 9 hours",
  "10h or more": "10 hours or more",
};

const SHORT_SLEEP = "Under 6h";

interface Cell {
  bmi: string;
  sleep: string;
  row: PrevalenceRow;
}

function cellsOf(data: Prevalence, stratum: string): Cell[] {
  const out: Cell[] = [];
  for (const bmi of data.levels["BMIClass"] ?? []) {
    for (const sleep of data.levels["SleepBand"] ?? []) {
      const row = data.rows.find(
        (r) => r.key[0] === stratum && r.key[1] === bmi && r.key[2] === sleep,
      );
      if (row) out.push({ bmi, sleep, row });
    }
  }
  return out;
}

/** BMI classes as they read mid-sentence; the roman numerals stay upper case. */
const BMI_PHRASE: Record<string, string | undefined> = {
  Underweight: "underweight",
  Normal: "normal-weight",
  Overweight: "overweight",
  "Obese I": "obese class I",
  "Obese II+": "obese class II or above",
};

/** "obese class II or above adults sleeping under 6 hours" */
function describe(cell: Cell): string {
  const bmi = BMI_PHRASE[cell.bmi] ?? cell.bmi;
  return `${bmi} adults sleeping ${SLEEP_PHRASE[cell.sleep] ?? cell.sleep}`;
}

/**
 * The lead names the pattern the "All" grid actually shows. Heart disease is
 * raised at both ends of the sleep range in this file, so the short-sleep
 * wording is only used when the worst cell is in fact a short-sleep cell.
 */
function lead(cells: Cell[], worst: Cell): string {
  if (worst.sleep === SHORT_SLEEP) return "Short sleep and higher BMI stack";
  const sameBmi = cells.filter((c) => c.bmi === worst.bmi && c.row.p !== null);
  const middle = sameBmi
    .filter((c) => c.sleep === "6-7h" || c.sleep === "8-9h")
    .map((c) => c.row.p as number);
  const short = sameBmi.find((c) => c.sleep === SHORT_SLEEP)?.row.p ?? null;
  const uShaped =
    short !== null &&
    middle.length > 0 &&
    short > Math.max(...middle) &&
    (worst.row.p as number) > Math.max(...middle);
  return uShaped
    ? "Sleep at both ends stacks with higher BMI"
    : "BMI and sleep together separate people";
}

/** Null when the file carries no cell with an estimate, which is a broken file. */
function specFor(data: Prevalence, stratum: string): FigureSpec | null {
  const all = cellsOf(data, "All").filter((c) => c.row.p !== null);
  if (!all.length) return null;
  const worst = all.reduce((a, b) =>
    (b.row.p as number) > (a.row.p as number) ? b : a,
  );
  const best = all.reduce((a, b) =>
    (b.row.p as number) < (a.row.p as number) ? b : a,
  );
  const title = `${lead(all, worst)}: ${pct(worst.row.p as number)} of ${describe(worst)} report heart disease, against ${pct(best.row.p as number)} of ${describe(best)}`;
  const phrase = STRATA[stratum]?.phrase ?? stratum;
  const cells = cellsOf(data, stratum);

  return {
    id: "fig-heatmap",
    title,
    subtitle: `Prevalence by BMI class and sleep band, ${phrase}; 95% intervals in the table`,
    note: "Source: Kaggle extract of CDC BRFSS 2020",
    alt: `Heat map of heart disease prevalence for every combination of five BMI classes and four sleep bands, for ${phrase}. ${title}.`,
    table: {
      columns: ["BMI class", "Sleep", "Adults", "Prevalence", "95% CI"],
      rows: cells.map((c) => [
        c.bmi,
        c.sleep,
        int(c.row.n) + (c.row.small_n ? " (thin)" : ""),
        c.row.p === null ? "suppressed" : pct(c.row.p),
        c.row.lo === null || c.row.hi === null
          ? "—"
          : ciText(c.row.lo, c.row.hi),
      ]),
    },
  };
}

function segControl(
  levels: string[],
  current: string,
  onChange: (level: string) => void,
): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "seg";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Poor mental-health days in the last 30");

  for (const level of levels) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.textContent = STRATA[level]?.button ?? level;
    btn.setAttribute("aria-pressed", String(level === current));
    btn.addEventListener("click", () => {
      for (const other of group.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      onChange(level);
    });
    group.appendChild(btn);
  }
  return group;
}

/**
 * Below this, a value written on a cell is not comfortable to read against its
 * fill. It is set above the WCAG large-text floor on purpose: at the floor the
 * darkest light-mode stop keeps dark text on a dark blue cell, which passes
 * and still reads badly.
 */
const MIN_LABEL_CONTRAST = 4.5;

/**
 * One label colour has to serve every cell, so the ramp is capped: the label
 * is chosen for the middle of the ramp, then the stops it cannot carry are
 * dropped. In light mode that takes the darkest stop off the top; in dark,
 * where the same tokens run the other way, it takes the darkest off the
 * bottom.
 */
function cappedScale(): { scale: [number, string][]; label: string } {
  const stops = seqColorscale().map(([, color]) => color);
  const label = inkOn(stops[Math.floor(stops.length / 2)] ?? "");
  const kept = stops.filter(
    (color) => contrastRatio(color, label) >= MIN_LABEL_CONTRAST,
  );
  const use = kept.length >= 2 ? kept : stops;
  return {
    scale: use.map((color, i) => [i / (use.length - 1), color]),
    label,
  };
}

export async function render(container: HTMLElement): Promise<void> {
  let data: Prevalence;
  try {
    data = await loadJson<Prevalence>("bmi_sleep_heatmap.json");
  } catch (err) {
    showError(
      container,
      err instanceof Error ? err.message : "Could not load the heat map data.",
      () => void render(container),
    );
    return;
  }

  const strata = data.levels["MentalBand"] ?? ["All"];
  const bmiLevels = data.levels["BMIClass"] ?? [];
  const sleepLevels = data.levels["SleepBand"] ?? [];
  let stratum = strata[0] ?? "All";

  // One scale for every stratum, so switching stratum never rescales the key.
  const zmax = Math.max(
    ...data.rows.filter((r) => r.p !== null).map((r) => r.p as number),
  );

  const spec = specFor(data, stratum);
  if (!spec) {
    showError(container, "The heat map file carries no drawable cells.", () =>
      void render(container),
    );
    return;
  }

  const plot = mountFigure(container, spec);
  controlSlot(plot).before(
    segControl(strata, stratum, (level) => {
      stratum = level;
      const next = specFor(data, stratum);
      if (next) updateFigure(container, next);
      void draw();
    }),
  );

  function draw(): Promise<unknown> {
    const cells = cellsOf(data, stratum);
    const at = (bmi: string, sleep: string): PrevalenceRow | undefined =>
      cells.find((c) => c.bmi === bmi && c.sleep === sleep)?.row;

    const z = bmiLevels.map((bmi) =>
      sleepLevels.map((sleep) => at(bmi, sleep)?.p ?? null),
    );
    const text = bmiLevels.map((bmi) =>
      sleepLevels.map((sleep) => {
        const row = at(bmi, sleep);
        if (!row || row.lo === null || row.hi === null) return "n under 30";
        return `${ciText(row.lo, row.hi)}<br>n = ${int(row.n)}${row.small_n ? " (thin cell)" : ""}`;
      }),
    );

    const { scale, label: labelColor } = cappedScale();
    const ink2 = cssVar("--ink-2");

    const trace: Partial<Plotly.PlotData> = {
      type: "heatmap",
      x: sleepLevels,
      y: bmiLevels,
      z,
      // A 2-D text grid is what Plotly wants here; the types only admit 1-D.
      text: text as unknown as string[],
      colorscale: scale,
      zmin: 0,
      zmax,
      xgap: 2,
      ygap: 2,
      hoverongaps: false,
      texttemplate: "%{z:.1%}",
      textfont: { color: labelColor, size: 12 },
      hovertemplate:
        "%{y}, sleeping %{x}<br><b>%{z:.1%}</b> report heart disease<br>%{text}<extra></extra>",
      colorbar: {
        tickformat: ".0%",
        outlinewidth: 0,
        thickness: 12,
        len: 0.9,
        tickfont: { color: ink2 },
        title: { text: "Report<br>heart disease", side: "top" },
      },
    };

    // Suppressed cells are left empty; the annotation says why.
    const annotations: Partial<Plotly.Annotations>[] = [];
    for (const cell of cells) {
      if (cell.row.p !== null) continue;
      annotations.push({
        x: cell.sleep,
        y: cell.bmi,
        text: "n < 30",
        showarrow: false,
        font: { color: ink2, size: 11 },
      });
    }

    const base = layoutTemplate();
    const layout: Partial<Plotly.Layout> = {
      ...base,
      annotations,
      showlegend: false,
      margin: { ...base.margin, t: 8, r: 8, b: 56 },
      xaxis: {
        ...base.xaxis,
        type: "category",
        showgrid: false,
        automargin: true,
        title: { text: "Usual hours of sleep", standoff: 8 },
      },
      yaxis: {
        ...base.yaxis,
        type: "category",
        showgrid: false,
        automargin: true,
      },
    };
    return Plotly.react(plot, [trace], layout, CONFIG);
  }

  onThemeChange(() => {
    if (plot.isConnected) void draw();
  });
  await draw();
}
