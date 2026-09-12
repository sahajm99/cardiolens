# CardioLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, public, story-shaped interactive analysis of heart-disease risk factors in the Kaggle extract of CDC BRFSS 2020, at https://sahajm99.github.io/cardiolens, regenerated end to end by `python -m pipeline`.

**Architecture:** `pipeline/` (Python package) reads `data/raw/heart_2020_cleaned.csv` and writes small JSON aggregates to `site/public/data/`. `site/` (Vite + TypeScript + Plotly cartesian bundle) fetches those JSON files and renders one chart module per section, lazily. GitHub Actions runs the pipeline, checks the committed JSON has not drifted, runs pytest, type-checks, builds and deploys Pages from `main`.

**Tech Stack:** Python 3.12, pandas 2.3, numpy, scipy, statsmodels 0.14, pytest, uv. Vite 8, TypeScript 6, plotly.js-cartesian-dist-min 4.1, @fontsource-variable/source-serif-4 and source-sans-3. GitHub Pages via actions/deploy-pages.

**Spec:** `docs/DESIGN.md`, `docs/DECISIONS.md` (decision IDs like S3, W4 are referenced below), `docs/BRIEF.md`.

## Global Constraints

- Repo root: `C:\Users\sahaj\OneDrive\Desktop\Experiments\projects\active\cardiolens`. Run Python with `uv run` from the repo root; run npm from `site/`.
- Never modify `data/raw/heart_2020_cleaned.csv` or anything under the UNT course folder.
- Every JSON in `site/public/data/` under 200 KB. Written with `json.dump(obj, f, indent=1, allow_nan=False, ensure_ascii=False)` and a trailing newline.
- Proportions are stored as floats in [0, 1] rounded to 6 decimals; formatting happens only in TypeScript.
- Wilson 95% intervals on every proportion (S1). Suppress n < 30 (nulls), flag n < 300 as `small_n` (S2).
- Reference levels pinned (S4): AgeCategory `18-24`, Sex `Female`, BMIClass `Normal`, Diabetic `No`, GenHealth `Excellent`, binaries `No`.
- Age band order, always: `18-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70-74, 75-79, 80 or older`.
- Race order, always: `White, Black, Hispanic, Asian, American Indian/Alaskan Native, Other`.
- GenHealth order: `Excellent, Very good, Good, Fair, Poor`. Diabetic order: `No, No, borderline diabetes, Yes, Yes (during pregnancy)`.
- BMIClass (S5): `Underweight` [0, 18.5), `Normal` [18.5, 25), `Overweight` [25, 30), `Obese I` [30, 35), `Obese II+` [35, inf).
- SleepBand: `Under 6h` [1, 6), `6-7h` [6, 8), `8-9h` [8, 10), `10h or more` [10, 24].
- MentalBand (poor mental health days in past 30): `0 days` (0), `1-13 days` [1, 13], `14 or more days` [14, 30].
- AgeGroup3: `18-44` (bands 18-24 .. 40-44), `45-64` (45-49 .. 60-64), `65 and older` (65-69 .. 80 or older).
- No numeral describing the data is hand-typed in site copy or chart titles; numbers come from JSON (W4).
- Colours only from the CSS custom properties defined in Task 5; Plotly never receives a hard-coded hex (W6, W7).
- No CDN. No external requests at runtime except the site's own `data/*.json`.
- Commit messages: conventional commits ending with a blank line then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Commit with `git -c user.name="Sahaj Mekala"` is not needed; the repo's git config is already set.
- Copy voice: plain sentences, no em dashes, no "risk" in the estimator panel (W12), sentence case everywhere.

---

## File structure

```
pipeline/
  __init__.py        exports run()
  __main__.py        python -m pipeline -> run()
  constants.py       column orders, band edges, reference levels, factor lists
  load.py            load_raw(), add_derived() -> DataFrame with ordered Categoricals
  stats.py           wilson(), fay_feuer_ci(), age_standardise()
  io.py              write_json(), OUT_DIR, size guard
  prevalence.py      prevalence_table() and every prevalence.v1 / distribution.v1 / summary.v1 builder
  models.py          fit_models() -> odds_ratios.json, estimator.json
  standardise.py     race_prevalence.json
  claims.py          claims.json and meta.json
  run.py             orchestrates all writers in order, prints a manifest
tests/
  conftest.py        session-scoped df fixture (full file), out_dir fixture
  test_stats.py
  test_load.py
  test_prevalence.py
  test_models.py
  test_standardise.py
  test_outputs.py    parametrised structural checks over every JSON + golden file
  golden/prevalence_by_age.json
site/
  index.html         the whole story's HTML skeleton (sections, prose, figure containers)
  vite.config.ts
  public/.nojekyll
  public/data/*.json (pipeline output, committed)
  src/main.ts        boots theme, nav, stat fills, lazy chart mounting
  src/theme.ts       theme toggle + CSS var reader
  src/plotly.ts      single import of the cartesian bundle
  src/data.ts        typed fetch of each JSON
  src/types.ts       TS interfaces for every schema
  src/fmt.ts         pct(), ratio(), int(), ciText()
  src/lazy.ts        IntersectionObserver mount
  src/figure.ts      figure chrome: title, subtitle, note, aria, details table, error state
  src/stats-fill.ts  fills <span data-stat> from claims.json
  src/charts/theme.ts   Plotly layout template from CSS vars
  src/charts/age.ts, factors.ts, factorByAge.ts, forest.ts, estimator.ts,
             heatmap.ts, sleepAge.ts, bmiOutcomes.ts, raceStd.ts, raceStroke.ts,
             raceHealth.ts, raceLifestyle.ts
  src/styles/tokens.css, base.css, layout.css, figure.css
notebooks/analysis.ipynb
.github/workflows/ci.yml
README.md
```

---

## JSON contract (all tasks use exactly these shapes)

**prevalence.v1** (used by every prevalence chart):
```json
{
  "schema": "prevalence.v1",
  "id": "prevalence_by_age",
  "generated_at": "2026-09-12T15:00:00Z",
  "outcome": "HeartDisease",
  "group_by": ["AgeCategory"],
  "levels": {"AgeCategory": ["18-24", "..."]},
  "ci": {"method": "wilson", "level": 0.95},
  "n_total": 319795,
  "events_total": 27373,
  "rows": [
    {"key": ["18-24"], "n": 21064, "events": 130, "p": 0.006172, "lo": 0.005205, "hi": 0.007317, "small_n": false, "suppressed": false}
  ]
}
```
Rules: `key` is always an array in `group_by` order; `rows` are in final display order (cartesian product of `levels` in order, `observed=False`); suppressed rows keep `n` and `events` and set `p`, `lo`, `hi` to `null`; `sum(rows.n) == n_total` for one-dimensional tables and for each fixed value of the other keys in multi-dimensional tables.

**distribution.v1** (100% stacked bars):
```json
{"schema": "distribution.v1", "id": "race_genhealth", "generated_at": "...", "group_by": ["Race"], "measure": "GenHealth", "levels": {"Race": [...], "GenHealth": [...]}, "rows": [{"key": ["White"], "n": 245212, "shares": {"Excellent": 0.21, "Very good": 0.37, "Good": 0.29, "Fair": 0.10, "Poor": 0.03}}]}
```
Rule: shares sum to 1 within 1e-6.

**summary.v1** (means and rates by group):
```json
{"schema": "summary.v1", "id": "race_lifestyle", "generated_at": "...", "group_by": ["Race"], "levels": {"Race": [...]}, "metrics": ["bmi_mean", "sleep_mean", "activity_rate"], "rows": [{"key": ["White"], "n": 245212, "bmi_mean": 28.2, "bmi_lo": 28.18, "bmi_hi": 28.22, "sleep_mean": 7.1, "sleep_lo": 7.09, "sleep_hi": 7.11, "activity_rate": 0.79, "activity_lo": 0.789, "activity_hi": 0.791}]}
```
Means get normal 95% CIs (mean ± 1.96·sd/√n); rates get Wilson.

**odds_ratios.v1**:
```json
{
  "schema": "odds_ratios.v1", "id": "odds_ratios", "generated_at": "...",
  "models": {
    "primary": {
      "label": "Primary model",
      "covariates": ["AgeCategory", "Sex", "BMIClass", "Smoking", "AlcoholDrinking", "Diabetic", "Stroke", "KidneyDisease", "Asthma", "SkinCancer"],
      "n_obs": 319795, "n_events": 27373, "converged": true, "pseudo_r2_mcfadden": 0.187, "max_vif": 3.1, "df_model": 26,
      "terms": [
        {"variable": "Smoking", "level": "Yes", "reference": "No", "label": "Smoker (100+ cigarettes ever)", "group": "upstream", "or": 1.69, "lo": 1.65, "hi": 1.74, "coef": 0.5259, "se": 0.0136, "p_value": 0.0, "ame": 0.0312, "n_level": 131908, "events_level": 16037, "is_reference": false, "unstable": false},
        {"variable": "Smoking", "level": "No", "reference": "No", "label": "Non-smoker", "group": "upstream", "or": 1.0, "lo": null, "hi": null, "coef": 0.0, "se": null, "p_value": null, "ame": null, "n_level": 187887, "events_level": 11336, "is_reference": true, "unstable": false}
      ],
      "intercept": -5.43
    },
    "full": {"label": "Full model (adds physical activity, difficulty walking, general health)", "covariates": ["...primary plus PhysicalActivity, DiffWalking, GenHealth"], "...": "same shape; downstream terms have group \"downstream\""}
  }
}
```
`group` is `"upstream"` for every primary covariate and `"downstream"` for PhysicalActivity, DiffWalking, GenHealth. `ame` is the average marginal effect (probability difference) from `get_margeff(at="overall")`. `p_value` rounded to 3 significant digits, values under 1e-300 stored as 0.0.

