"""Prevalence, distribution and summary aggregate writers.

Small generic core (`_row`, `prevalence_table`, `_prevalence_with_all_level`)
plus thin writer functions, one per output JSON file under `site/public/data/`.
"""

from __future__ import annotations

import math

from pipeline.constants import (
    AGE_BANDS,
    AGE_GROUPS3,
    FACTORS,
    GENHEALTH,
    RACES,
    SMALL_N,
    SUPPRESS_N,
)
from pipeline.io import now_iso, write_json
from pipeline.stats import Z95, mean_ci, round6, wilson

# ---------------------------------------------------------------------------
# Generic core
# ---------------------------------------------------------------------------


def _row(key: list[str], n: int, events: int) -> dict:
    if n < SUPPRESS_N:
        return {"key": key, "n": int(n), "events": int(events), "p": None, "lo": None, "hi": None, "small_n": True, "suppressed": True}
    lo, hi = wilson(events, n)
    return {"key": key, "n": int(n), "events": int(events), "p": round6(events / n), "lo": round6(lo), "hi": round6(hi), "small_n": n < SMALL_N, "suppressed": False}


def prevalence_table(df, group_by, outcome_col="hd", file_id="", outcome_name="HeartDisease") -> dict:
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
    return {
        "schema": "prevalence.v1",
        "id": file_id,
        "generated_at": now_iso(),
        "outcome": outcome_name,
        "group_by": list(group_by),
        "levels": levels,
        "ci": {"method": "wilson", "level": 0.95},
        "n_total": int(len(df)),
        "events_total": int(df[outcome_col].sum()),
        "rows": rows,
    }


