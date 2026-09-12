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