**estimator.v1** (browser evaluates the primary model):
```json
{"schema": "estimator.v1", "id": "estimator", "generated_at": "...", "model": "primary", "intercept": -5.43, "base_rate": 0.0856,
 "inputs": [{"variable": "AgeCategory", "label": "Age band", "levels": ["18-24", "..."], "default": "45-49"}, {"variable": "Sex", "label": "Sex", "levels": ["Female", "Male"], "default": "Female"}, {"variable": "BMIClass", "label": "BMI class", "levels": ["Underweight", "Normal", "Overweight", "Obese I", "Obese II+"], "default": "Normal"}, {"variable": "Smoking", "label": "Smoked 100+ cigarettes ever", "levels": ["No", "Yes"], "default": "No"}, {"variable": "Diabetic", "label": "Diabetes", "levels": ["No", "No, borderline diabetes", "Yes"], "default": "No"}, {"variable": "Stroke", "label": "Ever had a stroke", "levels": ["No", "Yes"], "default": "No"}, {"variable": "KidneyDisease", "label": "Kidney disease", "levels": ["No", "Yes"], "default": "No"}],
 "held_at_reference": ["AlcoholDrinking", "Asthma", "SkinCancer"],
 "coefficients": {"AgeCategory": {"18-24": 0.0, "25-29": 0.21, "...": 0.0}, "Sex": {"Female": 0.0, "Male": 0.63}, "...": {}},
 "age_band_rates": {"18-24": 0.0062, "...": 0.2256}}
```

**race_prevalence.v1**:
```json
{"schema": "race_prevalence.v1", "id": "race_prevalence", "generated_at": "...", "ci": {"crude": "wilson", "standardised": "fay-feuer gamma", "level": 0.95}, "standard_population": {"18-24": 0.0659, "...": 0.0755}, "rows": [{"key": ["White"], "n": 245212, "events": 22508, "crude": 0.0918, "crude_lo": 0.0907, "crude_hi": 0.0929, "std": 0.0901, "std_lo": 0.089, "std_hi": 0.0912, "min_band_n": 9000, "small_n": false}]}
```

**claims.v1** (`claims.json`): a flat object of named numbers used in titles and prose. Required keys: `n_rows`, `n_events`, `prev_overall`, `prev_overall_lo`, `prev_overall_hi`, `one_in`, `prev_youngest`, `prev_oldest`, `ratio_oldest_youngest`, `prev_smokers`, `prev_nonsmokers`, `ratio_smoking_crude`, `or_smoking_primary`, `or_smoking_full`, `prev_inactive`, `prev_active`, `ratio_activity_crude`, `or_activity_full`, `or_stroke_primary`, `or_diabetes_primary`, `or_kidney_primary`, `or_male_primary`, `or_age80_primary`, `or_obese2_primary`, `prev_male`, `prev_female`, `prev_race_highest`, `race_highest`, `prev_race_lowest`, `race_lowest`, `std_race_highest`, `std_race_lowest`, `ratio_stroke_crude`, `n_duplicate_rows`, `pct_duplicate_rows`, `brfss_2020_respondents` (401958), `dropped_by_kaggle` (82163). Every value is a number except `race_highest` and `race_lowest`, which are strings.

**meta.v1** (`meta.json`): `{"schema": "meta.v1", "generated_at": "...", "source_file": "data/raw/heart_2020_cleaned.csv", "sha256": "90a1e2e8bdcb4aba54314a41d35d2ac3be4763e459df33951e08e415f527f5a8", "n_rows": 319795, "n_columns": 18, "n_duplicate_rows": 18078, "n_events": 27373, "files": ["prevalence_by_age.json", "..."]}`.

**Output file list (exactly these 16):** `meta.json`, `claims.json`, `prevalence_by_age.json`, `prevalence_by_age_sex.json`, `prevalence_by_factor.json`, `factor_by_age.json`, `bmi_sleep_heatmap.json`, `sleep_by_agegroup.json`, `bmi_outcomes.json`, `odds_ratios.json`, `estimator.json`, `race_prevalence.json`, `race_stroke_hd.json`, `race_genhealth.json`, `race_lifestyle.json`, `factor_by_age.json` is listed once; the sixteenth is `prevalence_overall.json` (a prevalence.v1 with `group_by: []` and one row with key `[]`).

---

### Task 1: Pipeline foundations (constants, load, stats, io)

**Files:**
- Create: `pipeline/__init__.py`, `pipeline/__main__.py`, `pipeline/constants.py`, `pipeline/load.py`, `pipeline/stats.py`, `pipeline/io.py`, `pipeline/run.py`
- Create: `tests/conftest.py`, `tests/test_stats.py`, `tests/test_load.py`

**Interfaces:**
- Produces `pipeline.constants`: `RAW_PATH: Path`, `OUT_DIR: Path` (= repo `site/public/data`), `AGE_BANDS: list[str]`, `RACES: list[str]`, `GENHEALTH: list[str]`, `DIABETIC: list[str]`, `BMI_CLASSES: list[str]`, `BMI_EDGES: list[float]`, `SLEEP_BANDS: list[str]`, `SLEEP_EDGES`, `MENTAL_BANDS: list[str]`, `AGE_GROUPS3: list[str]`, `AGE_GROUP3_MAP: dict[str, str]`, `REFERENCE: dict[str, str]`, `BINARY_COLS: list[str]` (Smoking, AlcoholDrinking, Stroke, DiffWalking, PhysicalActivity, Asthma, KidneyDisease, SkinCancer), `FACTORS: list[dict]` (see Task 2), `SUPPRESS_N = 30`, `SMALL_N = 300`.
- Produces `pipeline.load.load_raw(path=RAW_PATH) -> pd.DataFrame` (raw columns, dtypes unchanged) and `pipeline.load.add_derived(df) -> pd.DataFrame` adding: `hd` (int 0/1), `stroke` (int 0/1), ordered Categoricals for `AgeCategory`, `Race`, `GenHealth`, `Diabetic`, `Sex` (Female, Male), every binary column as Categorical `[No, Yes]`, plus `BMIClass`, `SleepBand`, `MentalBand`, `AgeGroup3` as ordered Categoricals. `load_data()` = `add_derived(load_raw())`.
- Produces `pipeline.stats.wilson(events: int, n: int, z: float = 1.959964) -> tuple[float, float]` returning `(lo, hi)`; raises `ValueError` if n == 0 or events > n. `pipeline.stats.mean_ci(x: pd.Series) -> tuple[float, float, float]` (mean, lo, hi). `pipeline.stats.fay_feuer_ci(events_by_band: np.ndarray, n_by_band: np.ndarray, weights: np.ndarray, level=0.95) -> tuple[float, float, float]` returning (standardised rate, lo, hi). `pipeline.stats.round6(x) -> float`.
- Produces `pipeline.io.write_json(name: str, obj: dict) -> Path` writing to `OUT_DIR / name`, creating the directory, `allow_nan=False`, `indent=1`, trailing newline, and raising `RuntimeError` if the file exceeds 200,000 bytes. `pipeline.io.now_iso() -> str`.
- `pipeline.run.run()` is a stub in this task that only prints "no writers yet"; `__main__` calls it.

- [ ] **Step 1: Write failing stats tests** in `tests/test_stats.py`:

```python
import numpy as np
import pytest
from pipeline.stats import wilson, mean_ci, fay_feuer_ci

def test_wilson_known_value_zero_events():
    lo, hi = wilson(0, 10)
    assert lo == 0.0
    assert abs(hi - 0.2775) < 1e-3

def test_wilson_known_value_half():
    lo, hi = wilson(5, 10)
    assert abs(lo - 0.2366) < 1e-3 and abs(hi - 0.7634) < 1e-3

def test_wilson_all_events():
    lo, hi = wilson(10, 10)
    assert hi == 1.0 and abs(lo - 0.7225) < 1e-3

def test_wilson_rejects_bad_input():
    with pytest.raises(ValueError):
        wilson(1, 0)
    with pytest.raises(ValueError):
        wilson(3, 2)

def test_wilson_contains_point_estimate():
    lo, hi = wilson(27373, 319795)
    p = 27373 / 319795
    assert lo < p < hi and hi - lo < 0.003

def test_mean_ci_symmetric():
    import pandas as pd
    m, lo, hi = mean_ci(pd.Series([1.0, 2.0, 3.0, 4.0]))
    assert m == 2.5 and abs((m - lo) - (hi - m)) < 1e-9

def test_fay_feuer_matches_crude_when_weights_equal_band_shares():
    events = np.array([10, 20, 30]); n = np.array([100, 200, 300]); w = n / n.sum()
    rate, lo, hi = fay_feuer_ci(events, n, w)
    assert abs(rate - 0.1) < 1e-9 and lo < rate < hi

def test_fay_feuer_handles_zero_band():
    rate, lo, hi = fay_feuer_ci(np.array([0, 5]), np.array([50, 50]), np.array([0.5, 0.5]))
    assert 0 <= lo <= rate <= hi <= 1
```

- [ ] **Step 2: Run** `uv run pytest tests/test_stats.py -v` and confirm ImportError.

- [ ] **Step 3: Implement `pipeline/stats.py`**:

```python
from __future__ import annotations
import math
import numpy as np
import pandas as pd
from scipy import stats as sps

Z95 = 1.959964

def round6(x: float) -> float:
    return float(round(float(x), 6))

def wilson(events: int, n: int, z: float = Z95) -> tuple[float, float]:
    if n <= 0:
        raise ValueError("n must be positive")
    if events < 0 or events > n:
        raise ValueError("events must be within [0, n]")
    p = events / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))

def mean_ci(x: pd.Series, z: float = Z95) -> tuple[float, float, float]:
    x = pd.Series(x).astype(float)
    m = float(x.mean()); se = float(x.std(ddof=1) / math.sqrt(len(x))) if len(x) > 1 else 0.0
    return (m, m - z * se, m + z * se)

def fay_feuer_ci(events_by_band, n_by_band, weights, level: float = 0.95):
    """Directly standardised proportion with the Fay-Feuer (1997) gamma interval."""
    d = np.asarray(events_by_band, float); n = np.asarray(n_by_band, float); w = np.asarray(weights, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        wi = np.where(n > 0, w / n, 0.0)          # weight per event in band i
    rate = float(np.sum(wi * d))
    var = float(np.sum(wi * wi * d))
    wmax = float(np.max(wi)) if len(wi) else 0.0
    alpha = 1 - level
    if rate <= 0 or var <= 0:
        lo = 0.0
    else:
        lo = float(sps.gamma.ppf(alpha / 2, a=rate * rate / var, scale=var / rate))
    hi = float(sps.gamma.ppf(1 - alpha / 2, a=(rate + wmax) ** 2 / (var + wmax ** 2), scale=(var + wmax ** 2) / (rate + wmax)))
    return (rate, max(0.0, lo), min(1.0, hi))
```

