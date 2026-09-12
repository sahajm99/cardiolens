# Decisions

Every taste decision, one line of why. Made by the autoplan pass over `docs/DESIGN.md`
using two independent reviews (strategy; engineering and design). Codex was not
installed, so both voices were Claude subagents with fresh context. The mission brief
is the approval gate; nothing here overrides it.

## Data

| # | Decision | Why |
|---|----------|-----|
| D1 | Keep the 18,078 exact duplicate rows; emit `n_rows`, `n_duplicate_rows` in `meta.json` and say so on the page. | No respondent ID exists and identical answers across 18 coarse columns are expected; deleting 5.7% of the sample is an unjustified edit. |
| D2 | Name the source as "Kaggle extract (kamilpytlak) of CDC BRFSS 2020", and print the row reconciliation 401,958 to 319,795 on the page. | The cleaning step was done by a third party and cannot be reconstructed; honesty about provenance is the site's pitch. |
| D3 | Commit the CSV uncompressed at `data/raw/`. | The brief requires it; 25 MB is under GitHub's limits and Git LFS would add friction. |
| D4 | Race is analysed descriptively (crude and age-standardised) and is not a regression covariate. | The file has no income, education or insurance variables; a race coefficient without them invites a causal misreading. |

## Statistics

| # | Decision | Why |
|---|----------|-----|
| S1 | Wilson 95% intervals on every proportion, plus one sentence that they are narrower than the truth because BRFSS clustering and weights are absent. | The brief requires Wilson; the design-effect caveat is the honest addition. |
| S2 | Suppression: n < 30 gives no estimate (`p`, `lo`, `hi` null); n < 300 is flagged `small_n` and drawn greyed. | Thin race x stroke cells would otherwise plot as confident dots. |
| S3 | Two logistic models. `primary`: AgeCategory, Sex, BMIClass, Smoking, AlcoholDrinking, Diabetic, Stroke, KidneyDisease, Asthma, SkinCancer. `full`: primary plus PhysicalActivity, DiffWalking, GenHealth. | GenHealth and DiffWalking are plausibly consequences of heart disease (Table 2 fallacy); the forest shows them in a separate "markers, not causes" panel from the full model. |
| S4 | Reference levels pinned: AgeCategory 18-24, Sex Female, BMIClass Normal, Diabetic No, GenHealth Excellent, all binaries No. Diabetic kept at 4 levels. | statsmodels defaults to alphabetical, which silently flips odds ratios; gestational diabetes is not type 2. |
| S5 | BMI enters the model as 5 WHO classes (Underweight < 18.5, Normal, Overweight 25 to < 30, Obese I 30 to < 35, Obese II+ 35 and over), never also as a continuous term. | Consistent with the heatmap and the estimator panel. |
| S6 | Assert convergence and fail the build if false; flag any level whose smallest 2x2 cell is under 10 as `unstable`; record max VIF in model metadata. | Prevents a nonsense odds ratio rendering as a dot at 10^6. |
| S7 | Also emit average marginal effects per term (percentage-point difference). | Lay readers want a difference in prevalence, not an odds ratio; costs ten lines. |
| S8 | Age standardisation uses the pooled sample's own age distribution as the standard population; CI by the Fay-Feuer gamma method; the weights are emitted in the JSON. | No external denominators exist and the 2000 US standard bands do not align with the 13 BRFSS bands. |
| S9 | Every crosstab is built on ordered `pd.Categorical` columns with `observed=False` so absent cells appear as explicit zero rows; JSON is written with `allow_nan=False`. | A vanished row silently shifts heatmap cells; bare `NaN` is invalid JSON. |
| S10 | The "class imbalance" note says: no classifier is fitted, so the 8.6% positive rate needs no correction; it matters only for the width of subgroup intervals. | The brief requires the note; this phrasing is the correct one for estimation. |

## Site and design

