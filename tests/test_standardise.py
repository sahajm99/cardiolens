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