- [ ] **Step 4: Run** `uv run pytest tests/test_stats.py -v`; all pass.

- [ ] **Step 5: Write failing load tests** in `tests/test_load.py` and `tests/conftest.py`:

```python
# tests/conftest.py
import pytest
from pipeline.load import load_data

@pytest.fixture(scope="session")
def df():
    return load_data()
```
```python
# tests/test_load.py
from pipeline.constants import AGE_BANDS, RACES, BMI_CLASSES, SLEEP_BANDS, MENTAL_BANDS, AGE_GROUPS3

def test_shape(df):
    assert df.shape[0] == 319795

def test_outcome_counts(df):
    assert int(df["hd"].sum()) == 27373
    assert set(df["hd"].unique()) == {0, 1}

def test_age_is_ordered_categorical(df):
    assert list(df["AgeCategory"].cat.categories) == AGE_BANDS
    assert df["AgeCategory"].cat.ordered
    assert df["AgeCategory"].isna().sum() == 0

def test_race_order(df):
    assert list(df["Race"].cat.categories) == RACES

def test_bmi_classes_cover_everyone(df):
    assert list(df["BMIClass"].cat.categories) == BMI_CLASSES
    assert df["BMIClass"].isna().sum() == 0
    assert (df.loc[df["BMI"] < 18.5, "BMIClass"] == "Underweight").all()
    assert (df.loc[df["BMI"] >= 35, "BMIClass"] == "Obese II+").all()

def test_sleep_and_mental_bands(df):
    assert list(df["SleepBand"].cat.categories) == SLEEP_BANDS
    assert df["SleepBand"].isna().sum() == 0
    assert list(df["MentalBand"].cat.categories) == MENTAL_BANDS
    assert (df.loc[df["MentalHealth"] == 0, "MentalBand"] == "0 days").all()

def test_age_group3(df):
    assert list(df["AgeGroup3"].cat.categories) == AGE_GROUPS3
    assert (df.loc[df["AgeCategory"] == "80 or older", "AgeGroup3"] == "65 and older").all()

def test_binary_categoricals(df):
    assert list(df["Smoking"].cat.categories) == ["No", "Yes"]
```

- [ ] **Step 6: Run** `uv run pytest tests/test_load.py -v`; confirm failure.

- [ ] **Step 7: Implement `pipeline/constants.py`, `pipeline/load.py`, `pipeline/io.py`, `pipeline/run.py`, `pipeline/__init__.py`, `pipeline/__main__.py`**. Key code for `load.py`:

```python
def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hd"] = (df["HeartDisease"] == "Yes").astype(int)
    df["stroke"] = (df["Stroke"] == "Yes").astype(int)
    df["AgeCategory"] = pd.Categorical(df["AgeCategory"], categories=AGE_BANDS, ordered=True)
    df["Race"] = pd.Categorical(df["Race"], categories=RACES, ordered=False)
    df["GenHealth"] = pd.Categorical(df["GenHealth"], categories=GENHEALTH, ordered=True)
    df["Diabetic"] = pd.Categorical(df["Diabetic"], categories=DIABETIC, ordered=False)
    df["Sex"] = pd.Categorical(df["Sex"], categories=["Female", "Male"])
    for c in BINARY_COLS:
        df[c] = pd.Categorical(df[c], categories=["No", "Yes"])
    df["BMIClass"] = pd.cut(df["BMI"], bins=BMI_EDGES, labels=BMI_CLASSES, right=False, ordered=True)
    df["SleepBand"] = pd.cut(df["SleepTime"], bins=[0, 6, 8, 10, 25], labels=SLEEP_BANDS, right=False, ordered=True)
    df["MentalBand"] = pd.cut(df["MentalHealth"], bins=[-0.5, 0.5, 13.5, 30.5], labels=MENTAL_BANDS, ordered=True)
    df["AgeGroup3"] = pd.Categorical(df["AgeCategory"].map(AGE_GROUP3_MAP), categories=AGE_GROUPS3, ordered=True)
    for c in ["BMIClass", "SleepBand", "MentalBand", "AgeGroup3"]:
        assert df[c].isna().sum() == 0, f"{c} has unassigned rows"
    return df
```
`BMI_EDGES = [0, 18.5, 25, 30, 35, float("inf")]`. `RAW_PATH = Path(__file__).resolve().parents[1] / "data" / "raw" / "heart_2020_cleaned.csv"`; `OUT_DIR = Path(__file__).resolve().parents[1] / "site" / "public" / "data"`.

- [ ] **Step 8: Run** `uv run pytest -v`; all pass. Run `uv run python -m pipeline`; prints "no writers yet".

- [ ] **Step 9: Commit**: `git add pipeline tests && git commit -m "feat(pipeline): loader with ordered categoricals, Wilson and Fay-Feuer intervals"` (with the Co-Authored-By trailer).

---

### Task 2: Prevalence, distribution and summary aggregates

**Files:**
- Create: `pipeline/prevalence.py`, `tests/test_prevalence.py`
- Modify: `pipeline/constants.py` (add `FACTORS`), `pipeline/run.py` (register writers)

**Interfaces:**
- Consumes `load_data`, `wilson`, `mean_ci`, `write_json`, `now_iso`, constants.
- Produces `pipeline.prevalence.prevalence_table(df, group_by: list[str], outcome_col: str = "hd", file_id: str = "", outcome_name: str = "HeartDisease") -> dict` returning a prevalence.v1 dict (not written). `group_by == []` gives the overall row with `key: []`.
- Produces writer functions, each `(df) -> Path`: `write_prevalence_overall`, `write_prevalence_by_age` (group_by AgeCategory), `write_prevalence_by_age_sex` (AgeCategory, Sex), `write_prevalence_by_factor`, `write_factor_by_age`, `write_bmi_sleep_heatmap` (MentalBand, BMIClass, SleepBand; MentalBand levels are the 3 bands plus a synthetic first level `All` computed on the whole df), `write_sleep_by_agegroup` (AgeGroup3, SleepBand), `write_bmi_outcomes` (two prevalence.v1 objects in one file under keys `hd` and `stroke`, each grouped by `AgeGroupAll, BMIClass` where `AgeGroupAll` = `["All"] + AGE_GROUPS3`; file schema `"bmi_outcomes.v1"` with `"tables": {"hd": {...}, "stroke": {...}}`), `write_race_stroke_hd` (Stroke, Race), `write_race_genhealth` (distribution.v1: Race x GenHealth shares), `write_race_lifestyle` (summary.v1).
- `FACTORS` (constants): list of dicts `{"id", "column", "label", "exposed", "unexposed", "exposed_label", "unexposed_label"}` for: smoking (Smoking Yes/No), alcohol (AlcoholDrinking), stroke, diabetes (Diabetic: exposed "Yes", unexposed "No"), diff_walking, kidney, asthma, skin_cancer, inactivity (PhysicalActivity: exposed "No" labelled "No physical activity", unexposed "Yes"), sex (Sex: exposed "Male", unexposed "Female"), obesity (BMIClass: exposed "Obese I" and "Obese II+" combined, unexposed "Normal"), short_sleep (SleepBand: exposed "Under 6h", unexposed "6-7h"), poor_health (GenHealth: exposed "Fair" and "Poor", unexposed "Excellent" and "Very good").
- `prevalence_by_factor.json` schema `"factor_prevalence.v1"`: `{"schema", "id", "generated_at", "n_total", "events_total", "factors": [{"id": "smoking", "label": "Smoking", "column": "Smoking", "exposed": {"label": "Smoker", "n", "events", "p", "lo", "hi"}, "unexposed": {"label": "Non-smoker", ...}, "ratio": 2.016, "ratio_lo": ..., "ratio_hi": ...}]}` where ratio CI uses the log-ratio normal approximation: `se = sqrt((1-p1)/(e1) + (1-p2)/(e2))`, `exp(log(ratio) ± 1.96·se)`. Factors sorted by `ratio` descending.
- `factor_by_age.json` schema `"factor_by_age.v1"`: `{"schema", "id", "generated_at", "age_bands": AGE_BANDS, "factors": [{"id", "label", "exposed_label", "unexposed_label", "rows": [{"age": "18-24", "exposed": {"n", "events", "p", "lo", "hi", "suppressed", "small_n"}, "unexposed": {...}}]}]}` for factor ids smoking, inactivity, obesity, short_sleep, sex, diabetes.

- [ ] **Step 1: Write failing tests** in `tests/test_prevalence.py`:

