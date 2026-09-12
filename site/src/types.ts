/** Shapes of the JSON aggregates written by `python -m pipeline`. */

export interface CiSpec {
  method: string;
  level: number;
}

/** One cell of a grouped proportion. `p`, `lo` and `hi` are null when suppressed. */
export interface PrevalenceRow {
  key: string[];
  n: number;
  events: number;
  p: number | null;
  lo: number | null;
  hi: number | null;
  small_n: boolean;
  suppressed: boolean;
}

/** `prevalence.v1`: a proportion with a Wilson interval per group cell. */
export interface Prevalence {
  schema: "prevalence.v1";
  id: string;
  generated_at: string;
  outcome: string;
  group_by: string[];
  levels: Record<string, string[]>;
  ci: CiSpec;
  n_total: number;
  events_total: number;
  rows: PrevalenceRow[];
}

/** `claims.v1`: a flat bag of named numbers quoted in the prose. */
export type Claims = Record<string, number | string>;

/** `meta.v1`: provenance of the source file and the generated outputs. */
export interface Meta {
  schema: "meta.v1";
  id: string;
  generated_at: string;
  source_file: string;
  sha256: string;
  n_rows: number;
  n_columns: number;
  n_duplicate_rows: number;
  n_events: number;
  files: string[];
}
