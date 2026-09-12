# Brief and definition of done

CardioLens turns the UNT CSCE 5320 (Scientific Data Visualization, Spring 2025, Group 6)
heart-disease project into a live, public, portfolio-grade interactive data-analysis
site. The course deliverable is the floor, not the target.

## Source material (read-only)

- `heart_2020_cleaned.csv`: Kaggle extract of CDC BRFSS 2020, 319,795 rows, 18 columns.
- The course EDA notebook, proposal, final decks and rubric: reused for the questions,
  not the code.
- Phase 2's synthetic `heart_prediction_dataset.csv`: out of scope.

## Question list from the course project

BMI vs stroke and heart disease; sex; substance use (smoking, alcohol); sleep x BMI x
mental health; age x sleep; race vs heart disease; race x heart disease x stroke; BMI,
sleep and activity by race; race vs general health. State-level analysis is impossible
(no State column) and is not faked.

## Definition of done

1. Repo `sahajm99/cardiolens` exists, public, MIT licence, README a stranger can run from.
2. Live site at https://sahajm99.github.io/cardiolens. Loads in under 3 seconds, works
   at 400px and desktop, light and dark.
3. At least 8 interactive charts answering the question list, arranged as a story
   (hook, risk factors, interactions, equity lens, what this does not show), each with a
   one-sentence takeaway a non-expert can read.
4. Honest numbers: prevalence with Wilson 95% CIs; a logistic-regression adjusted
   odds-ratio chart; explicit notes on class imbalance (about 8.6% positive), self-report
   bias, and cross-sectional data meaning no causal claims.
5. Reproducible pipeline: `python -m pipeline` regenerates every JSON the site reads from
   the raw CSV. The CSV is committed under `data/raw/` with `SOURCE.md`. The browser never
   downloads it.
6. `notebooks/analysis.ipynb`, executed with outputs and committed.
7. CI: GitHub Actions runs pipeline, tests and build on every push, deploys Pages from
   `main`. Green badge in README.
8. Portfolio entry with `status: "live"`, real `liveUrl` and `github`, all required fields
   filled truthfully; `"data-visualization"` added to the category union.

## Fixed stack

Python 3.12, pandas, statsmodels, pytest. Vite + TypeScript, Plotly.js, no framework,
no CDN. GitHub Pages via Actions. Every JSON under 200 KB.

## Standing rules

- Every chart title is a claim; subtitle carries n and CI; source footnote on each.
- Never plot raw rows in the browser.
- Colourblind-safe palette, alt text on every chart, keyboard navigable.
- Conventional commits ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
