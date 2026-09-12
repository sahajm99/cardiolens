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

/** One side of a two-level split, in `factor_prevalence.v1`. Never suppressed. */
export interface FactorSide {
  label: string;
  n: number;
  events: number;
  p: number;
  lo: number;
  hi: number;
}

/** One factor's crude exposed/unexposed contrast and their prevalence ratio. */
export interface FactorContrast {
  id: string;
  label: string;
  column: string;
  exposed: FactorSide;
  unexposed: FactorSide;
  ratio: number;
  ratio_lo: number;
  ratio_hi: number;
}

/** `factor_prevalence.v1`: crude prevalence either side of each factor. */
export interface FactorPrevalence {
  schema: "factor_prevalence.v1";
  id: string;
  generated_at: string;
  n_total: number;
  events_total: number;
  /** Sorted by `ratio`, widest gap first. */
  factors: FactorContrast[];
}

/** One cell of `factor_by_age.v1`. `p`, `lo` and `hi` are null when suppressed. */
export interface FactorAgeCell {
  n: number;
  events: number;
  p: number | null;
  lo: number | null;
  hi: number | null;
  small_n: boolean;
  suppressed: boolean;
}

export interface FactorAgeRow {
  age: string;
  exposed: FactorAgeCell;
  unexposed: FactorAgeCell;
}

export interface FactorAgeSeries {
  id: string;
  label: string;
  exposed_label: string;
  unexposed_label: string;
  rows: FactorAgeRow[];
}

/** `factor_by_age.v1`: each factor's two prevalence curves across age bands. */
export interface FactorByAge {
  schema: "factor_by_age.v1";
  id: string;
  generated_at: string;
  age_bands: string[];
  factors: FactorAgeSeries[];
}

/**
 * One coefficient of a logistic model, as an odds ratio. Reference levels carry
 * `or: 1` with null `lo`, `hi`, `ame` and `p_value`; a `p_value` of 0 means
 * p < 0.001.
 */
export interface OddsTerm {
  variable: string;
  level: string;
  reference: string;
  label: string;
  group: "upstream" | "downstream";
  or: number;
  lo: number | null;
  hi: number | null;
  coef: number;
  se: number | null;
  p_value: number | null;
  ame: number | null;
  n_level: number;
  events_level: number;
  is_reference: boolean;
  unstable: boolean;
}

export interface OddsModel {
  label: string;
  covariates: string[];
  n_obs: number;
  n_events: number;
  converged: boolean;
  pseudo_r2_mcfadden: number;
  max_vif: number;
  df_model: number;
  intercept: number;
  terms: OddsTerm[];
}

/** `odds_ratios.v1`: the primary model and the one that adds downstream terms. */
export interface OddsRatios {
  schema: "odds_ratios.v1";
  id: string;
  generated_at: string;
  models: { primary: OddsModel; full: OddsModel };
}

/** One question of the estimator form. The form is built only from these. */
export interface EstimatorInput {
  variable: string;
  label: string;
  levels: string[];
  default: string;
}

/**
 * `estimator.v1`: the primary model's coefficients on the logit scale, enough
 * to evaluate one profile in the browser. `coefficients` carries levels the
 * form does not offer, so `inputs` is the only list the form may read.
 */
export interface Estimator {
  schema: "estimator.v1";
  id: string;
  generated_at: string;
  model: string;
  intercept: number;
  base_rate: number;
  inputs: EstimatorInput[];
  held_at_reference: string[];
  coefficients: Record<string, Record<string, number> | undefined>;
  age_band_rates: Record<string, number | undefined>;
}

/** `bmi_outcomes.v1`: one prevalence table per outcome, in one file. */
export interface BmiOutcomes {
  schema: "bmi_outcomes.v1";
  id: string;
  generated_at: string;
  tables: { hd: Prevalence; stroke: Prevalence };
}

/**
 * One group's crude and age-standardised prevalence. `min_band_n` is the
 * thinnest age band behind the standardised estimate, which is what makes a
 * standardised rate unstable even when the group total looks large.
 */
export interface RaceRow {
  key: string[];
  n: number;
  events: number;
  crude: number;
  crude_lo: number;
  crude_hi: number;
  std: number;
  std_lo: number;
  std_hi: number;
  min_band_n: number;
  small_n: boolean;
}

/** `race_prevalence.v1`: crude against age-standardised, per group. */
export interface RacePrevalence {
  schema: "race_prevalence.v1";
  id: string;
  generated_at: string;
  ci: { crude: string; standardised: string; level: number };
  standard_population: Record<string, number>;
  n_total: number;
  events_total: number;
  rows: RaceRow[];
}

/** One group's shares across the categories of `distribution.v1`. */
export interface DistributionRow {
  key: string[];
  n: number;
  shares: Record<string, number | undefined>;
  small_n: boolean;
  suppressed: boolean;
}

/** `distribution.v1`: how each group splits across one categorical column. */
export interface Distribution {
  schema: "distribution.v1";
  id: string;
  generated_at: string;
  group_by: string[];
  category_col: string;
  categories: string[];
  n_total: number;
  rows: DistributionRow[];
}

/**
 * One group's lifestyle means in `summary.v1`. Fields other than `bmi_*` and
 * `activity_*` are optional: the panel draws whichever measures the file
 * carries, so a later pipeline run can add one without a site change.
 */
export interface SummaryRow {
  key: string[];
  n: number;
  bmi_mean: number | null;
  bmi_lo: number | null;
  bmi_hi: number | null;
  activity_rate: number | null;
  activity_lo: number | null;
  activity_hi: number | null;
  sleep_mean?: number | null;
  sleep_lo?: number | null;
  sleep_hi?: number | null;
  small_n: boolean;
  suppressed: boolean;
}

/** `summary.v1`: a mean (and interval) per group, for several measures. */
export interface Summary {
  schema: "summary.v1";
  id: string;
  generated_at: string;
  group_by: string[];
  n_total: number;
  rows: SummaryRow[];
}
