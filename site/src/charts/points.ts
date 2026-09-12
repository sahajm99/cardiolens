import type { Prevalence, PrevalenceRow } from "../types.ts";

/** One drawable cell of a two-key prevalence table. */
export interface Point {
  /** The level this point stands for, as the axis prints it. */
  label: string;
  p: number;
  lo: number;
  hi: number;
  n: number;
  smallN: boolean;
}

/**
 * One series of points: every level of `levelKey`, taken from the row whose
 * first key equals `fixed`. A cell with no estimate is left out rather than
 * drawn at zero, so a suppressed cell shows as a missing bar, not a short one.
 */
export function pointsFor(
  data: Prevalence,
  levelKey: string,
  fixed: string,
): Point[] {
  const out: Point[] = [];
  for (const level of data.levels[levelKey] ?? []) {
    const row: PrevalenceRow | undefined = data.rows.find(
      (r) => r.key[0] === fixed && r.key[1] === level,
    );
    if (!row || row.p === null || row.lo === null || row.hi === null) continue;
    out.push({
      label: level,
      p: row.p,
      lo: row.lo,
      hi: row.hi,
      n: row.n,
      smallN: row.small_n,
    });
  }
  return out;
}

/** The levels of `levelKey` that `pointsFor` could not draw for `fixed`. */
export function missingLevels(
  data: Prevalence,
  levelKey: string,
  fixed: string,
): string[] {
  const drawn = new Set(pointsFor(data, levelKey, fixed).map((d) => d.label));
  return (data.levels[levelKey] ?? []).filter((level) => !drawn.has(level));
}