```python
import json
from pipeline.prevalence import (prevalence_table, write_prevalence_by_age, write_prevalence_by_factor,
    write_bmi_sleep_heatmap, write_race_genhealth, write_race_lifestyle, write_factor_by_age, write_bmi_outcomes)
from pipeline.constants import AGE_BANDS, RACES, BMI_CLASSES, SLEEP_BANDS, MENTAL_BANDS

def test_overall_prevalence(df):
    t = prevalence_table(df, [])
    row = t["rows"][0]
    assert row["key"] == [] and row["n"] == 319795 and row["events"] == 27373
    assert abs(row["p"] - 0.0856) < 0.0005 and row["lo"] < row["p"] < row["hi"]

def test_age_table_order_and_monotone(df):
    t = prevalence_table(df, ["AgeCategory"])
    assert [r["key"][0] for r in t["rows"]] == AGE_BANDS
    ps = [r["p"] for r in t["rows"]]
    assert ps == sorted(ps)
    assert sum(r["n"] for r in t["rows"]) == t["n_total"] == 319795
    assert sum(r["events"] for r in t["rows"]) == t["events_total"] == 27373
    assert t["rows"][0]["p"] < 0.01 and t["rows"][-1]["p"] > 0.2

def test_two_way_table_is_full_cartesian(df):
    t = prevalence_table(df, ["AgeCategory", "Sex"])
    assert len(t["rows"]) == 13 * 2
    assert t["rows"][0]["key"] == ["18-24", "Female"] and t["rows"][1]["key"] == ["18-24", "Male"]
    assert sum(r["n"] for r in t["rows"]) == 319795

def test_suppression_rules(df):
    small = df.head(25)
    t = prevalence_table(small, ["Sex"])
    for r in t["rows"]:
        assert r["suppressed"] is True and r["p"] is None and r["lo"] is None and r["n"] < 30

def test_small_n_flag(df):
    t = prevalence_table(df, ["Race", "Stroke"])
    flagged = [r for r in t["rows"] if r["small_n"]]
    assert all(r["n"] < 300 for r in flagged)
    assert all((not r["small_n"]) for r in t["rows"] if r["n"] >= 300)

def test_factor_file(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    p = write_prevalence_by_factor(df)
    d = json.loads(p.read_text(encoding="utf-8"))
    ids = [f["id"] for f in d["factors"]]
    assert "smoking" in ids and "inactivity" in ids and "obesity" in ids and "sex" in ids
    smoking = next(f for f in d["factors"] if f["id"] == "smoking")
    assert abs(smoking["exposed"]["p"] - 0.1216) < 0.001 and abs(smoking["unexposed"]["p"] - 0.0603) < 0.001
    assert 1.9 < smoking["ratio"] < 2.1 and smoking["ratio_lo"] < smoking["ratio"] < smoking["ratio_hi"]
    ratios = [f["ratio"] for f in d["factors"]]
    assert ratios == sorted(ratios, reverse=True)

def test_heatmap_file(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    d = json.loads(write_bmi_sleep_heatmap(df).read_text(encoding="utf-8"))
    assert d["levels"]["MentalBand"] == ["All"] + MENTAL_BANDS
    assert len(d["rows"]) == 4 * len(BMI_CLASSES) * len(SLEEP_BANDS)
    all_rows = [r for r in d["rows"] if r["key"][0] == "All"]
    assert sum(r["n"] for r in all_rows) == 319795

def test_factor_by_age_file(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    d = json.loads(write_factor_by_age(df).read_text(encoding="utf-8"))
    smoking = next(f for f in d["factors"] if f["id"] == "smoking")
    assert [r["age"] for r in smoking["rows"]] == AGE_BANDS
    assert all(r["exposed"]["p"] is not None for r in smoking["rows"])

def test_bmi_outcomes_file(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    d = json.loads(write_bmi_outcomes(df).read_text(encoding="utf-8"))
    assert set(d["tables"]) == {"hd", "stroke"}
    hd = d["tables"]["hd"]
    assert hd["levels"]["AgeGroupAll"][0] == "All" and len(hd["rows"]) == 4 * len(BMI_CLASSES)

def test_genhealth_shares_sum_to_one(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    d = json.loads(write_race_genhealth(df).read_text(encoding="utf-8"))
    assert [r["key"][0] for r in d["rows"]] == RACES
    for r in d["rows"]:
        assert abs(sum(r["shares"].values()) - 1) < 1e-6

def test_lifestyle_summary(df, tmp_path, monkeypatch):
    import pipeline.io as io
    monkeypatch.setattr(io, "OUT_DIR", tmp_path)
    d = json.loads(write_race_lifestyle(df).read_text(encoding="utf-8"))
    assert sum(r["n"] for r in d["rows"]) == 319795
    for r in d["rows"]:
        assert r["bmi_lo"] <= r["bmi_mean"] <= r["bmi_hi"] and 0 <= r["activity_lo"] <= r["activity_rate"] <= r["activity_hi"] <= 1
```

- [ ] **Step 2: Run** `uv run pytest tests/test_prevalence.py -v`; ImportError.

- [ ] **Step 3: Implement `pipeline/prevalence.py`.** The core:

```python
def _row(key: list[str], n: int, events: int) -> dict:
    if n < SUPPRESS_N:
        return {"key": key, "n": int(n), "events": int(events), "p": None, "lo": None, "hi": None, "small_n": True, "suppressed": True}
    lo, hi = wilson(events, n)
    return {"key": key, "n": int(n), "events": int(events), "p": round6(events / n), "lo": round6(lo), "hi": round6(hi), "small_n": n < SMALL_N, "suppressed": False}

def prevalence_table(df, group_by, outcome_col="hd", file_id="", outcome_name="HeartDisease"):
    if not group_by:
        rows = [_row([], len(df), int(df[outcome_col].sum()))]
        levels = {}
    else:
        g = df.groupby(group_by, observed=False)[outcome_col].agg(["size", "sum"])
        rows = []
        for key, (n, ev) in g.iterrows():
            key = list(key) if isinstance(key, tuple) else [key]
            rows.append(_row([str(k) for k in key], int(n), int(ev)))
        levels = {c: [str(x) for x in df[c].cat.categories] for c in group_by}
    return {"schema": "prevalence.v1", "id": file_id, "generated_at": now_iso(), "outcome": outcome_name,
            "group_by": list(group_by), "levels": levels, "ci": {"method": "wilson", "level": 0.95},
            "n_total": int(len(df)), "events_total": int(df[outcome_col].sum()), "rows": rows}
```
For the heatmap's synthetic `All` level: build the 2-D table on the whole df, prefix each key with `"All"`, then build the 3-D table and concatenate; set `levels["MentalBand"] = ["All"] + MENTAL_BANDS` and `group_by = ["MentalBand", "BMIClass", "SleepBand"]`. Same pattern for `AgeGroupAll` in `write_bmi_outcomes` (outcome `stroke` uses `outcome_col="stroke"`, `outcome_name="Stroke"`). Use `groupby(..., observed=False)` so every cell exists; `pandas` will iterate the full cartesian product in category order.

- [ ] **Step 4: Run** `uv run pytest -v`; all pass.

- [ ] **Step 5: Register writers in `pipeline/run.py`**: `WRITERS = [write_prevalence_overall, write_prevalence_by_age, ...]`; `run()` loads data once, calls each writer, prints `name  bytes`, and returns the list of paths. Run `uv run python -m pipeline` and confirm the files appear under `site/public/data/` and each is under 200 KB.

- [ ] **Step 6: Commit** `git add pipeline tests site/public/data && git commit -m "feat(pipeline): prevalence, distribution and summary aggregates with Wilson intervals"`.

---

### Task 3: Logistic models, odds ratios and the estimator table

**Files:**
- Create: `pipeline/models.py`, `tests/test_models.py`
- Modify: `pipeline/run.py`

**Interfaces:**
- Consumes `load_data`, `REFERENCE`, `write_json`.
- Produces `pipeline.models.fit_models(df) -> tuple[dict, dict]` returning `(odds_ratios_obj, estimator_obj)` matching **odds_ratios.v1** and **estimator.v1**; `write_models(df) -> list[Path]` writes `odds_ratios.json` and `estimator.json`.
- Formula strings, exactly:
  - `PRIMARY_COVS = ["AgeCategory", "Sex", "BMIClass", "Smoking", "AlcoholDrinking", "Diabetic", "Stroke", "KidneyDisease", "Asthma", "SkinCancer"]`
  - `FULL_COVS = PRIMARY_COVS + ["PhysicalActivity", "DiffWalking", "GenHealth"]`
  - formula = `"hd ~ " + " + ".join(f"C({c}, Treatment('{REFERENCE[c]}'))" for c in covs)`; fit with `smf.logit(formula, df).fit(disp=0, maxiter=200)`.
- Term parsing: statsmodels names look like `C(Smoking, Treatment('No'))[T.Yes]`; parse variable and level with the regex `r"^C\((\w+), Treatment\('([^']*)'\)\)\[T\.(.+)\]$"`. Reference rows are synthesised (one per covariate) with `or 1.0`, `is_reference true`.
- `label` per term comes from a `LABELS: dict[str, dict[str, str]]` in `models.py` (human phrasing, e.g. Smoking Yes -> "Smoker (100+ cigarettes ever)", DiffWalking Yes -> "Serious difficulty walking", GenHealth Poor -> "Self-rated health: poor", AgeCategory band -> "Age 45-49"); any level without an entry falls back to `f"{variable}: {level}"`.
- `unstable`: for each (variable, level) compute the 2x2 table against `hd`; `unstable = min(cells) < 10`.
- `max_vif`: use `statsmodels.stats.outliers_influence.variance_inflation_factor` over the design matrix columns excluding the intercept (`res.model.exog`); this takes a few seconds; store rounded to 2 decimals.
- `ame`: `res.get_margeff(at="overall", method="dydx").summary_frame()["dy/dx"]` matched by term name.
- `n_level`, `events_level`: counts from the df.
- Estimator: `coefficients[variable][level] = coef` with reference levels at 0.0; Diabetic exposes only `No`, `No, borderline diabetes`, `Yes` in `inputs` (the gestational coefficient is still in `coefficients`); `age_band_rates` from a crude age groupby.
- Convergence: `assert res.mle_retvals["converged"]`, raise `RuntimeError` otherwise.

- [ ] **Step 1: Write failing tests** in `tests/test_models.py`:

```python
import json, pytest
from pipeline.models import fit_models, PRIMARY_COVS, FULL_COVS

@pytest.fixture(scope="module")
def models(df):
    return fit_models(df)

def test_both_models_converged(models):
    orj, est = models
    assert orj["models"]["primary"]["converged"] is True and orj["models"]["full"]["converged"] is True

def test_one_reference_row_per_variable(models):
    orj, _ = models
    for m in orj["models"].values():
        refs = [t for t in m["terms"] if t["is_reference"]]
        assert sorted(t["variable"] for t in refs) == sorted(m["covariates"])

def test_reference_levels_pinned(models):
    orj, _ = models
    prim = orj["models"]["primary"]["terms"]
    ref = {t["variable"]: t["level"] for t in prim if t["is_reference"]}
    assert ref["AgeCategory"] == "18-24" and ref["Sex"] == "Female" and ref["BMIClass"] == "Normal" and ref["Diabetic"] == "No" and ref["Smoking"] == "No"

def test_anchor_odds_ratios(models):
    orj, _ = models
    prim = {(t["variable"], t["level"]): t for t in orj["models"]["primary"]["terms"]}
    assert 1.1 < prim[("Smoking", "Yes")]["or"] < 1.8
    assert prim[("AgeCategory", "80 or older")]["or"] > 5
    assert prim[("Sex", "Male")]["or"] > 1.5
    assert prim[("Stroke", "Yes")]["or"] > 2
    for t in prim.values():
        if not t["is_reference"]:
            assert t["lo"] < t["or"] < t["hi"]

def test_groups(models):
    orj, _ = models
    full = orj["models"]["full"]["terms"]
    assert {t["group"] for t in full if t["variable"] in ("PhysicalActivity", "DiffWalking", "GenHealth")} == {"downstream"}
    assert {t["group"] for t in full if t["variable"] in PRIMARY_COVS} == {"upstream"}

def test_term_count(models):
    orj, _ = models
    prim = orj["models"]["primary"]
    assert len([t for t in prim["terms"] if not t["is_reference"]]) == prim["df_model"]

def test_estimator_reproduces_model(models, df):
    import math
    _, est = models
    assert est["model"] == "primary" and set(est["coefficients"]) == set(PRIMARY_COVS)
    # all-reference profile equals intercept probability
    p_ref = 1 / (1 + math.exp(-est["intercept"]))
    assert 0 < p_ref < 0.05
    assert abs(est["base_rate"] - 0.0856) < 0.0005
    assert est["age_band_rates"]["80 or older"] > 0.2

def test_estimator_inputs(models):
    _, est = models
    vars_ = [i["variable"] for i in est["inputs"]]
    assert vars_ == ["AgeCategory", "Sex", "BMIClass", "Smoking", "Diabetic", "Stroke", "KidneyDisease"]
    dia = next(i for i in est["inputs"] if i["variable"] == "Diabetic")
    assert dia["levels"] == ["No", "No, borderline diabetes", "Yes"]
    assert est["held_at_reference"] == ["AlcoholDrinking", "Asthma", "SkinCancer"]

def test_no_unstable_terms_in_primary(models):
    orj, _ = models
    assert not any(t["unstable"] for t in orj["models"]["primary"]["terms"] if not t["is_reference"])
```

