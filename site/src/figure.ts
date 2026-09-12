/**
 * The shared frame around every chart: claim, context line, plot, the same
 * rows as a table for keyboard and screen-reader readers, and a source note.
 */
export interface FigureSpec {
  id: string;
  /** The claim. Also the chart's accessible name, via `alt`. */
  title: string;
  subtitle: string;
  note: string;
  alt: string;
  table: { columns: string[]; rows: (string | number)[][] };
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildTable(spec: FigureSpec): HTMLDetailsElement {
  const details = el("details", "fig-table");
  details.appendChild(el("summary", undefined, "Show the numbers"));

  const table = el("table");
  const caption = el("caption", undefined, spec.title);
  table.appendChild(caption);

  const thead = el("thead");
  const headRow = el("tr");
  for (const name of spec.table.columns) {
    const th = el("th", undefined, name);
    th.scope = "col";
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const row of spec.table.rows) {
    const tr = el("tr");
    row.forEach((cell, i) => {
      const text = String(cell);
      if (i === 0) {
        const th = el("th", undefined, text);
        th.scope = "row";
        tr.appendChild(th);
      } else {
        tr.appendChild(el("td", undefined, text));
      }
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  details.appendChild(table);
  return details;
}

/**
 * Replace `container`'s content with the figure frame and return the div the
 * chart module should hand to Plotly.
 */
export function mountFigure(
  container: HTMLElement,
  spec: FigureSpec,
): HTMLDivElement {
  container.replaceChildren();

  const title = el("h3", "fig-title", spec.title);
  title.id = `${spec.id}-title`;
  container.appendChild(title);
  container.appendChild(el("p", "fig-sub", spec.subtitle));

  const plot = el("div", "plot");
  plot.id = `${spec.id}-plot`;
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label", spec.alt);
  container.appendChild(plot);

  container.appendChild(buildTable(spec));
  container.appendChild(el("p", "fig-note", spec.note));

  return plot;
}

/** A failed fetch replaces one figure, never the story around it. */
export function showError(
  container: HTMLElement,
  message: string,
  retry: () => void,
): void {
  container.replaceChildren();
  const box = el("div", "fig-error");
  box.setAttribute("role", "status");
  box.appendChild(el("p", undefined, message));
  const btn = el("button", "fig-retry", "Try again");
  btn.type = "button";
  btn.addEventListener("click", retry);
  box.appendChild(btn);
  container.appendChild(box);
}
