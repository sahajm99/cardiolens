# CardioLens

![ci](https://github.com/sahajm99/cardiolens/actions/workflows/ci.yml/badge.svg)

A story-shaped analysis of self-reported heart disease in the CDC BRFSS 2020 sample
(319,795 adults, 18 columns). About 8.6% of the sample reports heart disease, and that
average describes almost no one: the rate runs from well under one percent among adults
aged 18 to 24 to more than a fifth of adults aged 80 and older. Every chart on the site
is a claim with its sample size and a 95% Wilson interval, the factors are shown
both crude and adjusted for one another with logistic regression, and the things this
file cannot answer are stated on the page rather than buried in an appendix. A Python
pipeline turns the raw CSV into small JSON aggregates; the site never reads a raw row.

Live: <https://sahajm99.github.io/cardiolens/>

## What the site shows

Each claim below is drawn from the committed JSON aggregates, and every one of them
appears on the site with its sample size and a 95% interval.

- About 8.6% of the adults in this sample report heart disease (95% Wilson 8.5% to
  8.7%), which is roughly 1 in 12, and that average describes almost no one.
- Prevalence runs from 0.6% of adults aged 18 to 24 to 22.6% of adults aged 80 and
  older, a spread of about 37 fold, and age is the spine of every other comparison.
- Smokers report heart disease at 12.2% against 6.0% of non-smokers, a crude gap of
  2.02 times.
- Adults reporting no physical activity sit at 13.8% against 7.1% of physically active
  adults, a crude gap of 1.95 times, which looks like the same finding as smoking.
- It is not. Adjusted for age, sex, BMI class, the diagnosed conditions and self-rated
  health, inactivity's odds ratio is 0.98: the crude gap is age and illness, not
  activity. Smoking's stays at 1.69.
- The adjusted odds ratios that stay large are a prior stroke at 3.75, kidney disease
  at 2.36, diabetes at 2.07, male sex at 1.88 and the heaviest BMI class at 1.55; being
  80 or older carries 31.4.
- Heavy drinking's adjusted odds ratio falls below 1. That is the sick-quitter pattern
  in cross-sectional survey data, not evidence that drinking protects anyone.
- BMI and sleep stack at both ends of the sleep range: 18.7% of obese class I adults
  sleeping ten hours or more report heart disease, against 5.3% of normal-weight adults
  sleeping six to seven.
- Age standardisation does not close the gap between race and ethnicity groups on this
  file. American Indian/Alaskan Native adults stay highest, moving from 10.4% crude to
  12.5% standardised, while Hispanic (5.3% to 8.3%) and Asian (3.3% to 5.1%) rates rise
  because those groups are younger than the pool.
- The file carries no income, education, insurance or geography variable, so it cannot
  explain that gap, and race is never a regression covariate here.
- The lifestyle measures it does carry are far flatter between groups than heart
  disease is: mean BMI spans 25.2 to 30.2 across the groups.
- Provenance is on the page: the 2020 survey reached 401,958 respondents, this third
  party extract carries 319,795 rows, and the 18,078 exact duplicate rows (5.7%) are
  kept because no respondent identifier exists to say they are errors.

## Run it yourself

```sh
uv sync                      # Python 3.12 environment from uv.lock
uv run python -m pipeline    # writes site/public/data/*.json
uv run pytest                # pipeline tests

cd site
npm ci
npm run dev                  # http://localhost:5173/cardiolens/
```

`npm run build` type-checks and builds into `site/dist`; `npm run preview` serves that
build. CI re-runs the pipeline and fails if the committed JSON differs from a fresh run,
so the numbers on the site can never drift from the code that produced them.

## Notebook

`notebooks/analysis.ipynb` is the long-form version of the site: the same numbers, from
the same `pipeline/` functions, with each step written out so a reader can see what
question is asked, what the number answers and what it cannot answer. It is committed
with its outputs. The notebook is generated rather than hand-edited, so rebuilding it is
one command: `uv run python notebooks/build_notebook.py` writes the `.ipynb` from
`notebooks/build_notebook.py`, then `uv run jupyter nbconvert --to notebook --execute
--inplace notebooks/analysis.ipynb --ExecutePreprocessor.timeout=600` fills in the
outputs and `uv run python notebooks/build_notebook.py --normalise-eol` puts the line
endings back to LF. CI executes the notebook to `/tmp` on every run, so a change to the
pipeline that breaks the narrative fails the build.

## Layout

| Path | What is in it |
|------|---------------|
| `pipeline/` | The Python package: loaders, Wilson intervals, aggregates, logistic models, age standardisation. `python -m pipeline` is the only entry point. |
| `notebooks/` | The long-form analysis notebook and the script that generates it. |
| `tests/` | pytest suite: structural checks over every JSON file, conservation of counts, model checks, a golden file. |
| `data/raw/` | The source CSV and `SOURCE.md`. |
| `site/` | Vite + TypeScript + Plotly front end. `site/public/data/` holds the committed JSON aggregates. |
| `site/src/charts/` | One module per figure; each fetches its own JSON and renders itself. |
| `docs/` | Design notes, the decision log and progress. |
| `.github/workflows/ci.yml` | Pipeline, tests, type-check, build, and the GitHub Pages deploy. |

## Data provenance

The source is a Kaggle extract (kamilpytlak) of the CDC Behavioral Risk Factor
Surveillance System 2020 survey, not the CDC release itself; the cleaning step was
performed by a third party and cannot be reconstructed here. `data/raw/SOURCE.md`
records where the file came from, and `site/public/data/meta.json` records its SHA-256,
its shape and the row reconciliation. The survey weights are not present in the extract,
so every number is unweighted sample prevalence, and the site says so. `docs/DECISIONS.md`
explains each data and statistics decision in one line.

## Licence

MIT, see `LICENSE`. The underlying survey data belongs to the CDC and its Kaggle
redistributor.
