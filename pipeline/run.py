"""Pipeline entry point: loads the data once and runs every registered writer."""

from __future__ import annotations

from pipeline.load import load_data
from pipeline.prevalence import (
    write_bmi_outcomes,
    write_bmi_sleep_heatmap,
    write_factor_by_age,
    write_prevalence_by_age,
    write_prevalence_by_age_sex,
    write_prevalence_by_factor,
    write_prevalence_overall,
    write_race_genhealth,
    write_race_lifestyle,
    write_race_stroke_hd,
    write_sleep_by_agegroup,
)

WRITERS = [
    write_prevalence_overall,
    write_prevalence_by_age,
    write_prevalence_by_age_sex,
    write_prevalence_by_factor,
    write_factor_by_age,
    write_bmi_sleep_heatmap,
    write_sleep_by_agegroup,
    write_bmi_outcomes,
    write_race_stroke_hd,
    write_race_genhealth,
    write_race_lifestyle,
]


def run() -> list:
    df = load_data()
    paths = []
    for writer in WRITERS:
        path = writer(df)
        print(f"{path.name}  {path.stat().st_size}")
        paths.append(path)
    return paths
