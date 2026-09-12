"""Adjusted logistic models: odds ratios, marginal effects and the browser estimator table.

Two nested models are fitted on the same rows:

* **primary** - upstream/structural covariates only (demographics, body mass,
  behaviours and diagnosed conditions). This is the model the site's estimator
  evaluates in the browser.
* **full** - the primary covariates plus three *downstream* covariates
  (physical activity, difficulty walking, self-rated general health) that sit on
  the causal path between the upstream factors and heart disease. Their terms are
  tagged ``group: "downstream"`` so the site can show how adjusting for them
  attenuates the upstream odds ratios.

`fit_models` is pure: it fits, assembles and returns the two JSON objects.
`write_models` is the thin writer registered in `pipeline.run`.
"""

from __future__ import annotations

import math
import re

import numpy as np
import statsmodels.formula.api as smf
from statsmodels.stats.outliers_influence import variance_inflation_factor

from pipeline.constants import AGE_BANDS, BMI_CLASSES, GENHEALTH, REFERENCE
from pipeline.io import now_iso, write_json
from pipeline.stats import round6

PRIMARY_COVS = [
    "AgeCategory",
    "Sex",
    "BMIClass",
    "Smoking",
    "AlcoholDrinking",
    "Diabetic",
    "Stroke",
    "KidneyDisease",
    "Asthma",
    "SkinCancer",
]

DOWNSTREAM_COVS = ["PhysicalActivity", "DiffWalking", "GenHealth"]

FULL_COVS = PRIMARY_COVS + DOWNSTREAM_COVS

MODEL_LABELS = {
    "primary": "Primary model",
    "full": "Full model (adds physical activity, difficulty walking, general health)",
}

# Human phrasing for each (variable, level). Levels without an entry fall back
# to f"{variable}: {level}".
LABELS: dict[str, dict[str, str]] = {
    "AgeCategory": {band: f"Age {band}" for band in AGE_BANDS},
    "Sex": {"Female": "Female", "Male": "Male"},
    "BMIClass": {
        "Underweight": "Underweight (BMI under 18.5)",
        "Normal": "Normal weight (BMI 18.5-24.9)",
        "Overweight": "Overweight (BMI 25-29.9)",
        "Obese I": "Obese class I (BMI 30-34.9)",
        "Obese II+": "Obese class II or III (BMI 35 and over)",
    },
    "Smoking": {"No": "Non-smoker", "Yes": "Smoker (100+ cigarettes ever)"},
    "AlcoholDrinking": {"No": "Not a heavy drinker", "Yes": "Heavy drinker"},
    "Diabetic": {
        "No": "No diabetes",
        "No, borderline diabetes": "Borderline diabetes",
        "Yes": "Diabetes",
        "Yes (during pregnancy)": "Gestational diabetes only",
    },
    "Stroke": {"No": "No history of stroke", "Yes": "History of stroke"},
    "KidneyDisease": {"No": "No kidney disease", "Yes": "Kidney disease"},
    "Asthma": {"No": "No asthma", "Yes": "Asthma"},
    "SkinCancer": {"No": "No skin cancer", "Yes": "Skin cancer"},
    "PhysicalActivity": {
        "No": "No physical activity in past 30 days",
        "Yes": "Physically active in past 30 days",
    },
    "DiffWalking": {"No": "No difficulty walking", "Yes": "Serious difficulty walking"},
    "GenHealth": {g: f"Self-rated health: {g.lower()}" for g in GENHEALTH},
}

# The estimator exposes a deliberately short form; Diabetic drops its rare
# gestational level (the coefficient is still published for completeness).
ESTIMATOR_INPUTS = [
    {"variable": "AgeCategory", "label": "Age band", "levels": list(AGE_BANDS), "default": "45-49"},
    {"variable": "Sex", "label": "Sex", "levels": ["Female", "Male"], "default": "Female"},
    {"variable": "BMIClass", "label": "BMI class", "levels": list(BMI_CLASSES), "default": "Normal"},
    {"variable": "Smoking", "label": "Smoked 100+ cigarettes ever", "levels": ["No", "Yes"], "default": "No"},
    {"variable": "Diabetic", "label": "Diabetes", "levels": ["No", "No, borderline diabetes", "Yes"], "default": "No"},
    {"variable": "Stroke", "label": "Ever had a stroke", "levels": ["No", "Yes"], "default": "No"},
    {"variable": "KidneyDisease", "label": "Kidney disease", "levels": ["No", "Yes"], "default": "No"},
]

HELD_AT_REFERENCE = ["AlcoholDrinking", "Asthma", "SkinCancer"]

TERM_RE = re.compile(r"^C\((\w+), Treatment\('([^']*)'\)\)\[T\.(.+)\]$")

UNSTABLE_MIN_CELL = 10

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _round4(x: float) -> float:
    return float(round(float(x), 4))


def _sig3(p: float) -> float:
    """Round a p-value to 3 significant digits; underflow to exactly 0.0."""
    p = float(p)
    if not math.isfinite(p):
        raise ValueError(f"non-finite p-value: {p}")
    if p < 1e-300:
        return 0.0
    return float(f"{p:.3g}")


def formula_for(covs: list[str]) -> str:
    return "hd ~ " + " + ".join(f"C({c}, Treatment('{REFERENCE[c]}'))" for c in covs)


def _fit(df, covs: list[str]):
    """Fit the logit for `covs` and fail loudly if the optimiser did not converge."""
    res = smf.logit(formula_for(covs), df).fit(disp=0, maxiter=200)
    if not res.mle_retvals["converged"]:
        raise RuntimeError(f"logit over {covs} did not converge")
    return res


