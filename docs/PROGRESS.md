# Progress log

Append one entry per milestone. Each entry records what was verified and how.

## 2026-09-12: Milestone 0, setup

- `gh auth status` showed both accounts; switched active account to `sahajm99`.
- Created public repo `sahajm99/cardiolens`, default branch `main`.
- Copied `heart_2020_cleaned.csv` (SHA-256 `90a1e2e8...f5a8`) to `data/raw/` with `SOURCE.md`.
- Explored the data with pandas: 319,795 rows, 27,373 positives (8.56%), 18,078
  duplicate rows kept, prevalence by every categorical column recorded in DECISIONS.md.
- Wrote `docs/DESIGN.md` (office-hours, builder mode) and ran two independent reviews
  (strategy; engineering and design). Decisions recorded in `docs/DECISIONS.md`.
- Validated the dataviz reference palette (4 categorical slots) in light and dark with
  the skill's validator: all checks pass; light-mode aqua and yellow need direct labels.
- Scaffolded `pyproject.toml` (uv, Python 3.12, pandas 2.3.3, statsmodels 0.14.6) and
  `site/` (Vite vanilla-ts, plotly.js-cartesian-dist-min at 0.50 MB gzipped).

## 2026-09-12: Milestone 1, pipeline complete

- `uv run pytest`: 63 passed in about 75 s, output pristine.
- `uv run python -m pipeline` writes 16 JSON files to `site/public/data/` (largest 33 KB, all under 200 KB) and is idempotent.
- Anchors verified by tests: overall prevalence 0.0856 (95% Wilson 0.0846 to 0.0866); age order literal and monotone; smoking crude ratio 2.02; smoking adjusted OR 1.69; age 80+ adjusted OR 31.4; inactivity adjusted OR 0.98 in the full model; both models converged, max VIF 2.48.
- Every task was implemented by a fresh subagent and reviewed by a second; Task 2 needed one fix round (rounded shares, AgeCategory guard). Ledger: `.superpowers/sdd/2026-09-12-cardiolens/progress.md`.
- History rewritten so every commit is authored by `sahajm99` with no co-author trailer (user instruction); repo-local git identity set accordingly.

## 2026-09-12: Milestone 2, site skeleton live

- Commit `5b4a619`: Vite + TypeScript skeleton, theme tokens (light and dark, both scopes), Plotly layout template read from CSS custom properties, `figure.ts` chrome (claim title, subtitle with n, `role="img"`, details table, error state with retry), lazy mounting, `data-stat` fills from `claims.json`, the age prevalence chart with a sex toggle, README with CI badge, `.github/workflows/ci.yml`.
- CI green on first run: https://github.com/sahajm99/cardiolens/actions/runs/34699828339 (pipeline, staleness diff, pytest, build, deploy).
- Live: `curl -sI https://sahajm99.github.io/cardiolens/` returns `HTTP/1.1 200 OK`.
- Build: 479 kB JS gzipped (Plotly chunk 474 kB, app 5 kB), CSS 3 kB, two latin variable fonts 80 kB fetched.
- Screenshots (desktop light, desktop dark, 400px, live) in `.superpowers/sdd/2026-09-12-cardiolens/shots/`; the hero, tiles, read-this-first strip, nav and chart render correctly in all four.

## 2026-09-12: Milestone 3, the whole story on the page

- Charts 2 to 12 and the estimator panel: crude prevalence by factor with a picker,
  the same factor split inside thirteen age bands, the two-panel adjusted odds forest
  (upstream terms from the primary model, markers that travel with heart disease from
  the full one), the browser-side estimator, the BMI by sleep heat map with a
  mental-health strata toggle, sleep within three age groups, heart disease and stroke
  against BMI class, and the four equity figures. Commits `247138a` (charts 2 to 5) and
  `ad70f9b` (charts 6 to 12). CI green:
  https://github.com/sahajm99/cardiolens/actions/runs/34700894796 and
  https://github.com/sahajm99/cardiolens/actions/runs/34702165290.
- Long-form notebook executed and committed with outputs, with a CI step that executes
  it to a temporary directory on every run (commit `10904b5`).
- Factor labels rewritten as noun phrases and `sleep_mean` added to the race summary,
  so the generated chart titles read as sentences (commit `855b66f`, CI green:
  https://github.com/sahajm99/cardiolens/actions/runs/34703161881).
- Narrative: every section now carries one to three paragraphs before its first figure
  and a bridge after it, the limits section is a list of nine, and the footer names the
  author, the Kaggle source, the stack and the licence. Every number in the prose goes
  through `data-stat`; `grep -nE "[0-9]{2,}" site/index.html` filtered for `data-stat`,
  `viewBox` and the survey year leaves only age band labels and CSS lengths.
- Polish: `strict: true` in `site/tsconfig.json` (clean on the first run), current
  section highlighted in the sticky nav by IntersectionObserver, a visible retry notice
  when `claims.json` fails, a cache-bypassing second read so every retry button can
  actually succeed, the forest plot scrolling inside its own wrapper with a fade cue
  under 640px, the heat map's label contrast floor raised so light-mode cells no longer
  carry dark text on dark blue, shared `reversed`, legend, point and label helpers
  across the chart modules, and a neutral title for the age-standardised race figure
  where the old one asserted the opposite of a claim the intervals do not support.
- Verified: `npm run typecheck` and `npm run build` clean (474 kB gzipped Plotly chunk,
  app 3.6 kB, CSS 3.7 kB); all twelve figures render in light, dark and at 400px;
  every factor-by-age claim template checked against all six factors; the theme toggle
  reports the matching `aria-pressed` and `aria-label`; nav highlight steps through all
  six sections. Screenshots in `.superpowers/sdd/2026-09-12-cardiolens/shots/task9-*`.
