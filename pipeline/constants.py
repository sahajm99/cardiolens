"""Shared constants: paths, category orders, band edges, and reference levels.

`FACTORS` is a placeholder here; Task 2 populates it with the factor definitions
used by the aggregate writers.
"""

from __future__ import annotations

from pathlib import Path

RAW_PATH = Path(__file__).resolve().parents[1] / "data" / "raw" / "heart_2020_cleaned.csv"
OUT_DIR = Path(__file__).resolve().parents[1] / "site" / "public" / "data"

AGE_BANDS = [
    "18-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
    "55-59",
    "60-64",
    "65-69",
    "70-74",
    "75-79",
    "80 or older",
]

RACES = [
    "White",
    "Black",
    "Hispanic",
    "Asian",
    "American Indian/Alaskan Native",
    "Other",
]

GENHEALTH = ["Excellent", "Very good", "Good", "Fair", "Poor"]

DIABETIC = ["No", "No, borderline diabetes", "Yes", "Yes (during pregnancy)"]

BMI_CLASSES = ["Underweight", "Normal", "Overweight", "Obese I", "Obese II+"]
BMI_EDGES = [0, 18.5, 25, 30, 35, float("inf")]

SLEEP_BANDS = ["Under 6h", "6-7h", "8-9h", "10h or more"]
# Upper edge is 25 (not the data max of 24) so that right=False, half-open
# binning still includes SleepTime == 24 in the last band.
SLEEP_EDGES = [0, 6, 8, 10, 25]

MENTAL_BANDS = ["0 days", "1-13 days", "14 or more days"]

AGE_GROUPS3 = ["18-44", "45-64", "65 and older"]
AGE_GROUP3_MAP = {
    "18-24": "18-44",
    "25-29": "18-44",
    "30-34": "18-44",
    "35-39": "18-44",
    "40-44": "18-44",
    "45-49": "45-64",
    "50-54": "45-64",
    "55-59": "45-64",
    "60-64": "45-64",
    "65-69": "65 and older",
    "70-74": "65 and older",
    "75-79": "65 and older",
    "80 or older": "65 and older",
}

BINARY_COLS = [
    "Smoking",
    "AlcoholDrinking",
    "Stroke",
    "DiffWalking",
    "PhysicalActivity",
    "Asthma",
    "KidneyDisease",
    "SkinCancer",
]

REFERENCE = {
    "AgeCategory": "18-24",
    "Sex": "Female",
    "BMIClass": "Normal",
    "Diabetic": "No",
    "GenHealth": "Excellent",
    **{c: "No" for c in BINARY_COLS},
}

# Populated in Task 2.
FACTORS: list[dict] = []

SUPPRESS_N = 30
SMALL_N = 300
