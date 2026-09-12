"""Load the raw CardioLens CSV and derive typed/banded columns for analysis."""

from __future__ import annotations

import pandas as pd

from pipeline.constants import (
    AGE_BANDS,
    AGE_GROUP3_MAP,
    AGE_GROUPS3,
    BINARY_COLS,
    BMI_CLASSES,
    BMI_EDGES,
    DIABETIC,
    GENHEALTH,
    MENTAL_BANDS,
    RACES,
    RAW_PATH,
    SLEEP_BANDS,
    SLEEP_EDGES,
)


def load_raw(path=RAW_PATH) -> pd.DataFrame:
    """Read the raw CSV with its original columns and dtypes unchanged."""
    return pd.read_csv(path)


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Add outcome flags, ordered categoricals, and banded columns to `df`."""
    df = df.copy()
    df["hd"] = (df["HeartDisease"] == "Yes").astype(int)
    df["stroke"] = (df["Stroke"] == "Yes").astype(int)
    df["AgeCategory"] = pd.Categorical(df["AgeCategory"], categories=AGE_BANDS, ordered=True)
    df["Race"] = pd.Categorical(df["Race"], categories=RACES, ordered=False)
    df["GenHealth"] = pd.Categorical(df["GenHealth"], categories=GENHEALTH, ordered=True)
    df["Diabetic"] = pd.Categorical(df["Diabetic"], categories=DIABETIC, ordered=False)
    df["Sex"] = pd.Categorical(df["Sex"], categories=["Female", "Male"])
    for c in BINARY_COLS:
        df[c] = pd.Categorical(df[c], categories=["No", "Yes"])
    for c in ["Race", "GenHealth", "Diabetic", "Sex", *BINARY_COLS]:
        if df[c].isna().any():
            raise ValueError(f"{c} has values outside the expected set")
    df["BMIClass"] = pd.cut(df["BMI"], bins=BMI_EDGES, labels=BMI_CLASSES, right=False, ordered=True)
    df["SleepBand"] = pd.cut(df["SleepTime"], bins=SLEEP_EDGES, labels=SLEEP_BANDS, right=False, ordered=True)
    df["MentalBand"] = pd.cut(df["MentalHealth"], bins=[-0.5, 0.5, 13.5, 30.5], labels=MENTAL_BANDS, ordered=True)
    df["AgeGroup3"] = pd.Categorical(df["AgeCategory"].map(AGE_GROUP3_MAP), categories=AGE_GROUPS3, ordered=True)
    for c in ["BMIClass", "SleepBand", "MentalBand", "AgeGroup3"]:
        assert df[c].isna().sum() == 0, f"{c} has unassigned rows"
    return df


def load_data() -> pd.DataFrame:
    return add_derived(load_raw())