- [ ] **Step 2: Run** `uv run pytest tests/test_models.py -v`; ImportError.
- [ ] **Step 3: Implement `pipeline/models.py`** per the interface. Keep `fit_models` pure (no writing) and `write_models` thin.
- [ ] **Step 4: Run** `uv run pytest tests/test_models.py -v` (about 30 s); all pass.
- [ ] **Step 5: Register `write_models` in `run.py`** (it returns a list; flatten). Run `uv run python -m pipeline`; confirm `odds_ratios.json` and `estimator.json` exist and are under 200 KB.
- [ ] **Step 6: Commit** `feat(pipeline): logistic models with adjusted odds ratios, marginal effects and browser estimator table`.

---

### Task 4: Race standardisation, claims, meta, structural tests, golden file

**Files:**
- Create: `pipeline/standardise.py`, `pipeline/claims.py`, `tests/test_standardise.py`, `tests/test_outputs.py`, `tests/golden/prevalence_by_age.json`
- Modify: `pipeline/run.py` (order: aggregates, models, standardise, then claims and meta last because they read the other outputs)

**Interfaces:**
- `pipeline.standardise.race_prevalence(df) -> dict` (race_prevalence.v1) and `write_race_prevalence(df) -> Path`. Standard population weights `w_i = n_i / N` from the whole df's AgeCategory distribution. For each race: crude Wilson; standardised via `fay_feuer_ci(events_by_band, n_by_band, w)`; `min_band_n`; `small_n = min_band_n < 30`.
- `pipeline.claims.build_claims(df, outputs: dict[str, dict]) -> dict` where `outputs` maps file name to the already-built JSON objects (read back from `OUT_DIR`); `write_claims_and_meta(df) -> list[Path]` writes `claims.json` and `meta.json` (meta lists every file present in `OUT_DIR` sorted, and the sha256 of the raw CSV computed at run time).
- `one_in = round(1 / prev_overall)` (12). `ratio_oldest_youngest = prev_oldest / prev_youngest`.

- [ ] **Step 1: Write failing tests**:

```python
# tests/test_standardise.py
from pipeline.standardise import race_prevalence
from pipeline.constants import RACES

def test_rows_and_weights(df):
    d = race_prevalence(df)
    assert [r["key"][0] for r in d["rows"]] == RACES
    assert abs(sum(d["standard_population"].values()) - 1) < 1e-9
    assert sum(r["n"] for r in d["rows"]) == 319795

def test_standardisation_moves_estimates_sensibly(df):
    d = race_prevalence(df)
    rows = {r["key"][0]: r for r in d["rows"]}
    for r in rows.values():
        assert r["crude_lo"] <= r["crude"] <= r["crude_hi"]
        assert r["std_lo"] <= r["std"] <= r["std_hi"]
    # Hispanic respondents are younger than the pool, so standardising raises their rate
    assert rows["Hispanic"]["std"] > rows["Hispanic"]["crude"]
    # White respondents are older than the pool, so standardising lowers theirs
    assert rows["White"]["std"] < rows["White"]["crude"]
```
```python
# tests/test_outputs.py
import json, math, pathlib, pytest
from pipeline.constants import OUT_DIR, AGE_BANDS

EXPECTED = sorted(["meta.json", "claims.json", "prevalence_overall.json", "prevalence_by_age.json", "prevalence_by_age_sex.json",
    "prevalence_by_factor.json", "factor_by_age.json", "bmi_sleep_heatmap.json", "sleep_by_agegroup.json", "bmi_outcomes.json",
    "odds_ratios.json", "estimator.json", "race_prevalence.json", "race_stroke_hd.json", "race_genhealth.json", "race_lifestyle.json"])

@pytest.fixture(scope="module")
def outputs():
    from pipeline.run import run
    run()
    return {p.name: json.loads(p.read_text(encoding="utf-8")) for p in OUT_DIR.glob("*.json")}

def test_exact_file_set(outputs):
    assert sorted(outputs) == EXPECTED

@pytest.mark.parametrize("name", EXPECTED)
def test_file_is_small_and_clean(name, outputs):
    text = (OUT_DIR / name).read_text(encoding="utf-8")
    assert len(text.encode("utf-8")) < 200_000
    assert "NaN" not in text and "Infinity" not in text
    assert outputs[name]["schema"] and outputs[name]["generated_at"]

def _walk_prevalence_rows(obj):
    if isinstance(obj, dict):
        if obj.get("schema") == "prevalence.v1":
            yield from obj["rows"]
        for v in obj.values():
            yield from _walk_prevalence_rows(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_prevalence_rows(v)

def test_every_prevalence_row_is_consistent(outputs):
    count = 0
    for name, obj in outputs.items():
        for r in _walk_prevalence_rows(obj):
            count += 1
            assert r["events"] <= r["n"]
            if r["suppressed"]:
                assert r["p"] is None and r["n"] < 30
            else:
                assert 0 <= r["lo"] <= r["p"] <= r["hi"] <= 1
    assert count > 100

def test_one_dimensional_conservation(outputs):
    for name in ["prevalence_by_age.json"]:
        t = outputs[name]
        assert sum(r["n"] for r in t["rows"]) == t["n_total"]
        assert sum(r["events"] for r in t["rows"]) == t["events_total"]

def test_age_order_literal(outputs):
    assert [r["key"][0] for r in outputs["prevalence_by_age.json"]["rows"]] == AGE_BANDS

def test_claims_anchors(outputs):
    c = outputs["claims.json"]
    assert abs(c["prev_overall"] - 0.0856) < 0.0005 and c["one_in"] == 12
    assert c["n_rows"] == 319795 and c["n_duplicate_rows"] == 18078
    assert c["ratio_oldest_youngest"] > 30 and 1.9 < c["ratio_smoking_crude"] < 2.1
    assert 1.1 < c["or_smoking_primary"] < 1.8 and 0.9 < c["or_activity_full"] < 1.2
    assert isinstance(c["race_highest"], str) and c["brfss_2020_respondents"] == 401958

def test_meta(outputs):
    m = outputs["meta.json"]
    assert m["sha256"] == "90a1e2e8bdcb4aba54314a41d35d2ac3be4763e459df33951e08e415f527f5a8"
    assert sorted(m["files"]) == EXPECTED

def test_golden_prevalence_by_age(outputs):
    golden = json.loads(pathlib.Path("tests/golden/prevalence_by_age.json").read_text(encoding="utf-8"))
    actual = outputs["prevalence_by_age.json"]
    for k in ("rows", "n_total", "events_total", "levels", "group_by"):
        assert actual[k] == golden[k]
```

- [ ] **Step 2: Run** `uv run pytest tests/test_standardise.py tests/test_outputs.py -v`; failures.
- [ ] **Step 3: Implement `standardise.py`, `claims.py`; finalise `run.py`** (claims/meta run last, reading the files just written). `run()` must be idempotent: it deletes stale `*.json` in `OUT_DIR` before writing.
- [ ] **Step 4: Run the pipeline once**, then copy `site/public/data/prevalence_by_age.json` to `tests/golden/prevalence_by_age.json`.
- [ ] **Step 5: Run** `uv run pytest -v`; all pass (whole suite under 2 minutes). Run `uv run python -m pipeline` a second time and `git status` shows only `generated_at` changes; then make `generated_at` deterministic: set it from the environment variable `SOURCE_DATE_EPOCH` if present, else the current time, and document that CI sets it. Simpler and required: in `now_iso()`, if `os.environ.get("CARDIOLENS_FIXED_TIME")` is set use it; the CI diff step will run with it set to the value stored in `meta.json`. Instead of this complexity, **decision**: remove `generated_at` from the per-file diff by making the CI staleness check compare files with `generated_at` lines stripped (`grep -v '"generated_at"'`). Keep `generated_at` in the files.
- [ ] **Step 6: Commit** `feat(pipeline): age-standardised race prevalence, claims and meta with structural output tests`.

---

### Task 5: Site skeleton, theme, chart 1, CI and first Pages deploy

**Files:**
- Create: `site/vite.config.ts`, `site/public/.nojekyll`, `site/src/types.ts`, `site/src/data.ts`, `site/src/fmt.ts`, `site/src/plotly.ts`, `site/src/theme.ts`, `site/src/lazy.ts`, `site/src/figure.ts`, `site/src/stats-fill.ts`, `site/src/charts/theme.ts`, `site/src/charts/age.ts`, `site/src/styles/tokens.css`, `site/src/styles/base.css`, `site/src/styles/layout.css`, `site/src/styles/figure.css`, `.github/workflows/ci.yml`, `README.md`
- Modify: `site/index.html`, `site/src/main.ts`, `site/package.json` (scripts: `"build": "tsc --noEmit && vite build"`, `"typecheck": "tsc --noEmit"`), `site/tsconfig.json` (`"types": []`, `"resolveJsonModule": true`).
- Delete: `site/src/counter.ts`, `site/src/style.css`, `site/src/assets/*`, `site/public/favicon.svg`, `site/public/icons.svg` (replace favicon with a small inline SVG data URI in `index.html`).
- Install: `npm i -D @fontsource-variable/source-serif-4 @fontsource-variable/source-sans-3` (they are dev deps because they are bundled).

