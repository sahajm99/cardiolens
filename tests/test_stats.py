import numpy as np
import pytest
from pipeline.stats import wilson, mean_ci, fay_feuer_ci


def test_wilson_known_value_zero_events():
    lo, hi = wilson(0, 10)
    assert lo == 0.0
    assert abs(hi - 0.2775) < 1e-3


def test_wilson_known_value_half():
    lo, hi = wilson(5, 10)
    assert abs(lo - 0.2366) < 1e-3 and abs(hi - 0.7634) < 1e-3


def test_wilson_all_events():
    lo, hi = wilson(10, 10)
    assert hi == 1.0 and abs(lo - 0.7225) < 1e-3


def test_wilson_rejects_bad_input():
    with pytest.raises(ValueError):
        wilson(1, 0)
    with pytest.raises(ValueError):
        wilson(3, 2)


def test_wilson_contains_point_estimate():
    lo, hi = wilson(27373, 319795)
    p = 27373 / 319795
    assert lo < p < hi and hi - lo < 0.003


def test_mean_ci_symmetric():
    import pandas as pd
    m, lo, hi = mean_ci(pd.Series([1.0, 2.0, 3.0, 4.0]))
    assert m == 2.5 and abs((m - lo) - (hi - m)) < 1e-9


def test_fay_feuer_matches_crude_when_weights_equal_band_shares():
    events = np.array([10, 20, 30]); n = np.array([100, 200, 300]); w = n / n.sum()
    rate, lo, hi = fay_feuer_ci(events, n, w)
    assert abs(rate - 0.1) < 1e-9 and lo < rate < hi


def test_fay_feuer_handles_zero_band():
    rate, lo, hi = fay_feuer_ci(np.array([0, 5]), np.array([50, 50]), np.array([0.5, 0.5]))
    assert 0 <= lo <= rate <= hi <= 1