| # | Decision | Why |
|---|----------|-----|
| W1 | Plotly build: `plotly.js-cartesian-dist-min` (0.50 MB gzipped), imported once in `src/plotly.ts`. | Covers bar, scatter, heatmap and box with zero bundler config; a custom `plotly.js/lib` bundle saves ~120 KB but adds CommonJS risk in Vite. Taste decision. |
| W2 | Pipeline writes JSON straight to `site/public/data/` and the JSON is committed; CI re-runs the pipeline and fails on any diff. | The brief names that path; committing gives reviewable numeric diffs and a Python-free site build; the diff check makes staleness impossible. |
| W3 | Vite `base` is `/cardiolens/`; every fetch uses `import.meta.env.BASE_URL`; `.nojekyll` in `public/`. | Leading-slash fetches work in dev and 404 on Pages. |
| W4 | All chart titles and prose numbers come from the JSON (`claims.json` plus per-chart values) through `<span data-stat>` placeholders and a title template; no numeral describing the data is hand-typed in the site. | Titles that drift from the data would silently break the honesty thesis. |
| W5 | Charts render lazily with `IntersectionObserver` (`rootMargin: 200px`); chart 1 renders eagerly; every container reserves its height. | Load budget of 3 seconds and zero layout shift. |
| W6 | Palette is the dataviz skill's validated reference palette: series blue `#2a78d6`, orange `#eb6834`, aqua `#1baf7a`, yellow `#eda100` (dark: `#3987e5`, `#d95926`, `#199e70`, `#c98500`); single-hue blue ramp for sequential; reference-level markers are hollow. | Validator passes all checks in both modes; the brief says follow the dataviz skill. |
| W7 | One Plotly layout template built at render time from CSS custom properties; a theme toggle re-renders every mounted chart with `Plotly.react`; an inline head script sets the theme before paint. | Prevents light/dark drift and the flash of wrong theme. |
| W8 | Every chart gets `role="img"` with the claim as `aria-label`, and a `<details>` table of the same rows underneath. | Plotly SVG is opaque to screen readers; the table is the keyboard path. |
| W9 | States: reserved-height skeleton, per-chart fetch failure with a retry button (prose keeps the claim), reduced-motion disables transitions, print CSS forces light and avoids page breaks inside figures, `<noscript>` explains. | A single 404 must not blank the story. |
| W10 | Typography: Source Serif 4 for narrative prose, Source Sans 3 for chart text, tiles, nav and numbers; both self-hosted from `@fontsource-variable`, latin subset only. | A reading essay, not a dashboard; sans on figures keeps the hero number on-brand per dataviz. |
| W11 | Layout: single column, prose at 68ch, figures up to 880px, left aligned, sticky top nav that becomes a horizontal scroller under 640px. | Story shape; nothing competes with the charts. |
| W12 | The memorable element is the personal-estimate panel after the forest chart, driven by the `primary` model's coefficients evaluated in the browser. Inputs: age band, sex, BMI class, smoking, diabetes (No / borderline / Yes), stroke, kidney disease; the other three covariates are held at No and this is stated. Copy says "association in a 2020 survey sample, not a medical risk score" and never uses the word "risk". | It makes the visitor a data point without shipping raw rows; the guard rails keep it honest. |
| W13 | Controls (factor picker, strata toggle) are native `<select>` and `<button>` groups with no URL state. | Keyboard access for free; hash state would fight lazy rendering. |
| W14 | No cross-filtering between charts. | Each chart is one claim; the page is the argument. |
| W15 | Hero leads with the spread, not the average: "1 in 12 adults report heart disease. That average describes almost no one." followed by three stat tiles (overall, youngest band, oldest band) and the age chart. | The average is the least interesting number on the page. |

## Story

| # | Decision | Why |
|---|----------|-----|
| T1 | Age is the spine: hook (the age gradient), "is it just age?" (crude gaps then the same gaps within age bands), "what survives" (split forest plus estimator), interactions (BMI x sleep x mental health, sleep x age, BMI vs stroke and HD), "gaps this file cannot explain" (race), "what this cannot tell you". The brief's five beats are all present. | One repeatable sentence: most of what looks like lifestyle in this file is partly an age chart. |
| T2 | Chart list (11 charts plus the estimator): 1 age prevalence with sex toggle; 2 crude prevalence by factor with picker; 3 factor gap within age bands with picker; 4 forest, two panels; 5 estimator; 6 BMI class x sleep band heatmap with mental-health strata toggle; 7 prevalence by sleep band across three age groups; 8 heart disease and stroke prevalence by BMI class with age-group picker; 9 race crude vs age-standardised dumbbell; 10 race x stroke x heart disease; 11 general health by race, 100% stacked; 12 BMI, sleep and activity by race as three small multiples. | Every course question is answered; the BMI density curve was cut as an age-confounded artefact; the standalone age x sex bar became a toggle. |
| T3 | The equity section is titled "Gaps this file cannot explain" and opens with the missing confounders (income, education, insurance, geography) before the first chart. | Absence stated up front reads as judgment; the same charts without it read as naive. |
| T4 | A one-line differentiation sits under the hero: no classifier, no accuracy score; estimation with stated uncertainty and stated limits. | Hundreds of public notebooks train a classifier on this file; a hiring manager may have seen it. |
| T5 | A short "read this first" strip near the top links to the full limits section at the end. | A 60-second visitor never reaches the last section. |

## Process

| # | Decision | Why |
|---|----------|-----|
| P1 | `python -m pipeline` is the only entry point; `uv` manages the environment; CI uses `uv sync --frozen`. | Reproducibility with a lockfile. |
| P2 | The notebook is executed locally and committed with outputs; CI executes it to `/tmp` as a check without committing. | Proves it runs without CI writing to the repo. |
| P3 | Tests: parametrised structural checks over every JSON file (parses, < 200 KB, schema fields, no NaN, `0 <= lo <= p <= hi <= 1`, `events <= n`), conservation of n and events across 1-D partitions, literal 13-band age order with monotone prevalence, anchors (overall prevalence 0.0856 ± 0.0005, smoking OR in (1.1, 1.8), age 80+ OR > 5), model checks (one reference row per variable, converged), Wilson unit tests against known values, one golden file. | These are the assertions that catch a flipped reference level or a dropped category; row counts alone do not. |
| P4 | Portfolio: add the `cardiolens` entry and set `hidden: true` on the older `heart-disease-pipeline` entry that described the same coursework. | Two cards on one dataset would confuse a reader; hiding is a one-line reversible change and is flagged in the final report. |
