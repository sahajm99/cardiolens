import pytest

from pipeline.constants import AGE_BANDS, RACES, BMI_CLASSES, SLEEP_BANDS, MENTAL_BANDS, AGE_GROUPS3
from pipeline.load import add_derived, load_raw


def test_shape(df):
    assert df.shape[0] == 319795


def test_outcome_counts(df):
    assert int(df["hd"].sum()) == 27373
    assert set(df["hd"].unique()) == {0, 1}


def test_age_is_ordered_categorical(df):
    assert list(df["AgeCategory"].cat.categories) == AGE_BANDS
    assert df["AgeCategory"].cat.ordered
    assert df["AgeCategory"].isna().sum() == 0


def test_race_order(df):
    assert list(df["Race"].cat.categories) == RACES


def test_bmi_classes_cover_everyone(df):
    assert list(df["BMIClass"].cat.categories) == BMI_CLASSES
    assert df["BMIClass"].isna().sum() == 0
    assert (df.loc[df["BMI"] < 18.5, "BMIClass"] == "Underweight").all()
    assert (df.loc[df["BMI"] >= 35, "BMIClass"] == "Obese II+").all()


def test_sleep_and_mental_bands(df):
    assert list(df["SleepBand"].cat.categories) == SLEEP_BANDS
    assert df["SleepBand"].isna().sum() == 0
    assert list(df["MentalBand"].cat.categories) == MENTAL_BANDS
    assert (df.loc[df["MentalHealth"] == 0, "MentalBand"] == "0 days").all()


def test_age_group3(df):
    assert list(df["AgeGroup3"].cat.categories) == AGE_GROUPS3
    assert (df.loc[df["AgeCategory"] == "80 or older", "AgeGroup3"] == "65 and older").all()


def test_binary_categoricals(df):
    assert list(df["Smoking"].cat.categories) == ["No", "Yes"]


def test_add_derived_rejects_unexpected_race_value():
    raw = load_raw()
    bad = raw.copy()
    bad.loc[0, "Race"] = "Martian"
    with pytest.raises(ValueError):
        add_derived(bad)


def test_add_derived_rejects_unexpected_age_category_value():
    raw = load_raw()
    bad = raw.copy()
    bad.loc[0, "AgeCategory"] = "0-17"
    with pytest.raises(ValueError):
        add_derived(bad)
