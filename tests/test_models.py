import json, pytest
from pipeline.models import fit_models, PRIMARY_COVS, FULL_COVS

@pytest.fixture(scope="module")
def models(df):
    return fit_models(df)

def test_both_models_converged(models):
    orj, est = models
    assert orj["models"]["primary"]["converged"] is True and orj["models"]["full"]["converged"] is True

def test_one_reference_row_per_variable(models):
    orj, _ = models
    for m in orj["models"].values():
        refs = [t for t in m["terms"] if t["is_reference"]]
        assert sorted(t["variable"] for t in refs) == sorted(m["covariates"])

def test_reference_levels_pinned(models):
    orj, _ = models
    prim = orj["models"]["primary"]["terms"]
    ref = {t["variable"]: t["level"] for t in prim if t["is_reference"]}
    assert ref["AgeCategory"] == "18-24" and ref["Sex"] == "Female" and ref["BMIClass"] == "Normal" and ref["Diabetic"] == "No" and ref["Smoking"] == "No"

def test_anchor_odds_ratios(models):
    orj, _ = models
    prim = {(t["variable"], t["level"]): t for t in orj["models"]["primary"]["terms"]}
    assert 1.1 < prim[("Smoking", "Yes")]["or"] < 1.8
    assert prim[("AgeCategory", "80 or older")]["or"] > 5
    assert prim[("Sex", "Male")]["or"] > 1.5
    assert prim[("Stroke", "Yes")]["or"] > 2
    for t in prim.values():
        if not t["is_reference"]:
            assert t["lo"] < t["or"] < t["hi"]

def test_groups(models):
    orj, _ = models
    full = orj["models"]["full"]["terms"]
    assert {t["group"] for t in full if t["variable"] in ("PhysicalActivity", "DiffWalking", "GenHealth")} == {"downstream"}
    assert {t["group"] for t in full if t["variable"] in PRIMARY_COVS} == {"upstream"}

def test_term_count(models):
    orj, _ = models
    prim = orj["models"]["primary"]
    assert len([t for t in prim["terms"] if not t["is_reference"]]) == prim["df_model"]

def test_estimator_reproduces_model(models, df):
    import math
    _, est = models
    assert est["model"] == "primary" and set(est["coefficients"]) == set(PRIMARY_COVS)
    # all-reference profile equals intercept probability
    p_ref = 1 / (1 + math.exp(-est["intercept"]))
    assert 0 < p_ref < 0.05
    assert abs(est["base_rate"] - 0.0856) < 0.0005
    assert est["age_band_rates"]["80 or older"] > 0.2

def test_estimator_inputs(models):
    _, est = models
    vars_ = [i["variable"] for i in est["inputs"]]
    assert vars_ == ["AgeCategory", "Sex", "BMIClass", "Smoking", "Diabetic", "Stroke", "KidneyDisease"]
    dia = next(i for i in est["inputs"] if i["variable"] == "Diabetic")
    assert dia["levels"] == ["No", "No, borderline diabetes", "Yes"]
    assert est["held_at_reference"] == ["AlcoholDrinking", "Asthma", "SkinCancer"]

def test_no_unstable_terms_in_primary(models):
    orj, _ = models
    assert not any(t["unstable"] for t in orj["models"]["primary"]["terms"] if not t["is_reference"])