def _vif(res) -> float:
    """Largest variance inflation factor over the design matrix, intercept excluded."""
    exog = np.asarray(res.model.exog, dtype=float)
    return max(variance_inflation_factor(exog, i) for i in range(1, exog.shape[1]))


def _unstable(n_total: int, events_total: int, n_level: int, events_level: int) -> bool:
    """True when any cell of the level-vs-outcome 2x2 table is thinner than 10."""
    cells = (
        events_level,
        n_level - events_level,
        events_total - events_level,
        (n_total - n_level) - (events_total - events_level),
    )
    return min(cells) < UNSTABLE_MIN_CELL


def _counts(df, variable: str, level: str) -> tuple[int, int]:
    mask = df[variable] == level
    return int(mask.sum()), int(df.loc[mask, "hd"].sum())


def _terms(res, df, covs: list[str], group_of) -> list[dict]:
    """Build the term rows: one synthesised reference row per covariate, then its levels.

    Non-reference rows are emitted in design-matrix order, which patsy derives
    from each column's categorical order, so the site can render them as-is.
    """
    n_total = len(df)
    events_total = int(df["hd"].sum())
    conf = np.exp(res.conf_int())
    ors = np.exp(res.params)
    ame = res.get_margeff(at="overall", method="dydx").summary_frame()["dy/dx"]

    parsed: dict[str, list[tuple[str, str]]] = {c: [] for c in covs}
    for name in res.params.index:
        if name == "Intercept":
            continue
        m = TERM_RE.match(name)
        if m is None:
            raise RuntimeError(f"unparseable statsmodels term name: {name!r}")
        variable, _ref, level = m.groups()
        parsed[variable].append((level, name))

    terms: list[dict] = []
    for cov in covs:
        reference = REFERENCE[cov]
        group = group_of(cov)
        n_ref, ev_ref = _counts(df, cov, reference)
        terms.append({
            "variable": cov,
            "level": reference,
            "reference": reference,
            "label": LABELS.get(cov, {}).get(reference, f"{cov}: {reference}"),
            "group": group,
            "or": 1.0,
            "lo": None,
            "hi": None,
            "coef": 0.0,
            "se": None,
            "p_value": None,
            "ame": None,
            "n_level": n_ref,
            "events_level": ev_ref,
            "is_reference": True,
            "unstable": _unstable(n_total, events_total, n_ref, ev_ref),
        })
        for level, name in parsed[cov]:
            n_level, events_level = _counts(df, cov, level)
            terms.append({
                "variable": cov,
                "level": level,
                "reference": reference,
                "label": LABELS.get(cov, {}).get(level, f"{cov}: {level}"),
                "group": group,
                "or": _round4(ors[name]),
                "lo": _round4(conf.loc[name, 0]),
                "hi": _round4(conf.loc[name, 1]),
                "coef": _round4(res.params[name]),
                "se": _round4(res.bse[name]),
                "p_value": _sig3(res.pvalues[name]),
                "ame": _round4(ame[name]),
                "n_level": n_level,
                "events_level": events_level,
                "is_reference": False,
                "unstable": _unstable(n_total, events_total, n_level, events_level),
            })
    return terms


def _model_obj(res, df, covs: list[str], name: str) -> dict:
    group_of = (lambda c: "downstream" if c in DOWNSTREAM_COVS else "upstream")
    return {
        "label": MODEL_LABELS[name],
        "covariates": list(covs),
        "n_obs": int(res.nobs),
        "n_events": int(df["hd"].sum()),
        "converged": bool(res.mle_retvals["converged"]),
        "pseudo_r2_mcfadden": _round4(res.prsquared),
        "max_vif": float(round(_vif(res), 2)),
        "df_model": int(res.df_model),
        "terms": _terms(res, df, covs, group_of),
        "intercept": _round4(res.params["Intercept"]),
    }


def _estimator_obj(primary: dict, df) -> dict:
    """Coefficient table the browser plugs into 1 / (1 + exp(-(b0 + sum b))) ."""
    coefficients: dict[str, dict[str, float]] = {c: {} for c in PRIMARY_COVS}
    for t in primary["terms"]:
        coefficients[t["variable"]][t["level"]] = t["coef"]
    age_rates = df.groupby("AgeCategory", observed=False)["hd"].mean()
    return {
        "schema": "estimator.v1",
        "id": "estimator",
        "generated_at": now_iso(),
        "model": "primary",
        "intercept": primary["intercept"],
        "base_rate": round6(df["hd"].mean()),
        "inputs": [{**i, "levels": list(i["levels"])} for i in ESTIMATOR_INPUTS],
        "held_at_reference": list(HELD_AT_REFERENCE),
        "coefficients": coefficients,
        "age_band_rates": {str(band): round6(rate) for band, rate in age_rates.items()},
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def fit_models(df) -> tuple[dict, dict]:
    """Fit both logits and return `(odds_ratios.v1, estimator.v1)` objects."""
    primary = _model_obj(_fit(df, PRIMARY_COVS), df, PRIMARY_COVS, "primary")
    full = _model_obj(_fit(df, FULL_COVS), df, FULL_COVS, "full")
    odds_ratios = {
        "schema": "odds_ratios.v1",
        "id": "odds_ratios",
        "generated_at": now_iso(),
        "models": {"primary": primary, "full": full},
    }
    return odds_ratios, _estimator_obj(primary, df)


def write_models(df) -> list:
    odds_ratios, estimator = fit_models(df)
    return [
        write_json("odds_ratios.json", odds_ratios),
        write_json("estimator.json", estimator),
    ]
