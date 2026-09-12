"""Pipeline entry point: loads the data once and runs every registered writer.

The run is idempotent: stale `*.json` are deleted from `OUT_DIR` first, so a file
that a writer stops producing cannot linger and be served by the site. Writers
run in dependency order -- aggregates, then models, then standardisation, and
`write_claims_and_meta` last because it reads the files the others just wrote.
"""

from __future__ import annotations

from pipeline.claims import write_claims_and_meta
from pipeline.constants import OUT_DIR
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
from pipeline.standardise import write_race_prevalence

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
    write_race_prevalence,
    # Reads every file above back from disk, so it must stay last.
    write_claims_and_meta,
]


def clean_out_dir() -> None:
    """Remove stale JSON so the run's output set is exactly what the writers emit."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for path in OUT_DIR.glob("*.json"):
        path.unlink()


def run() -> list:
    df = load_data()
    clean_out_dir()
    paths = []
    for writer in WRITERS:
        # A writer returns either a single Path or a list of Paths.
        written = writer(df)
        for path in written if isinstance(written, list) else [written]:
            print(f"{path.name}  {path.stat().st_size}")
            paths.append(path)
    return paths
