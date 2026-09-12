"""Shared constants: paths, category orders, band edges, reference levels, and factor definitions."""

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

FACTORS: list[dict] = [
    {
        "id": "smoking",
        "column": "Smoking",
        "label": "Smoking",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Smoker",
        "unexposed_label": "Non-smoker",
    },
    {
        "id": "alcohol",
        "column": "AlcoholDrinking",
        "label": "Alcohol drinking",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Drinker",
        "unexposed_label": "Non-drinker",
    },
    {
        "id": "stroke",
        "column": "Stroke",
        "label": "Stroke history",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "History of stroke",
        "unexposed_label": "No history of stroke",
    },
    {
        "id": "diabetes",
        "column": "Diabetic",
        "label": "Diabetes",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Diabetic",
        "unexposed_label": "Non-diabetic",
    },
    {
        "id": "diff_walking",
        "column": "DiffWalking",
        "label": "Difficulty walking",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Difficulty walking",
        "unexposed_label": "No difficulty walking",
    },
    {
        "id": "kidney",
        "column": "KidneyDisease",
        "label": "Kidney disease",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Kidney disease",
        "unexposed_label": "No kidney disease",
    },
    {
        "id": "asthma",
        "column": "Asthma",
        "label": "Asthma",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Asthma",
        "unexposed_label": "No asthma",
    },
    {
        "id": "skin_cancer",
        "column": "SkinCancer",
        "label": "Skin cancer",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "Skin cancer",
        "unexposed_label": "No skin cancer",
    },
    {
        "id": "inactivity",
        "column": "PhysicalActivity",
        "label": "Physical inactivity",
        "exposed": ["No"],
        "unexposed": ["Yes"],
        "exposed_label": "No physical activity",
        "unexposed_label": "Physically active",
    },
    {
        "id": "sex",
        "column": "Sex",
        "label": "Sex",
        "exposed": ["Male"],
        "unexposed": ["Female"],
        "exposed_label": "Male",
        "unexposed_label": "Female",
    },
    {
        "id": "obesity",
        "column": "BMIClass",
        "label": "Obesity",
        "exposed": ["Obese I", "Obese II+"],
        "unexposed": ["Normal"],
        "exposed_label": "Obese",
        "unexposed_label": "Normal weight",
    },
    {
        "id": "short_sleep",
        "column": "SleepBand",
        "label": "Short sleep",
        "exposed": ["Under 6h"],
        "unexposed": ["6-7h"],
        "exposed_label": "Under 6h",
        "unexposed_label": "6-7h",
    },
    {
        "id": "poor_health",
        "column": "GenHealth",
        "label": "General health",
        "exposed": ["Fair", "Poor"],
        "unexposed": ["Excellent", "Very good"],
        "exposed_label": "Fair or poor health",
        "unexposed_label": "Excellent or very good health",
    },
]

SUPPRESS_N = 30
SMALL_N = 300