def _prevalence_with_all_level(
    df,
    real_col: str,
    other_cols: list[str],
    all_levels: list[str],
    output_col_name: str | None = None,
    outcome_col: str = "hd",
    outcome_name: str = "HeartDisease",
    file_id: str = "",
) -> dict:
    """Prepend a synthetic "All" level (computed over the whole df) to `real_col`.

    Builds the table on `other_cols` alone (the "All" slice), prefixes each key
    with "All", then builds the full table on `[real_col, *other_cols]` and
    concatenates. `output_col_name` lets the emitted level/group_by key differ
    from the underlying dataframe column (e.g. "AgeGroupAll" over "AgeGroup3").
    """
    output_col_name = output_col_name or real_col
    all_table = prevalence_table(df, other_cols, outcome_col=outcome_col, outcome_name=outcome_name, file_id=file_id)
    all_rows = [{**r, "key": ["All", *r["key"]]} for r in all_table["rows"]]
    full_table = prevalence_table(df, [real_col, *other_cols], outcome_col=outcome_col, outcome_name=outcome_name, file_id=file_id)
    rows = all_rows + full_table["rows"]
    levels = {output_col_name: list(all_levels)}
    for c, lv in full_table["levels"].items():
        if c != real_col:
            levels[c] = lv
    return {
        "schema": "prevalence.v1",
        "id": file_id,
        "generated_at": now_iso(),
        "outcome": outcome_name,
        "group_by": [output_col_name, *other_cols],
        "levels": levels,
        "ci": {"method": "wilson", "level": 0.95},
        "n_total": int(len(df)),
        "events_total": int(df[outcome_col].sum()),
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# Factor helpers
# ---------------------------------------------------------------------------


def _exposure_group(label: str, n: int, events: int) -> dict:
    n, events = int(n), int(events)
    if n < SUPPRESS_N:
        return {"label": label, "n": n, "events": events, "p": None, "lo": None, "hi": None}
    lo, hi = wilson(events, n)
    return {"label": label, "n": n, "events": events, "p": round6(events / n), "lo": round6(lo), "hi": round6(hi)}


def _factor_entry(df, factor: dict) -> dict:
    column = factor["column"]
    exposed_mask = df[column].isin(factor["exposed"])
    unexposed_mask = df[column].isin(factor["unexposed"])
    n1, e1 = int(exposed_mask.sum()), int(df.loc[exposed_mask, "hd"].sum())
    n2, e2 = int(unexposed_mask.sum()), int(df.loc[unexposed_mask, "hd"].sum())
    exposed = _exposure_group(factor["exposed_label"], n1, e1)
    unexposed = _exposure_group(factor["unexposed_label"], n2, e2)
    p1, p2 = exposed["p"], unexposed["p"]
    if p1 is not None and p2 is not None and p2 > 0 and e1 > 0 and e2 > 0:
        ratio = p1 / p2
        se = math.sqrt((1 - p1) / e1 + (1 - p2) / e2)
        ratio_lo = ratio * math.exp(-Z95 * se)
        ratio_hi = ratio * math.exp(Z95 * se)
        ratio, ratio_lo, ratio_hi = round6(ratio), round6(ratio_lo), round6(ratio_hi)
    else:
        ratio = ratio_lo = ratio_hi = None
    return {
        "id": factor["id"],
        "label": factor["label"],
        "column": column,
        "exposed": exposed,
        "unexposed": unexposed,
        "ratio": ratio,
        "ratio_lo": ratio_lo,
        "ratio_hi": ratio_hi,
    }


def _factor_rows_by_age(df, factor: dict) -> list[dict]:
    column = factor["column"]
    rows = []
    for band in AGE_BANDS:
        age_mask = df["AgeCategory"] == band
        exposed_mask = age_mask & df[column].isin(factor["exposed"])
        unexposed_mask = age_mask & df[column].isin(factor["unexposed"])
        n1, e1 = int(exposed_mask.sum()), int(df.loc[exposed_mask, "hd"].sum())
        n2, e2 = int(unexposed_mask.sum()), int(df.loc[unexposed_mask, "hd"].sum())
        exposed_row = _row([], n1, e1)
        exposed_row.pop("key")
        unexposed_row = _row([], n2, e2)
        unexposed_row.pop("key")
        rows.append({"age": band, "exposed": exposed_row, "unexposed": unexposed_row})
    return rows


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------


def write_prevalence_overall(df):
    t = prevalence_table(df, [], file_id="prevalence_overall")
    return write_json("prevalence_overall.json", t)


def write_prevalence_by_age(df):
    t = prevalence_table(df, ["AgeCategory"], file_id="prevalence_by_age")
    return write_json("prevalence_by_age.json", t)


def write_prevalence_by_age_sex(df):
    t = prevalence_table(df, ["AgeCategory", "Sex"], file_id="prevalence_by_age_sex")
    return write_json("prevalence_by_age_sex.json", t)


def write_prevalence_by_factor(df):
    entries = [_factor_entry(df, f) for f in FACTORS]
    entries.sort(key=lambda e: e["ratio"] if e["ratio"] is not None else float("-inf"), reverse=True)
    obj = {
        "schema": "factor_prevalence.v1",
        "id": "prevalence_by_factor",
        "generated_at": now_iso(),
        "n_total": int(len(df)),
        "events_total": int(df["hd"].sum()),
        "factors": entries,
    }
    return write_json("prevalence_by_factor.json", obj)


_FACTOR_BY_AGE_IDS = ["smoking", "inactivity", "obesity", "short_sleep", "sex", "diabetes"]


def write_factor_by_age(df):
    factors_by_id = {f["id"]: f for f in FACTORS}
    factors = []
    for fid in _FACTOR_BY_AGE_IDS:
        f = factors_by_id[fid]
        factors.append({
            "id": f["id"],
            "label": f["label"],
            "exposed_label": f["exposed_label"],
            "unexposed_label": f["unexposed_label"],
            "rows": _factor_rows_by_age(df, f),
        })
    obj = {
        "schema": "factor_by_age.v1",
        "id": "factor_by_age",
        "generated_at": now_iso(),
        "age_bands": list(AGE_BANDS),
        "factors": factors,
    }
    return write_json("factor_by_age.json", obj)


def write_bmi_sleep_heatmap(df):
    from pipeline.constants import BMI_CLASSES, MENTAL_BANDS, SLEEP_BANDS  # noqa: F401 (documents levels)

    t = _prevalence_with_all_level(
        df,
        real_col="MentalBand",
        other_cols=["BMIClass", "SleepBand"],
        all_levels=["All", *MENTAL_BANDS],
        file_id="bmi_sleep_heatmap",
    )
    return write_json("bmi_sleep_heatmap.json", t)


def write_sleep_by_agegroup(df):
    t = prevalence_table(df, ["AgeGroup3", "SleepBand"], file_id="sleep_by_agegroup")
    return write_json("sleep_by_agegroup.json", t)


def write_bmi_outcomes(df):
    common = dict(real_col="AgeGroup3", other_cols=["BMIClass"], all_levels=["All", *AGE_GROUPS3], output_col_name="AgeGroupAll")
    hd_table = _prevalence_with_all_level(df, outcome_col="hd", outcome_name="HeartDisease", file_id="bmi_outcomes", **common)
    stroke_table = _prevalence_with_all_level(df, outcome_col="stroke", outcome_name="Stroke", file_id="bmi_outcomes", **common)
    obj = {
        "schema": "bmi_outcomes.v1",
        "id": "bmi_outcomes",
        "generated_at": now_iso(),
        "tables": {"hd": hd_table, "stroke": stroke_table},
    }
    return write_json("bmi_outcomes.json", obj)


def write_race_stroke_hd(df):
    t = prevalence_table(df, ["Stroke", "Race"], file_id="race_stroke_hd")
    return write_json("race_stroke_hd.json", t)


def write_race_genhealth(df):
    g = df.groupby(["Race", "GenHealth"], observed=False).size()
    rows = []
    for race in RACES:
        sub = g.loc[race]
        n = int(sub.sum())
        suppressed = n < SUPPRESS_N
        if suppressed:
            shares = None
        else:
            shares = {str(level): round6(int(sub[level]) / n) for level in GENHEALTH[:-1]}
            last = str(GENHEALTH[-1])
            shares[last] = round6(1 - sum(shares.values()))
        rows.append({"key": [race], "n": n, "shares": shares, "suppressed": suppressed, "small_n": n < SMALL_N})
    obj = {
        "schema": "distribution.v1",
        "id": "race_genhealth",
        "generated_at": now_iso(),
        "group_by": ["Race"],
        "category_col": "GenHealth",
        "categories": list(GENHEALTH),
        "n_total": int(len(df)),
        "rows": rows,
    }
    return write_json("race_genhealth.json", obj)


def write_race_lifestyle(df):
    rows = []
    for race in RACES:
        sub = df[df["Race"] == race]
        n = len(sub)
        bmi_mean, bmi_lo, bmi_hi = mean_ci(sub["BMI"])
        sleep_mean, sleep_lo, sleep_hi = mean_ci(sub["SleepTime"])
        events = int((sub["PhysicalActivity"] == "Yes").sum())
        suppressed = n < SUPPRESS_N
        if suppressed:
            activity_rate = activity_lo = activity_hi = None
        else:
            activity_rate = round6(events / n)
            a_lo, a_hi = wilson(events, n)
            activity_lo, activity_hi = round6(a_lo), round6(a_hi)
        rows.append({
            "key": [race],
            "n": int(n),
            "bmi_mean": round6(bmi_mean),
            "bmi_lo": round6(bmi_lo),
            "bmi_hi": round6(bmi_hi),
            "sleep_mean": round6(sleep_mean),
            "sleep_lo": round6(sleep_lo),
            "sleep_hi": round6(sleep_hi),
            "activity_rate": activity_rate,
            "activity_lo": activity_lo,
            "activity_hi": activity_hi,
            "small_n": n < SMALL_N,
            "suppressed": suppressed,
        })
    obj = {
        "schema": "summary.v1",
        "id": "race_lifestyle",
        "generated_at": now_iso(),
        "group_by": ["Race"],
        "metrics": ["bmi_mean", "sleep_mean", "activity_rate"],
        "n_total": int(len(df)),
        "rows": rows,
    }
    return write_json("race_lifestyle.json", obj)
