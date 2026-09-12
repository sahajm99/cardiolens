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
