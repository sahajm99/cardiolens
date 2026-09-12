"""Age-standardised heart disease prevalence by race.

Crude prevalence by race confounds race with age: the White subsample is much
older than the Hispanic one, so a crude gap is partly an age gap. Direct
standardisation reweights each race's age-specific rates to one common age
distribution -- the whole sample's -- so the races are compared as if they
shared an age structure.

`race_prevalence` is pure; `write_race_prevalence` is the thin writer registered
in `pipeline.run`.
"""

from __future__ import annotations

import numpy as np

from pipeline.constants import AGE_BANDS, RACES, SUPPRESS_N
from pipeline.io import now_iso, write_json
from pipeline.stats import fay_feuer_ci, round6, wilson


def standard_population(df) -> np.ndarray:
    """Weights `w_i = n_i / N` from the whole sample's AgeCategory distribution.

    Returned in `AGE_BANDS` order and deliberately left unrounded: the weights
    must sum to 1 to floating-point tolerance, which per-band rounding breaks.
    """
    counts = df.groupby("AgeCategory", observed=False).size().reindex(AGE_BANDS)
    return counts.to_numpy(dtype=float) / float(len(df))


def race_prevalence(df) -> dict:
    """Crude (Wilson) and age-standardised (Fay-Feuer gamma) prevalence per race."""
    weights = standard_population(df)
    grouped = df.groupby(["Race", "AgeCategory"], observed=False)["hd"].agg(["size", "sum"])
    rows = []
    for race in RACES:
        by_band = grouped.loc[race].reindex(AGE_BANDS)
        n_by_band = by_band["size"].to_numpy(dtype=float)
        events_by_band = by_band["sum"].to_numpy(dtype=float)
        n, events = int(n_by_band.sum()), int(events_by_band.sum())
        crude_lo, crude_hi = wilson(events, n)
        std, std_lo, std_hi = fay_feuer_ci(events_by_band, n_by_band, weights)
        min_band_n = int(n_by_band.min())
        rows.append({
            "key": [race],
            "n": n,
            "events": events,
            "crude": round6(events / n),
            "crude_lo": round6(crude_lo),
            "crude_hi": round6(crude_hi),
            "std": round6(std),
            "std_lo": round6(std_lo),
            "std_hi": round6(std_hi),
            "min_band_n": min_band_n,
            "small_n": min_band_n < SUPPRESS_N,
        })
    return {
        "schema": "race_prevalence.v1",
        "id": "race_prevalence",
        "generated_at": now_iso(),
        "ci": {"crude": "wilson", "standardised": "fay-feuer gamma", "level": 0.95},
        "standard_population": {band: float(w) for band, w in zip(AGE_BANDS, weights)},
        "n_total": int(len(df)),
        "events_total": int(df["hd"].sum()),
        "rows": rows,
    }


def write_race_prevalence(df):
    return write_json("race_prevalence.json", race_prevalence(df))
