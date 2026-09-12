import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/source-sans-3";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/figure.css";
import "./styles/panel.css";

import { loadJson } from "./data.ts";
import { whenVisible } from "./lazy.ts";
import { fillStats } from "./stats-fill.ts";
import { initTheme, toggleTheme } from "./theme.ts";
import type { Claims } from "./types.ts";

interface ChartModule {
  render: (container: HTMLElement) => Promise<void>;
}

/** One dynamic import per chart, so Plotly loads only when a figure needs it. */
const CHARTS: Record<string, () => Promise<ChartModule>> = {
  age: () => import("./charts/age.ts"),
  factors: () => import("./charts/factors.ts"),
  "factor-by-age": () => import("./charts/factorByAge.ts"),
  forest: () => import("./charts/forest.ts"),
  estimator: () => import("./charts/estimator.ts"),
};

/** The first figure is above the fold; everything below it waits. */
const EAGER = new Set(["age"]);

initTheme();
document
  .getElementById("theme-toggle")
  ?.addEventListener("click", toggleTheme);

loadJson<Claims>("claims.json")
  .then(fillStats)
  .catch((err: unknown) => {
    console.error("Could not fill the numbers in the prose", err);
  });

for (const el of document.querySelectorAll<HTMLElement>("[data-chart]")) {
  const name = el.dataset.chart ?? "";
  const load = CHARTS[name];
  if (!load) {
    console.warn(`main: no chart module registered for "${name}"`);
    continue;
  }
  const start = () => {
    load()
      .then((mod) => mod.render(el))
      .catch((err: unknown) => {
        console.error(`main: chart "${name}" failed`, err);
      });
  };
  if (EAGER.has(name)) start();
  else whenVisible(el, start);
}