**Interfaces:**
- `site/vite.config.ts`: `base: process.env.VITE_BASE ?? "/cardiolens/"`, `build.target: "es2020"`, `build.chunkSizeWarningLimit: 2000`, plotly in its own chunk via `build.rollupOptions.output.manualChunks: { plotly: ["plotly.js-cartesian-dist-min"] }`.
- `site/src/plotly.ts`: `import Plotly from "plotly.js-cartesian-dist-min"; export default Plotly;` with a `declare module "plotly.js-cartesian-dist-min" { import Plotly from "plotly.js"; export default Plotly; }` in `site/src/plotly.d.ts`.
- `site/src/data.ts`: `export async function loadJson<T>(name: string): Promise<T>` fetching `${import.meta.env.BASE_URL}data/${name}` with `cache: "force-cache"` and throwing `Error(\`Could not load ${name} (${res.status})\`)` on non-2xx.
- `site/src/fmt.ts`: `pct(p: number, digits = 1): string` ("8.6%"), `pct0`, `ratio(r: number): string` ("2.0x" with one decimal; "31x" if >= 10), `int(n: number): string` (thousands separators), `ciText(lo, hi)` ("95% CI 8.5% to 8.7%"), `oneIn(n)`.
- `site/src/theme.ts`: `initTheme()` (reads `localStorage.cardiolens-theme`, else system), `toggleTheme()`, `onThemeChange(cb)`, `cssVar(name: string): string` reading `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`.
- `site/src/charts/theme.ts`: `export function layoutTemplate(): Partial<Plotly.Layout>` built from CSS vars: `paper_bgcolor` and `plot_bgcolor` = `--surface`, `font.family` = `"Source Sans 3 Variable", system-ui, sans-serif`, `font.color` = `--ink-2`, `font.size` 13, axes `gridcolor` = `--grid`, `zerolinecolor` = `--grid`, `linecolor` = `--grid`, `tickfont.color` = `--ink-2`, `margin {l: 8, r: 16, t: 8, b: 40}`, `hoverlabel` bg `--surface-2`, font color `--ink`, `bordercolor` `--grid`; `export const series = () => ({ s1: cssVar("--series-1"), s2: cssVar("--series-2"), s3: cssVar("--series-3"), s4: cssVar("--series-4"), muted: cssVar("--ink-3"), grid: cssVar("--grid") })`; `export const CONFIG: Partial<Plotly.Config> = { displayModeBar: false, responsive: true, scrollZoom: false }`.
- `site/src/figure.ts`: `export interface FigureSpec { id: string; title: string; subtitle: string; note: string; alt: string; table: { columns: string[]; rows: (string | number)[][] } }` and `export function mountFigure(container: HTMLElement, spec: FigureSpec): HTMLDivElement` that writes the `<h3 class="fig-title">`, `<p class="fig-sub">`, returns the plot div (with `role="img"`, `aria-label = spec.alt`), and appends `<details class="fig-table"><summary>Show the numbers</summary><table>…</table></details>` and `<p class="fig-note">`. `export function showError(container, message, retry: () => void)`.
- `site/src/lazy.ts`: `export function whenVisible(el: Element, cb: () => void, rootMargin = "200px")` using IntersectionObserver, firing once; falls back to immediate call if `IntersectionObserver` is undefined.
- `site/src/stats-fill.ts`: `fillStats(claims: Record<string, number | string>)` replaces the text of every `[data-stat]` element: attribute value is `key` or `key|fmt` where fmt is one of `pct`, `pct0`, `ratio`, `int`, `oneIn`, `raw`.
- Chart module contract, used by every chart task: `export async function render(container: HTMLElement): Promise<void>`; each module fetches its own JSON, calls `mountFigure`, `Plotly.react(plotDiv, traces, {...layoutTemplate(), ...}, CONFIG)`, and registers `onThemeChange(() => rerender)`. On fetch error it calls `showError` with a retry that calls `render` again. Titles are built from the JSON using `fmt` helpers, never hand-typed numbers.
- `site/src/main.ts`: `initTheme()`, wire `#theme-toggle`, load `claims.json` and `fillStats`, then for each `[data-chart]` element look up the module in a `Record<string, () => Promise<{render}>>` map (dynamic `import()` per chart) and `whenVisible(el, () => mod.render(el))`; the element with `data-chart="age"` renders immediately.
- `site/src/charts/age.ts`: reads `prevalence_by_age.json` and `prevalence_by_age_sex.json`. Horizontal bar (`orientation: "h"`), y = age bands (youngest at the bottom: `yaxis.autorange: "reversed"` is wrong for horizontal; set `y` in reverse order so 18-24 is at the top), x = p, `error_x: {type: "data", symmetric: false, array: hi - p, arrayminus: p - lo}`, `marker.color = series().s1`, bar width 0.6, `hovertemplate` `"%{y}<br><b>%{x:.1%}</b> (95% CI %{customdata[0]:.1%} to %{customdata[1]:.1%})<br>n = %{customdata[2]:,}"`. A native `<div class="seg" role="group">` with two buttons "All adults" / "By sex" above the plot; "By sex" switches to two traces (Female = s1, Male = s2, `barmode: "group"`), legend shown only in that state. Title: `` `Heart disease climbs from ${pct(young.p)} of adults aged 18 to 24 to ${pct(old.p)} at 80 and older` ``. Subtitle: `` `${int(n_total)} adults, unweighted, 95% Wilson intervals` ``. Note: `Source: Kaggle extract of CDC BRFSS 2020`. Table: age band, n, prevalence, CI.
- `index.html` skeleton (Task 9 fills the prose; this task creates every section id and the figure containers with reserved heights): header with site name "CardioLens" and theme toggle button (`aria-pressed`); sticky `<nav aria-label="Sections">` with links to `#hook`, `#age`, `#survives`, `#interactions`, `#gaps`, `#limits`; `<main>` with `<section id="hook">` (hero h1, differentiation line, three stat tiles with `data-stat`, read-this-first strip), `<section id="age">` containing `<figure class="fig" data-chart="age" style="--fig-h: 520px"></figure>`, empty sections for the rest, `<footer>`; `<noscript>`.
- CSS tokens (`tokens.css`), light on `:root`, dark under both `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and `:root[data-theme="dark"] {…}`:
  - light: `--surface: #fbfaf7; --surface-2: #f1efe9; --ink: #16181d; --ink-2: #4a4d55; --ink-3: #8a8d95; --grid: #e2e0d9; --accent: #2a78d6; --flag: #eb6834; --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100; --seq-1: #cde2fb; --seq-2: #9ec5f4; --seq-3: #5598e7; --seq-4: #256abf; --seq-5: #104281;`
  - dark: `--surface: #15161a; --surface-2: #1f2127; --ink: #f2f1ec; --ink-2: #c3c2b7; --ink-3: #85868f; --grid: #2d2f36; --accent: #3987e5; --flag: #d95926; --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --seq-1: #184f95; --seq-2: #1c5cab; --seq-3: #3987e5; --seq-4: #86b6ef; --seq-5: #cde2fb;`
  - type: `--font-prose: "Source Serif 4 Variable", Georgia, serif; --font-ui: "Source Sans 3 Variable", system-ui, sans-serif;` prose 1.125rem/1.6 at 68ch, h1 clamp(2.2rem, 6vw, 4rem) in the serif at weight 500 with tight leading, figure titles in the sans at 1.15rem/600, hero number tiles in the sans (proportional figures).
  - `.fig { min-height: var(--fig-h); }` and `.fig .plot { height: var(--fig-h); }` with `@media (max-width: 640px) { .fig .plot { height: calc(var(--fig-h) * 0.85); } }`.
  - `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`; `@media print { … light tokens forced, nav and toggle hidden, .fig { break-inside: avoid } }`.
  - Inline `<script>` in `<head>` (before CSS) that reads localStorage and sets `data-theme` to avoid a flash.
- `.github/workflows/ci.yml`:
  ```yaml
  name: ci
  on: { push: { branches: [main] }, pull_request: {}, workflow_dispatch: {} }
  permissions: { contents: read, pages: write, id-token: write }
  concurrency: { group: pages, cancel-in-progress: false }
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: astral-sh/setup-uv@v5
          with: { python-version: "3.12" }
        - run: uv sync --frozen
        - run: uv run python -m pipeline
        - name: Committed JSON must match the pipeline output
          run: |
            for f in site/public/data/*.json; do
              git show HEAD:"$f" | grep -v '"generated_at"' > /tmp/committed.json
              grep -v '"generated_at"' "$f" > /tmp/fresh.json
              diff -u /tmp/committed.json /tmp/fresh.json || { echo "::error::$f is stale; run python -m pipeline and commit"; exit 1; }
            done
        - run: uv run pytest
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: npm, cache-dependency-path: site/package-lock.json }
        - run: npm ci
          working-directory: site
        - run: npm run build
          working-directory: site
        - uses: actions/upload-pages-artifact@v3
          with: { path: site/dist }
    deploy:
      if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
      needs: build
      runs-on: ubuntu-latest
      environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
      steps:
        - id: deployment
          uses: actions/deploy-pages@v4
  ```
  (Task 10 adds the notebook execution step.)
- `README.md`: title, one-paragraph description, the live URL, the CI badge `![ci](https://github.com/sahajm99/cardiolens/actions/workflows/ci.yml/badge.svg)`, "Run it yourself" (uv sync, uv run python -m pipeline, uv run pytest, cd site && npm ci && npm run dev), repo layout, data provenance pointer, licence.

