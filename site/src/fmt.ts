/** Number formatting. Every number shown on the page passes through here. */

const nf = new Intl.NumberFormat("en-US");

/** 0.085595 -> "8.6%" */
export function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/** 0.085595 -> "9%" */
export function pct0(p: number): string {
  return pct(p, 0);
}

/** 2.015 -> "2.0x"; 31.41 -> "31x" (a second decimal on a big ratio is noise). */
export function ratio(r: number): string {
  return r >= 10 ? `${Math.round(r)}x` : `${r.toFixed(1)}x`;
}

/** 319795 -> "319,795" */
export function int(n: number): string {
  return nf.format(Math.round(n));
}

/** (0.084631, 0.08657) -> "95% CI 8.5% to 8.7%" */
export function ciText(lo: number, hi: number, digits = 1): string {
  return `95% CI ${pct(lo, digits)} to ${pct(hi, digits)}`;
}

/** 12 -> "1 in 12" */
export function oneIn(n: number): string {
  return `1 in ${int(n)}`;
}
