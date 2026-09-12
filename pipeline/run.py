"""Pipeline entry point: loads the data once and runs every registered writer."""

from __future__ import annotations

from pipeline.load import load_data
from pipeline.models import write_models
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
    write_models,
]


def run() -> list:
    df = load_data()
    paths = []
    for writer in WRITERS:
        # A writer returns either a single Path or a list of Paths.
        written = writer(df)
        for path in written if isinstance(written, list) else [written]:
            print(f"{path.name}  {path.stat().st_size}")
            paths.append(path)
    return paths
