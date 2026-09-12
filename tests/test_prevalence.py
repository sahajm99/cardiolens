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