- [ ] **Step 1:** Install fonts, write `vite.config.ts`, tokens and base CSS, `plotly.ts`, `data.ts`, `fmt.ts`, `theme.ts`, `lazy.ts`, `figure.ts`, `stats-fill.ts`, `charts/theme.ts`, `charts/age.ts`, `index.html`, `main.ts`. Delete the Vite demo files.
- [ ] **Step 2:** `cd site && npm run typecheck && npm run build`; confirm `dist/` contains `index.html`, a `plotly-*.js` chunk, `data/*.json`, and font files; note total gzip size of JS (Vite prints it) and record it in `docs/PROGRESS.md` later.
- [ ] **Step 3:** `npm run preview -- --base /cardiolens/` and open `http://localhost:4173/cardiolens/` with the gstack browse tool (`$B goto`, `$B screenshot`) in light and dark, desktop and 400px (`$B viewport 400 800`); confirm the age chart renders with error bars, the sex toggle works, and the details table lists 13 rows. Fix anything wrong.
- [ ] **Step 4:** Write `.github/workflows/ci.yml` and `README.md`. Commit `feat(site): skeleton, theme, age prevalence chart and Pages CI`. Push to `main`.
- [ ] **Step 5:** `gh run watch` the workflow; if it fails, read the log with `gh run view --log-failed`, fix, commit, push, repeat. When green, `curl -sI https://sahajm99.github.io/cardiolens/ | head -1` shows 200, and the browse tool screenshot of the live URL shows the chart. Record the run URL and screenshot path in `docs/PROGRESS.md`.

---

### Task 6: Charts 2 to 4 and the estimator panel (the "is it just age?" and "what survives" sections)

**Files:**
- Create: `site/src/charts/factors.ts`, `site/src/charts/factorByAge.ts`, `site/src/charts/forest.ts`, `site/src/charts/estimator.ts`
- Modify: `site/index.html` (sections `#age` gets the factors and factorByAge figures; `#survives` gets forest and the estimator panel), `site/src/main.ts` (register modules), `site/src/types.ts`.

**Interfaces:** consumes the chart module contract, `mountFigure`, `layoutTemplate`, `series`, `fmt`, and the JSON schemas `factor_prevalence.v1`, `factor_by_age.v1`, `odds_ratios.v1`, `estimator.v1`.

- **factors.ts** (chart 2): dot plot with CI. y = factor labels (sorted by ratio as delivered), two traces: unexposed (hollow marker, `marker.symbol: "circle-open"`, colour s1) and exposed (filled s1), `error_x` per point, x axis 0 to max(hi)+0.02 formatted `%`. Legend on (two series). Title: `` `${ratio(top.ratio)} the prevalence: ${top.label.toLowerCase()} shows the widest crude gap of any factor` `` where `top` is the first factor. Subtitle: `Crude (unadjusted) prevalence with 95% Wilson intervals; hollow = without the factor, filled = with it`. Table: factor, group, n, prevalence, CI, ratio. `hovertemplate` shows label, p, CI, n.
- **factorByAge.ts** (chart 3): a `<select>` (label "Factor") listing the six factors; two lines (exposed s1, unexposed s2 is wrong per dataviz emphasis rule: use exposed = s1 solid, unexposed = `muted` grey solid) with CI ribbons (`fill: "toself"`, `fillcolor` = series colour at 12% alpha via `hexToRgba`, `line.width: 0`, `hoverinfo: "skip"`, `showlegend: false`) drawn before the lines; x = age bands, y = p. Suppressed points are omitted from the line (null y). Title updates on change: `` `Within every age band, ${exposedLabel.toLowerCase()} adults report more heart disease` `` when exposed p > unexposed p in >= 10 of 13 bands, else `` `${exposedLabel} and ${unexposedLabel.toLowerCase()} adults look alike once age is held fixed` ``. Subtitle: `Prevalence by five-year age band, 95% Wilson intervals; grey points have n under 300`. `Plotly.react` on change; table shows the selected factor's rows.
- **forest.ts** (chart 4): two stacked subplots via `layout.grid: {rows: 2, columns: 1, roworder: "top to bottom"}` with `yaxis` (upstream, from `models.primary`) and `yaxis2` (downstream terms from `models.full`), row heights proportional to term counts (`layout.yaxis.domain`, `layout.yaxis2.domain`). x axis log (`xaxis.type: "log"`, ticks 0.5, 1, 2, 5, 10, 20, 40), a vertical line at 1 (`shapes` with `xref: "x"`, `yref: "paper"`), reference rows plotted as hollow markers at 1 with no error bar, non-reference as filled s1 with `error_x` (asymmetric, in OR units), unstable terms in `muted`. y labels use `term.label`. Two `annotations` as panel headings: "Adjusted for each other: plausibly upstream factors (primary model)" and "Markers that travel with heart disease: not causes (full model)". Title: `` `After adjusting for age and each other, smoking (${ratio(or_smoking)}), stroke (${ratio(or_stroke)}), diabetes (${ratio(or_diabetes)}) and kidney disease (${ratio(or_kidney)}) still stand out` ``. Subtitle: `` `Adjusted odds ratios with 95% intervals, logistic regression on ${int(n_obs)} adults; an odds ratio is not a risk ratio, and this survey cannot show cause` ``. Table: variable, level, OR, CI, marginal effect (percentage points), n. `--fig-h: 760px`.
- **estimator.ts** (panel 5, not a Plotly chart): a `<form>` with one `<select>` per `inputs` entry (labels from JSON, defaults from JSON), computing `logit = intercept + sum(coefficients[v][level])`, `p = 1/(1+exp(-logit))`. Output block: large number `pct(p)` in the sans, then the sentence "Adults with these answers reported heart disease at {p}. The survey average was {base_rate}; adults in the same age band, {age_rate}." A horizontal 3-mark scale (0 to max(0.3, p*1.2)) drawn with three `<span>` markers on a CSS track (no Plotly): this profile (s1), age band (s2 hollow), overall (grey). Under it, in `.fig-note`: "This is the pattern of association in one 2020 survey sample, not a medical risk score, and it holds alcohol use, asthma and skin cancer at 'No'. Nothing here is advice." The word "risk" appears only inside "not a medical risk score". Live region `aria-live="polite"` on the output.

- [ ] **Step 1:** Add the figure containers to `index.html` with `data-chart` ids `factors` (`--fig-h: 560px`), `factor-by-age` (`--fig-h: 460px`), `forest` (`--fig-h: 760px`), and a `<div class="panel" data-chart="estimator">`. Register the four modules in `main.ts`.
- [ ] **Step 2:** Implement the four modules. Add `hexToRgba(hex: string, alpha: number): string` to `charts/theme.ts`.
- [ ] **Step 3:** `npm run typecheck && npm run build`; preview; browse-tool screenshots of each figure in light and dark and at 400px; verify the forest's reference markers sit on the x=1 line, the picker re-renders the title, the estimator output changes when age changes and never shows NaN. Fix.
- [ ] **Step 4:** Commit `feat(site): crude factor gaps, factor-by-age, adjusted odds forest and estimator panel`. Push; confirm CI green and the live page shows the new sections.

---

### Task 7: Interaction charts 6 to 8

**Files:**
- Create: `site/src/charts/heatmap.ts`, `site/src/charts/sleepAge.ts`, `site/src/charts/bmiOutcomes.ts`
- Modify: `site/index.html` (`#interactions` section), `site/src/main.ts`.

- **heatmap.ts** (chart 6): `heatmap` trace, x = SleepBand, y = BMIClass, z = p (null for suppressed), `colorscale` from `--seq-1..--seq-5` (five stops, positions 0, .25, .5, .75, 1), `zmin: 0`, `zmax` fixed to the max p across ALL strata (so the legend never rescales), `texttemplate: "%{z:.1%}"`, `textfont.color` chosen per cell in code (ink on light cells, surface on dark cells; Plotly's `texttemplate` cannot vary colour per cell, so use two traces: one with `text` for light cells and one for dark cells with the other colour, or simpler: `textfont.color` = `--ink` and cap the colorscale's darkest stop at `--seq-4` in light mode; do the cap), `hoverongaps: false`, `xgap: 2, ygap: 2`, hover shows p, CI, n. A `<div class="seg" role="group">` of four buttons: All, 0 days, 1 to 13 days, 14 or more days (poor mental-health days). Suppressed cells rendered as empty with an annotation "n < 30". Title: `` `Short sleep and higher BMI stack: ${pct(worst.p)} of ${worstLabel} report heart disease, against ${pct(best.p)} of ${bestLabel}` `` computed from the "All" stratum's non-suppressed cells (worst = max p, best = min p, labels like "obese II+ adults sleeping under 6 hours"). Subtitle changes with stratum: `` `Prevalence by BMI class and sleep band, ${stratumLabel}; 95% intervals in the table` ``.
- **sleepAge.ts** (chart 7): grouped bars, x = SleepBand, three traces = AgeGroup3 (s1, s2, s3), `error_y` asymmetric, `barmode: "group"`, `bargap: 0.3`. Title: `` `Sleeping under six hours goes with more heart disease at every age, and the gap is widest after 65` `` if that holds (check: for each age group, p(Under 6h) > p(6-7h); widest absolute gap in 65 and older), else the neutral form `` `Sleep and heart disease, by age group` `` with a subtitle stating what the data show. Subtitle: `Prevalence by usual hours of sleep within three age groups, 95% Wilson intervals`.
- **bmiOutcomes.ts** (chart 8): two traces on one axis: heart disease (s1, filled) and stroke (s2, filled), x = BMIClass, y = p, `error_y`, `mode: "lines+markers"`, marker size 9 with a surface-colour ring (`marker.line: {color: --surface, width: 2}`). A `<select>` "Age group": All, 18-44, 45-64, 65 and older. Title: `` `Both heart disease and stroke rise with BMI class, from ${pct(hdNormal)} to ${pct(hdObese2)} for heart disease` `` (from the selected stratum). Subtitle: `` `Prevalence by WHO BMI class, ${stratum}; 95% Wilson intervals; underweight adults are few and their interval is wide` ``.

- [ ] **Step 1:** Containers (`heatmap` `--fig-h: 520px`, `sleep-age` 460px, `bmi-outcomes` 460px) and registration.
- [ ] **Step 2:** Implement. Add `seqColorscale(): [number, string][]` to `charts/theme.ts`.
- [ ] **Step 3:** Build, preview, screenshots light/dark/400px; verify the heatmap legend does not rescale when switching strata and that suppressed cells are visibly empty. Fix.
- [ ] **Step 4:** Commit `feat(site): BMI x sleep x mental health heatmap, sleep by age group, BMI outcomes`. Push; CI green.

---

### Task 8: Equity-gap charts 9 to 12

