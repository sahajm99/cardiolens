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
        "label": "Smoking (100+ cigarettes ever)",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "smokers",
        "unexposed_label": "non-smokers",
    },
    {
        "id": "alcohol",
        "column": "AlcoholDrinking",
        "label": "Heavy drinking",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "heavy drinkers",
        "unexposed_label": "adults who do not drink heavily",
    },
    {
        "id": "stroke",
        "column": "Stroke",
        "label": "Stroke history",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with a prior stroke",
        "unexposed_label": "adults with no stroke history",
    },
    {
        "id": "diabetes",
        "column": "Diabetic",
        "label": "Diabetes",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with diabetes",
        "unexposed_label": "adults without diabetes",
    },
    {
        "id": "diff_walking",
        "column": "DiffWalking",
        "label": "Serious difficulty walking",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with serious difficulty walking",
        "unexposed_label": "adults without difficulty walking",
    },
    {
        "id": "kidney",
        "column": "KidneyDisease",
        "label": "Kidney disease",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with kidney disease",
        "unexposed_label": "adults without kidney disease",
    },
    {
        "id": "asthma",
        "column": "Asthma",
        "label": "Asthma",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with asthma",
        "unexposed_label": "adults without asthma",
    },
    {
        "id": "skin_cancer",
        "column": "SkinCancer",
        "label": "Skin cancer",
        "exposed": ["Yes"],
        "unexposed": ["No"],
        "exposed_label": "adults with skin cancer",
        "unexposed_label": "adults without skin cancer",
    },
    {
        "id": "inactivity",
        "column": "PhysicalActivity",
        "label": "No physical activity",
        "exposed": ["No"],
        "unexposed": ["Yes"],
        "exposed_label": "inactive adults",
        "unexposed_label": "physically active adults",
    },
    {
        "id": "sex",
        "column": "Sex",
        "label": "Male sex",
        "exposed": ["Male"],
        "unexposed": ["Female"],
        "exposed_label": "men",
        "unexposed_label": "women",
    },
    {
        "id": "obesity",
        "column": "BMIClass",
        "label": "Obesity (BMI 30 or more)",
        "exposed": ["Obese I", "Obese II+"],
        "unexposed": ["Normal"],
        "exposed_label": "adults with obesity",
        "unexposed_label": "normal-weight adults",
    },
    {
        "id": "short_sleep",
        "column": "SleepBand",
        "label": "Short sleep (under 6 hours)",
        "exposed": ["Under 6h"],
        "unexposed": ["6-7h"],
        "exposed_label": "short sleepers",
        "unexposed_label": "adults sleeping 6 to 7 hours",
    },
    {
        "id": "poor_health",
        "column": "GenHealth",
        "label": "Fair or poor self-rated health",
        "exposed": ["Fair", "Poor"],
        "unexposed": ["Excellent", "Very good"],
        "exposed_label": "adults rating their health fair or poor",
        "unexposed_label": "adults rating it excellent or very good",
    },
]

SUPPRESS_N = 30
SMALL_N = 300
