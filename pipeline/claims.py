"""`claims.json` and `meta.json`: the site's prose numbers and the run provenance.

Every numeral the site prints in a heading or a sentence is read from
`claims.json` rather than typed into the HTML, so prose can never drift from the
data. The claims are *derived from the already-written aggregates*, not
recomputed here, so a claim and the chart beside it cannot disagree.

`build_claims` is pure -- it takes the loaded frame and the parsed output JSON
objects. `write_claims_and_meta` is the writer registered last in `pipeline.run`,
because it reads the files every other writer has just produced.
"""

from __future__ import annotations

import hashlib
import json

import pandas as pd

from pipeline.constants import OUT_DIR, RAW_PATH
from pipeline.io import now_iso, write_json
from pipeline.stats import round6

# Documented in data/raw/SOURCE.md: the BRFSS 2020 annual survey had 401,958
# respondents before the Kaggle author dropped rows with missing values.
BRFSS_2020_RESPONDENTS = 401958

SHA_CHUNK_BYTES = 1024 * 1024


# ---------------------------------------------------------------------------
# Lookups into the already-built outputs
# ---------------------------------------------------------------------------


def _age_row(outputs: dict, band: str) -> dict:
    for row in outputs["prevalence_by_age.json"]["rows"]:
        if row["key"][0] == band:
            return row
    raise KeyError(f"prevalence_by_age.json has no row for age band {band!r}")


def _factor(outputs: dict, factor_id: str) -> dict:
    for factor in outputs["prevalence_by_factor.json"]["factors"]:
        if factor["id"] == factor_id:
            return factor
    raise KeyError(f"prevalence_by_factor.json has no factor {factor_id!r}")


def _or(outputs: dict, model: str, variable: str, level: str) -> float:
    for term in outputs["odds_ratios.json"]["models"][model]["terms"]:
        if term["variable"] == variable and term["level"] == level:
            return float(term["or"])
    raise KeyError(f"odds_ratios.json {model} model has no term {variable}={level!r}")


def _extreme_race(rows: list[dict], field: str, highest: bool) -> dict:
    return (max if highest else min)(rows, key=lambda r: r[field])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_claims(df, outputs: dict[str, dict]) -> dict:
    """Assemble the flat claims object from `df` and the parsed output JSONs."""
    overall = outputs["prevalence_overall.json"]["rows"][0]
    prev_overall = overall["p"]
    n_rows = int(outputs["prevalence_overall.json"]["n_total"])

    youngest, oldest = _age_row(outputs, "18-24"), _age_row(outputs, "80 or older")
    smoking, inactivity = _factor(outputs, "smoking"), _factor(outputs, "inactivity")
    sex, stroke = _factor(outputs, "sex"), _factor(outputs, "stroke")

    race_rows = outputs["race_prevalence.json"]["rows"]
    crude_high = _extreme_race(race_rows, "crude", highest=True)
    crude_low = _extreme_race(race_rows, "crude", highest=False)

    n_duplicate_rows = int(df.duplicated().sum())

    return {
        "schema": "claims.v1",
        "id": "claims",
        "generated_at": now_iso(),
        "n_rows": n_rows,
        "n_events": int(outputs["prevalence_overall.json"]["events_total"]),
        "prev_overall": prev_overall,
        "prev_overall_lo": overall["lo"],
        "prev_overall_hi": overall["hi"],
        "one_in": int(round(1 / prev_overall)),
        "prev_youngest": youngest["p"],
        "prev_oldest": oldest["p"],
        "ratio_oldest_youngest": round6(oldest["p"] / youngest["p"]),
        "prev_smokers": smoking["exposed"]["p"],
        "prev_nonsmokers": smoking["unexposed"]["p"],
        "ratio_smoking_crude": smoking["ratio"],
        "or_smoking_primary": _or(outputs, "primary", "Smoking", "Yes"),
        "or_smoking_full": _or(outputs, "full", "Smoking", "Yes"),
        "prev_inactive": inactivity["exposed"]["p"],
        "prev_active": inactivity["unexposed"]["p"],
        "ratio_activity_crude": inactivity["ratio"],
        # The model term is PhysicalActivity=Yes (reference No); invert it so the
        # adjusted number points the same way as ratio_activity_crude, which is
        # inactive over active.
        "or_activity_full": round6(1 / _or(outputs, "full", "PhysicalActivity", "Yes")),
        "or_stroke_primary": _or(outputs, "primary", "Stroke", "Yes"),
        "or_diabetes_primary": _or(outputs, "primary", "Diabetic", "Yes"),
        "or_kidney_primary": _or(outputs, "primary", "KidneyDisease", "Yes"),
        "or_male_primary": _or(outputs, "primary", "Sex", "Male"),
        "or_age80_primary": _or(outputs, "primary", "AgeCategory", "80 or older"),
        "or_obese2_primary": _or(outputs, "primary", "BMIClass", "Obese II+"),
        "prev_male": sex["exposed"]["p"],
        "prev_female": sex["unexposed"]["p"],
        "prev_race_highest": crude_high["crude"],
        "race_highest": crude_high["key"][0],
        "prev_race_lowest": crude_low["crude"],
        "race_lowest": crude_low["key"][0],
        "std_race_highest": _extreme_race(race_rows, "std", highest=True)["std"],
        "std_race_lowest": _extreme_race(race_rows, "std", highest=False)["std"],
        "ratio_stroke_crude": stroke["ratio"],
        "n_duplicate_rows": n_duplicate_rows,
        "pct_duplicate_rows": round6(n_duplicate_rows / n_rows),
        "brfss_2020_respondents": BRFSS_2020_RESPONDENTS,
        "dropped_by_kaggle": BRFSS_2020_RESPONDENTS - n_rows,
    }


def sha256_of(path) -> str:
    """Streaming sha256 so the 25 MB raw CSV is never held in memory twice."""
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(SHA_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_meta(df, files: list[str]) -> dict:
    return {
        "schema": "meta.v1",
        "id": "meta",
        "generated_at": now_iso(),
        "source_file": "data/raw/heart_2020_cleaned.csv",
        "sha256": sha256_of(RAW_PATH),
        "n_rows": int(len(df)),
        "n_columns": int(len(read_raw_columns())),
        "n_duplicate_rows": int(df.duplicated().sum()),
        "n_events": int(df["hd"].sum()),
        "files": list(files),
    }


def read_raw_columns() -> list[str]:
    """Header of the raw CSV, so `n_columns` counts source columns, not derived ones."""
    return list(pd.read_csv(RAW_PATH, nrows=0).columns)


def read_outputs() -> dict[str, dict]:
    return {p.name: json.loads(p.read_text(encoding="utf-8")) for p in OUT_DIR.glob("*.json")}


def write_claims_and_meta(df) -> list:
    """Write `claims.json` then `meta.json`; must run after every other writer."""
    claims_path = write_json("claims.json", build_claims(df, read_outputs()))
    files = sorted({p.name for p in OUT_DIR.glob("*.json")} | {"meta.json"})
    meta_path = write_json("meta.json", build_meta(df, files))
    return [claims_path, meta_path]