**Files:**
- Create: `site/src/charts/raceStd.ts`, `site/src/charts/raceStroke.ts`, `site/src/charts/raceHealth.ts`, `site/src/charts/raceLifestyle.ts`
- Modify: `site/index.html` (`#gaps`), `site/src/main.ts`.

- **raceStd.ts** (chart 9, dumbbell): y = race (order as delivered), three traces: connector (`mode: "lines"`, x = `[crude, std, null, ...]`, y = `[race, race, null, ...]`, colour `grid`, width 2, `hoverinfo: "skip"`, `showlegend: false`), crude markers (hollow s1, `error_x` from crude CI), standardised markers (filled s1, `error_x` from std CI). Legend: "Crude" and "Age-standardised". Title: `` `Age-standardising narrows the gap between groups: ${highest} moves from ${pct(crude)} to ${pct(std)}` `` for the race with the largest |crude - std|. Subtitle: `` `Standard population is this sample's own age mix; standardised intervals use the Fay-Feuer gamma method; small-n groups are flagged in the table` ``.
- **raceStroke.ts** (chart 10): grouped bars, x = race, two traces: no stroke (s1) and stroke (s2), `error_y`; wide intervals are the point, keep them; suppressed bars omitted with a table note. Title: `` `A prior stroke multiplies heart disease in every group: ${pct(minStroke)} to ${pct(maxStroke)} with a stroke, against ${pct(minNo)} to ${pct(maxNo)} without` ``.
- **raceHealth.ts** (chart 11): 100% stacked horizontal bars, y = race, five traces in GenHealth order using `--seq-5` (Excellent, darkest) to `--seq-1` (Poor, lightest) in light mode; in dark mode the same ramp reversed so Excellent stays the most saturated (use `seqColorscale()` order and pick five). `barmode: "stack"`, `x` = shares, `texttemplate` only on segments with share >= 0.08 (`text` array with empty strings elsewhere), 2px surface gap via `marker.line`. Title: `` `Self-rated health differs by group: ${pct0(fairPoorHighest)} of ${raceHighest} adults call their health fair or poor, against ${pct0(fairPoorLowest)} of ${raceLowest}` ``. Subtitle: `Share of adults in each self-rated health category, all respondents (not only those with heart disease)`.
- **raceLifestyle.ts** (chart 12): three subplots side by side (`layout.grid: {rows: 1, columns: 3}`), one metric each: mean BMI (kg/m²), mean sleep (hours), physical-activity rate (%), y = race shared order, x ranges independent, dot with `error_x`, colour s1, panel headings as annotations. At widths under 640px, switch to `rows: 3, columns: 1` and `--fig-h: 720px` (compute from `container.clientWidth` at render). Title: `` `Lifestyle measures vary far less between groups than heart disease does: mean BMI spans ${bmiMin} to ${bmiMax}` `` with one-decimal formatting.

- [ ] **Step 1:** Containers (`race-std` 420px, `race-stroke` 460px, `race-health` 420px, `race-lifestyle` 420px) and registration.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Build, preview, screenshots; check the dumbbell connector is drawn under the markers, stacked labels never clip, and the lifestyle panel stacks vertically at 400px. Fix.
- [ ] **Step 4:** Commit `feat(site): race prevalence crude vs standardised, stroke interaction, self-rated health and lifestyle panels`. Push; CI green.

---

### Task 9: Narrative, limits, polish, README

**Files:**
- Modify: `site/index.html` (all prose), `site/src/styles/*.css`, `README.md`, `docs/PROGRESS.md`.

**Copy plan (write it in the HTML with `<span data-stat="…">` for every number):**
- Hero h1: "1 in <span data-stat="one_in">12</span> US adults in this survey report heart disease. That average describes almost no one." Under it, the differentiation line: "No classifier, no accuracy score. This is estimation with stated uncertainty and stated limits, on <span data-stat="n_rows|int"></span> adults from the 2020 Behavioral Risk Factor Surveillance System." Three tiles: overall prevalence (with CI text), 18 to 24, 80 and older, plus a fourth small line "<span data-stat="ratio_oldest_youngest|ratio"></span> from youngest to oldest band".
- Read-this-first strip (three short items, each linking to `#limits`): self-reported answers; a third party's extract, <span data-stat="dropped_by_kaggle|int"> respondents removed; a cross-section, so no causal claims.
- Section `#age` heading "Is it just age?" with two paragraphs: the crude gaps, then the same gaps within age bands, referencing `ratio_smoking_crude`, `prev_inactive`, `prev_active`.
- Section `#survives` heading "What survives adjustment" with paragraphs on the two-model design (why general health and difficulty walking are in a separate panel), the sentence "Physical activity's crude gap (<span data-stat="ratio_activity_crude|ratio">) shrinks to an adjusted odds ratio of <span data-stat="or_activity_full|ratio"> once age and self-rated health are held fixed; smoking's does not (<span data-stat="or_smoking_primary|ratio">)." Then the estimator panel intro.
- Section `#interactions` heading "Where factors stack".
- Section `#gaps` heading "Gaps this file cannot explain" opening paragraph naming income, education, insurance and geography as absent, then the four charts.
- Section `#limits` heading "What this data cannot tell you": bullets for self-report; the Kaggle extract and the row reconciliation (<span data-stat="brfss_2020_respondents|int"> to <span data-stat="n_rows|int">); no survey weights, no clustering, so intervals are narrower than the truth; cross-sectional; <span data-stat="n_duplicate_rows|int"> exact duplicate rows kept and why; no State column, so no maps; the 8.6% positive rate and why it needs no correction (no classifier); BMI from self-reported height and weight.
- Footer: author, links to the repo and the Kaggle dataset, "Built with pandas, statsmodels, Vite and Plotly", licence.

- [ ] **Step 1:** Write the prose. Every number via `data-stat`. Run `grep -nE "[0-9]{2,}" site/index.html | grep -v "data-stat" | grep -v "viewBox" | grep -v "202[0-9]"` and make sure no data number is hand-typed (years, the 95% in "95% Wilson", and CSS values are fine).
- [ ] **Step 2:** Sticky nav: highlight the current section with an IntersectionObserver; horizontal scroll under 640px. Focus styles visible on every interactive element (2px `--accent` outline with offset). Skip link.
- [ ] **Step 3:** Print stylesheet check via the browse tool (`$B pdf` if available, else emulate media print) and `noscript` text check by loading with JS disabled if the tool supports it; otherwise verify the markup.
- [ ] **Step 4:** Update `README.md` with the story summary and the insights list; append `docs/PROGRESS.md`.
- [ ] **Step 5:** Commit `feat(site): narrative, limits section, nav and accessibility polish`. Push; CI green.

---

### Task 10: Notebook and CI notebook check

**Files:**
- Create: `notebooks/analysis.ipynb`
- Modify: `.github/workflows/ci.yml`, `README.md`.

- [ ] **Step 1:** Write the notebook with `nbformat` from a Python script (`uv run python notebooks/build_notebook.py` creates the `.ipynb`; commit both). Sections, each a markdown cell followed by code cells that import from `pipeline` (never re-implement): 1 Data and provenance (load, shape, duplicates, sha256); 2 The age gradient (table from `prevalence_table`, a matplotlib bar with Wilson error bars); 3 Crude factor gaps (table); 4 The same gaps within age bands (small multiples for smoking and inactivity); 5 Two logistic models (fit, term table, why GenHealth is separate, VIF, convergence); 6 Interactions (heatmap table); 7 Race, crude vs standardised, with the standard population printed; 8 Limits. Every code cell prints or plots something.
- [ ] **Step 2:** Execute in place: `uv run jupyter nbconvert --to notebook --execute --inplace notebooks/analysis.ipynb --ExecutePreprocessor.timeout=600`. Confirm outputs are present (`grep -c '"output_type"' notebooks/analysis.ipynb` > 20).
- [ ] **Step 3:** Add a CI step after pytest: `uv run jupyter nbconvert --to notebook --execute notebooks/analysis.ipynb --output /tmp/analysis.ipynb --ExecutePreprocessor.timeout=600`.
- [ ] **Step 4:** Commit `docs(notebook): executed long-form analysis notebook and CI execution check`. Push; CI green.

---

### Task 11: Portfolio entry

**Files (portfolio repo at `C:\Users\sahaj\OneDrive\Desktop\Experiments\projects\active\portfolio\portfolio-next`):**
- Modify: `src/types/index.ts` (add `"data-visualization"` to both unions), `src/components/ProjectGrid.tsx` (add `{ value: "data-visualization", label: "Data Visualization" }`), `src/data/projects.ts` (new entry after `groundscope`; set `hidden: true` on `heart-disease-pipeline`).
- Grep first: `grep -rn "data-engineering" src` and update every switch or map.
- The new entry: slug `cardiolens`, title "CardioLens — Heart-Disease Risk Factors, Honestly", tagline "An interactive analysis of 320K adults from CDC BRFSS 2020: crude gaps, age-adjusted odds, and what the data cannot say", description (three paragraphs: what it is; how it is built, pipeline to JSON to Plotly; what makes it honest), category `"data-visualization"`, tags `["Python", "pandas", "statsmodels", "TypeScript", "Plotly", "Vite", "GitHub Actions"]`, github `https://github.com/sahajm99/cardiolens`, liveUrl `https://sahajm99.github.io/cardiolens/`, status `"live"`, keyMetrics "319,795 adults · 12 charts · 2 logistic models · every JSON under 200 KB · loads under 3 s", architecture (one line: CSV → pandas/statsmodels pipeline → 16 JSON aggregates → Vite/TypeScript/Plotly story page → GitHub Pages via Actions with a staleness check), techDecisions (three: aggregates not raw rows; two models to avoid the Table 2 fallacy; committed JSON with a CI diff guard), aiContribution 60, whatIBuilt (the course analysis and question list; the story and honesty framing; review of every statistical decision; the deploy), whatAIHelped (pipeline and test code; chart modules and theme; CI workflow; copy drafting).
- Only stage the three files you changed (`git add src/types/index.ts src/components/ProjectGrid.tsx src/data/projects.ts`); the working tree has unrelated uncommitted changes that must not be committed.
- `npm run build` (or `npx tsc --noEmit`) in the portfolio to confirm the union change compiles. Commit `feat(projects): add CardioLens live data-visualization project`. Push `main`.
