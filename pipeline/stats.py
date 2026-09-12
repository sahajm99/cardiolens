"""Statistical helpers: Wilson interval, mean CI, and Fay-Feuer standardised rate CI."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats as sps

Z95 = 1.959964


def round6(x: float) -> float:
    return float(round(float(x), 6))


def wilson(events: int, n: int, z: float = Z95) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion."""
    if n <= 0:
        raise ValueError("n must be positive")
    if events < 0 or events > n:
        raise ValueError("events must be within [0, n]")
    p = events / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    lo, hi = max(0.0, centre - half), min(1.0, centre + half)
    # At the degenerate boundaries (p=0 or p=1) the Wilson interval touches 0/1
    # exactly in real arithmetic; pin it there rather than leave a float residue.
    if events == 0:
        lo = 0.0
    if events == n:
        hi = 1.0
    return (lo, hi)


def mean_ci(x: pd.Series, z: float = Z95) -> tuple[float, float, float]:
    """Sample mean with a normal-approximation confidence interval."""
    x = pd.Series(x).astype(float)
    m = float(x.mean())
    se = float(x.std(ddof=1) / math.sqrt(len(x))) if len(x) > 1 else 0.0
    return (m, m - z * se, m + z * se)


def fay_feuer_ci(
    events_by_band: np.ndarray,
    n_by_band: np.ndarray,
    weights: np.ndarray,
    level: float = 0.95,
) -> tuple[float, float, float]:
    """Directly standardised proportion with the Fay-Feuer (1997) gamma interval."""
    d = np.asarray(events_by_band, float)
    n = np.asarray(n_by_band, float)
    w = np.asarray(weights, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        wi = np.where(n > 0, w / n, 0.0)  # weight per event in band i
    rate = float(np.sum(wi * d))
    var = float(np.sum(wi * wi * d))
    wmax = float(np.max(wi)) if len(wi) else 0.0
    alpha = 1 - level
    if rate <= 0 or var <= 0:
        lo = 0.0
    else:
        lo = float(sps.gamma.ppf(alpha / 2, a=rate * rate / var, scale=var / rate))
    hi = float(
        sps.gamma.ppf(
            1 - alpha / 2,
            a=(rate + wmax) ** 2 / (var + wmax**2),
            scale=(var + wmax**2) / (rate + wmax),
        )
    )
    return (rate, max(0.0, lo), min(1.0, hi))
