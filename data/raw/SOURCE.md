# Data source

**File:** `heart_2020_cleaned.csv` (25,189,554 bytes, 319,795 rows, 18 columns)
**SHA-256:** `90a1e2e8bdcb4aba54314a41d35d2ac3be4763e459df33951e08e415f527f5a8`

**Origin:** Kaggle dataset *Personal Key Indicators of Heart Disease* by Kamil Pytlak,
<https://www.kaggle.com/datasets/kamilpytlak/personal-key-indicators-of-heart-disease>.
It is a cleaned subset of the CDC Behavioral Risk Factor Surveillance System (BRFSS)
2020 annual survey, <https://www.cdc.gov/brfss/annual_data/annual_2020.html>.
BRFSS data are in the public domain; the Kaggle packaging is released under CC0.

**What "cleaned" means (per the Kaggle author):** 401,958 survey rows reduced to
319,795 by dropping rows with missing values in the selected columns, and 279
variables reduced to the 18 judged most relevant to heart disease.

## Columns

| Column | Type | Values |
|---|---|---|
| HeartDisease | outcome | Yes / No: respondent reported coronary heart disease or myocardial infarction |
| BMI | numeric | body mass index, 12.02 to 94.85 |
| Smoking | binary | smoked at least 100 cigarettes in their life |
| AlcoholDrinking | binary | heavy drinker (men > 14 drinks/week, women > 7) |
| Stroke | binary | ever told they had a stroke |
| PhysicalHealth | numeric | days in the past 30 with poor physical health, 0 to 30 |
| MentalHealth | numeric | days in the past 30 with poor mental health, 0 to 30 |
| DiffWalking | binary | serious difficulty walking or climbing stairs |
| Sex | binary | Female / Male |
| AgeCategory | ordinal | 13 five-year bands from 18-24 to 80 or older |
| Race | nominal | White, Black, Asian, American Indian/Alaskan Native, Hispanic, Other |
| Diabetic | nominal | No, No borderline diabetes, Yes, Yes (during pregnancy) |
| PhysicalActivity | binary | physical activity in the past 30 days other than their job |
| GenHealth | ordinal | Excellent, Very good, Good, Fair, Poor |
| SleepTime | numeric | average hours of sleep in 24 h, 1 to 24 |
| Asthma | binary | ever told they had asthma |
| KidneyDisease | binary | ever told they had kidney disease (not stones, bladder infection, incontinence) |
| SkinCancer | binary | ever told they had skin cancer |

## Known properties that shape the analysis

- Every variable is self-reported in a telephone survey.
- The file carries no survey weights and no State column. All numbers on the site are
  unweighted sample proportions and are not nationally representative.
- 18,078 rows (5.7%) are exact duplicates of another row. The file has no respondent
  ID, and with 18 coarse columns identical answers from different people are expected,
  so duplicates are kept. The pipeline records the count.
- The outcome is rare: 27,373 of 319,795 rows (8.56%) report heart disease.

## Never modified

This file is committed as downloaded. The pipeline reads it and writes aggregates to
`site/public/data/`; nothing writes back here.
