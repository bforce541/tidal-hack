"""
Optional ML-based projection for 2030/2040. Isolated from project.py.

Two-stage robust annual-growth model (demo-ready):
  Stage 1: From match rows compute annual = (later_depth - prev_depth) / delta_year;
  robust global median (IQR-clipped) and depth-binned median annual rates; annual capped to [p5, p95].
  Stage 2: Per anomaly, pred_depth = latest_depth + horizon * annual_rate, horizon = target_year - latest_year.
  This guarantees 2030 != 2040 (different horizons) unless annual rate is zero.
  Optional: if sklearn available, HGBR can predict annual from (depth, horizon, slope); used only if MAE beats robust median.

Bounded-exponential projections remain in project.py (compute_projections) and are unchanged.
"""
from __future__ import annotations

import os
from typing import Any

import numpy as np
import pandas as pd

# Column names (machine CSV); do not import from project.py.
_COL_PREV_YEAR = "prev_year"
_COL_LATER_YEAR = "later_year"
_COL_PREV_DEPTH = "prev_depth_percent"
_COL_LATER_DEPTH = "later_depth_percent"
_COL_LATER_IDX = "later_idx"
_COL_DISTANCE = "later_distance_corrected_m"

# Optional numeric columns we may use if present (alignment/confidence/spatial)
_OPTIONAL_FEATURE_CANDIDATES = [
    "later_distance_corrected_m",
    "distance_corrected_m",
    "aligned_distance_m",
    "delta_distance_m",
    "score",
    "match_score",
    "confidence",
    "match_quality",
]

# Delta clipping for realism: clamp predicted delta to this range (or training quantiles)
DELTA_CLIP_ABS = 30.0
HIGH_RISK_DEPTH = 40

# Depth bins for robust annual-growth model: [0-20), [20-40), [40-60), [60-80), [80-100]
_DEPTH_BIN_EDGES = [0.0, 20.0, 40.0, 60.0, 80.0, 100.0]
_NUM_DEPTH_BINS = 5


def _depth_bin_index(depth: float) -> int:
    """Return bin index 0..4 for depth in [0, 100]. 100 goes to bin 4."""
    d = max(0.0, min(100.0, float(depth)))
    if d >= 100.0:
        return 4
    return min(4, int(d / 20.0))


def _compute_robust_annual_stage1(
    matches_df: pd.DataFrame,
) -> tuple[
    float,
    list[float],
    float,
    float,
    list[tuple[str, int, float]],
    np.ndarray,
    np.ndarray,
]:
    """
    Stage 1: From match rows compute robust global annual rate and depth-binned rates.
    Returns (annual_rate_global, annual_rate_by_bin[5], annual_p5, annual_p95,
             list of (anomaly_id, latest_year, latest_depth), annual_per_row, prev_depth_per_row).
    """
    annuals: list[float] = []
    prev_depths: list[float] = []
    rows_meta: list[tuple[str, int, float]] = []  # (anomaly_id, latest_year, latest_depth)

    for _, row in matches_df.iterrows():
        prev_y = row.get(_COL_PREV_YEAR)
        later_y = row.get(_COL_LATER_YEAR)
        prev_d = row.get(_COL_PREV_DEPTH)
        later_d = row.get(_COL_LATER_DEPTH)
        if pd.isna(prev_y) or pd.isna(later_y) or pd.isna(prev_d) or pd.isna(later_d):
            continue
        prev_y, later_y = int(prev_y), int(later_y)
        prev_d = max(0.0, min(100.0, float(prev_d)))
        later_d = max(0.0, min(100.0, float(later_d)))
        delta_year = max(1, later_y - prev_y)
        delta = later_d - prev_d
        annual = delta / delta_year
        annuals.append(annual)
        prev_depths.append(prev_d)
        aid = str(int(row.get(_COL_LATER_IDX, 0)))
        rows_meta.append((aid, later_y, later_d))

    if not annuals:
        return 0.0, [0.0] * _NUM_DEPTH_BINS, 0.0, 0.0, [], np.zeros(0), np.zeros(0)

    annual_arr = np.array(annuals, dtype=float)
    prev_depths_arr = np.array(prev_depths, dtype=float)

    # IQR-based clip to remove outliers, then robust median
    p25, p75 = float(np.percentile(annual_arr, 25)), float(np.percentile(annual_arr, 75))
    iqr = p75 - p25
    if iqr <= 0:
        iqr = 1e-6
    lo, hi = p25 - 1.5 * iqr, p75 + 1.5 * iqr
    annual_clipped = np.clip(annual_arr, lo, hi)
    annual_rate_global = float(np.median(annual_clipped))
    annual_p5 = float(np.percentile(annual_clipped, 5))
    annual_p95 = float(np.percentile(annual_clipped, 95))

    # Per-bin robust median annual (use same clipped values for consistency)
    annual_rate_by_bin: list[float] = []
    for b in range(_NUM_DEPTH_BINS):
        mask = np.array([_depth_bin_index(prev_depths[i]) == b for i in range(len(prev_depths))])
        if np.sum(mask) > 0:
            annual_rate_by_bin.append(float(np.median(annual_clipped[mask])))
        else:
            annual_rate_by_bin.append(annual_rate_global)
    assert len(annual_rate_by_bin) == _NUM_DEPTH_BINS

    return (
        annual_rate_global,
        annual_rate_by_bin,
        annual_p5,
        annual_p95,
        rows_meta,
        annual_clipped,
        prev_depths_arr,
    )


def _project_robust_annual_stage2(
    rows_meta: list[tuple[str, int, float]],
    annual_rate_global: float,
    annual_rate_by_bin: list[float],
    annual_p5: float,
    annual_p95: float,
    target_years: list[int],
) -> dict[str, list[dict[str, Any]]]:
    """
    Stage 2: Per-anomaly projection using latest state + horizon * annual rate.
    Guarantees 2040 != 2030 when annual rate is not zero (different horizons).
    """
    predictions_by_year: dict[str, list[dict[str, Any]]] = {str(ty): [] for ty in target_years}
    for aid, latest_year, latest_depth in rows_meta:
        for ty in target_years:
            horizon = max(1, ty - latest_year)
            bin_idx = _depth_bin_index(latest_depth)
            annual = annual_rate_by_bin[bin_idx] if bin_idx < len(annual_rate_by_bin) else annual_rate_global
            annual = float(np.clip(annual, annual_p5, annual_p95))
            pred_depth = latest_depth + horizon * annual
            pred_depth = max(0.0, min(100.0, round(pred_depth, 2)))
            predictions_by_year[str(ty)].append({"id": aid, "depth": pred_depth})
    return predictions_by_year


def _try_annual_hgbr(
    matches_df: pd.DataFrame,
    rows_meta: list[tuple[str, int, float]],
    annual_p5: float,
    annual_p95: float,
    target_years: list[int],
) -> tuple[(dict[str, list[dict[str, Any]]] | None), str, dict[str, Any]]:
    """
    Optional: fit HGBR to predict annual from (prev_depth, delta_year, slope). If MAE improves
    over robust median, return (predictions_by_year, "annual_hgbr", metrics). Else return (None, "", {}).
    Robust method remains fallback.
    """
    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
    except ImportError:
        return None, "", {}

    X, y_delta, _pd, prev_years, later_years, _, _, _, _ = _build_feature_matrix_delta(matches_df)
    if len(X) < 5 or len(rows_meta) != len(X):
        return None, "", {}
    delta_years = np.maximum(1, later_years - prev_years)
    y_annual = y_delta / delta_years.astype(float)
    X_annual = X[:, [0, 1, 3]]  # prev_depth, delta_year, slope
    uniq_years = np.unique(later_years)
    mae_hgbr = 0.0
    mae_robust = 0.0
    model = None

    if len(uniq_years) < 2:
        model = HistGradientBoostingRegressor(
            max_iter=150, max_depth=3, min_samples_leaf=10, random_state=42,
        )
        model.fit(X_annual, y_annual)
        pred_annual = model.predict(X_annual)
        mae_hgbr = float(np.mean(np.abs(y_annual - pred_annual)))
        mae_robust = float(np.mean(np.abs(y_annual - np.median(y_annual))))
        if mae_hgbr >= mae_robust:
            return None, "", {}
    else:
        test_year = int(np.max(uniq_years))
        train_idx = np.where(later_years < test_year)[0]
        test_idx = np.where(later_years == test_year)[0]
        if len(train_idx) < 2 or len(test_idx) < 1:
            return None, "", {}
        model = HistGradientBoostingRegressor(
            max_iter=150, max_depth=3, min_samples_leaf=10, random_state=42,
        )
        model.fit(X_annual[train_idx], y_annual[train_idx])
        pred_test = model.predict(X_annual[test_idx])
        mae_hgbr = float(np.mean(np.abs(y_annual[test_idx] - pred_test)))
        robust_pred = np.median(y_annual[train_idx])
        mae_robust = float(np.mean(np.abs(y_annual[test_idx] - robust_pred)))
        if mae_hgbr >= mae_robust:
            return None, "", {}
        # Refit on all data for production predictions
        model = HistGradientBoostingRegressor(
            max_iter=150, max_depth=3, min_samples_leaf=10, random_state=42,
        )
        model.fit(X_annual, y_annual)

    if model is None:
        return None, "", {}
    metrics = {"annual_mae_hgbr": round(mae_hgbr, 4), "annual_mae_robust_baseline": round(mae_robust, 4)}
    predictions_by_year = {str(ty): [] for ty in target_years}
    for i, (aid, latest_year, latest_depth) in enumerate(rows_meta):
        if i >= len(X):
            break
        for ty in target_years:
            horizon = max(1, ty - latest_year)
            x_row = np.array([[latest_depth, float(horizon), float(X[i, 3])]], dtype=float)
            pred_annual = model.predict(x_row)[0]
            pred_annual = float(np.clip(pred_annual, annual_p5, annual_p95))
            pred_depth = latest_depth + horizon * pred_annual
            pred_depth = max(0.0, min(100.0, round(pred_depth, 2)))
            predictions_by_year[str(ty)].append({"id": aid, "depth": pred_depth})
    n_expected = len(rows_meta)
    for ty in target_years:
        while len(predictions_by_year[str(ty)]) < n_expected:
            predictions_by_year[str(ty)].append({"id": "", "depth": 0.0})
    return predictions_by_year, "annual_hgbr", metrics


def _build_feature_matrix_delta(
    matches_df: pd.DataFrame,
) -> tuple[
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    list[str],
    np.ndarray,
    list[str],
    np.ndarray,
]:
    """
    Build feature matrix X and target y_delta = later_depth - prev_depth.
    Required features: prev_depth_percent, delta_year, prev_year, slope, depth_x_delta, depth_sq.
    Optional: any of _OPTIONAL_FEATURE_CANDIDATES present and numeric in matches_df.
    Returns (X, y_delta, prev_depths, prev_years, later_years, anomaly_ids, slopes, feature_names, optional_mask).
    """
    base_names = [
        "prev_depth_percent",
        "delta_year",
        "prev_year",
        "slope",
        "depth_x_delta",
        "depth_sq",
    ]
    # Detect optional numeric columns (exclude core columns we already use)
    core = {_COL_PREV_YEAR, _COL_LATER_YEAR, _COL_PREV_DEPTH, _COL_LATER_DEPTH, _COL_LATER_IDX}
    optional_names: list[str] = []
    for c in _OPTIONAL_FEATURE_CANDIDATES:
        if c in matches_df.columns and c not in core:
            if pd.api.types.is_numeric_dtype(matches_df[c]) and matches_df[c].notna().any():
                optional_names.append(c)

    feature_names = base_names + optional_names
    rows: list[list[float]] = []
    y_delta_list: list[float] = []
    prev_depths_list: list[float] = []
    prev_years_list: list[int] = []
    later_years_list: list[int] = []
    anomaly_ids_list: list[str] = []
    slopes_list: list[float] = []

    for _, row in matches_df.iterrows():
        prev_y = row.get(_COL_PREV_YEAR)
        later_y = row.get(_COL_LATER_YEAR)
        prev_d = row.get(_COL_PREV_DEPTH)
        later_d = row.get(_COL_LATER_DEPTH)
        if pd.isna(prev_y) or pd.isna(later_y) or pd.isna(prev_d) or pd.isna(later_d):
            continue
        prev_y, later_y = int(prev_y), int(later_y)
        prev_d = max(0.0, min(100.0, float(prev_d)))
        later_d = max(0.0, min(100.0, float(later_d)))
        delta_year = max(1, later_y - prev_y)
        slope = (later_d - prev_d) / delta_year
        depth_x_delta = prev_d * delta_year
        depth_sq = prev_d**2
        # Target: delta-growth (more stable for forecasting)
        y_delta_list.append(later_d - prev_d)
        prev_depths_list.append(prev_d)
        prev_years_list.append(prev_y)
        later_years_list.append(later_y)
        anomaly_ids_list.append(str(int(row.get(_COL_LATER_IDX, 0))))
        slopes_list.append(slope)

        feat: list[float] = [prev_d, float(delta_year), float(prev_y), slope, depth_x_delta, depth_sq]
        for c in optional_names:
            v = row.get(c)
            feat.append(float(v) if pd.notna(v) else 0.0)
        rows.append(feat)

    if not rows:
        n_base = 6
        n_opt = len(optional_names)
        return (
            np.zeros((0, n_base + n_opt)),
            np.zeros(0),
            np.zeros(0),
            np.zeros(0, dtype=int),
            np.zeros(0, dtype=int),
            [],
            np.zeros(0),
            feature_names,
            np.array([True] * n_base + [False] * n_opt),
        )

    X = np.array(rows, dtype=float)
    y_delta = np.array(y_delta_list, dtype=float)
    prev_depths = np.array(prev_depths_list, dtype=float)
    prev_years = np.array(prev_years_list, dtype=int)
    later_years = np.array(later_years_list, dtype=int)
    slopes = np.array(slopes_list, dtype=float)
    # optional_mask: which columns are optional (for scaling we treat all same; tree models ignore)
    optional_mask = np.array([False] * 6 + [True] * len(optional_names))
    return X, y_delta, prev_depths, prev_years, later_years, anomaly_ids_list, slopes, feature_names, optional_mask


def _rolling_backtest(
    X: np.ndarray,
    y_delta: np.ndarray,
    prev_depths: np.ndarray,
    later_years: np.ndarray,
    fit_fn: Any,
    predict_fn: Any,
    delta_clip_lo: float,
    delta_clip_hi: float,
) -> tuple[dict[str, Any], int]:
    """
    Rolling time-based backtest: for each test year Y in unique(later_year)[1:],
    train on later_year < Y, test on later_year == Y. Aggregate MAE/RMSE/R² on
    delta and on reconstructed depth (prev_depth + pred_delta).
    Returns (metrics_dict, n_folds).
    """
    uniq_years = np.unique(later_years)
    if len(uniq_years) < 2:
        return {
            "rolling_mae_delta": None,
            "rolling_rmse_delta": None,
            "rolling_r2_delta": None,
            "rolling_mae_depth": None,
            "rolling_rmse_depth": None,
            "rolling_r2_depth": None,
            "rolling_folds": 0,
        }, 0

    mae_deltas: list[float] = []
    rmse_deltas: list[float] = []
    r2_deltas: list[float] = []
    mae_depths: list[float] = []
    rmse_depths: list[float] = []
    r2_depths: list[float] = []

    for test_year in uniq_years[1:]:
        train_idx = np.where(later_years < test_year)[0]
        test_idx = np.where(later_years == test_year)[0]
        if len(train_idx) < 2 or len(test_idx) < 1:
            continue
        X_train, y_train = X[train_idx], y_delta[train_idx]
        X_test = X[test_idx]
        y_delta_test = y_delta[test_idx]
        prev_test = prev_depths[test_idx]
        y_depth_test = prev_test + y_delta_test  # true depth = prev + delta

        try:
            model = fit_fn(X_train, y_train)
            pred_delta_raw = predict_fn(model, X_test)
            pred_delta = np.clip(pred_delta_raw, delta_clip_lo, delta_clip_hi)
            pred_depth = prev_test + pred_delta
        except Exception:
            continue

        mae_deltas.append(_mae(y_delta_test, pred_delta))
        rmse_deltas.append(_rmse(y_delta_test, pred_delta))
        r2 = _r2(y_delta_test, pred_delta)
        r2_deltas.append(r2 if r2 is not None else 0.0)

        mae_depths.append(_mae(y_depth_test, pred_depth))
        rmse_depths.append(_rmse(y_depth_test, pred_depth))
        r2d = _r2(y_depth_test, pred_depth)
        r2_depths.append(r2d if r2d is not None else 0.0)

    n_folds = len(mae_deltas)
    if n_folds == 0:
        return {
            "rolling_mae_delta": None,
            "rolling_rmse_delta": None,
            "rolling_r2_delta": None,
            "rolling_mae_depth": None,
            "rolling_rmse_depth": None,
            "rolling_r2_depth": None,
            "rolling_folds": 0,
        }, 0

    return {
        "rolling_mae_delta": round(float(np.mean(mae_deltas)), 4),
        "rolling_rmse_delta": round(float(np.mean(rmse_deltas)), 4),
        "rolling_r2_delta": round(float(np.mean(r2_deltas)), 4),
        "rolling_mae_depth": round(float(np.mean(mae_depths)), 4),
        "rolling_rmse_depth": round(float(np.mean(rmse_depths)), 4),
        "rolling_r2_depth": round(float(np.mean(r2_depths)), 4),
        "rolling_folds": n_folds,
    }, n_folds


def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)))


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    if len(y_true) < 2:
        return None
    ss_res = np.sum((np.asarray(y_true) - np.asarray(y_pred)) ** 2)
    ss_tot = np.sum((np.asarray(y_true) - np.mean(y_true)) ** 2)
    if ss_tot == 0:
        return None
    return float(1 - ss_res / ss_tot)


# ----- Sklearn models (primary: HistGradientBoostingRegressor; no scaling for trees) -----


def _fit_sklearn_hgb(
    X_train: np.ndarray,
    y_train: np.ndarray,
    max_depth: int = 3,
    learning_rate: float = 0.05,
    max_leaf_nodes: int = 31,
    min_samples_leaf: int = 20,
    l2_regularization: float = 0.1,
) -> Any:
    from sklearn.ensemble import HistGradientBoostingRegressor
    # Tree models: no feature scaling; params tuned for stability and fast runtime
    return HistGradientBoostingRegressor(
        max_iter=200,
        max_depth=max_depth,
        learning_rate=learning_rate,
        max_leaf_nodes=max_leaf_nodes,
        min_samples_leaf=min_samples_leaf,
        l2_regularization=l2_regularization,
        random_state=42,
    ).fit(X_train, y_train)


def _fit_sklearn_gbr(X_train: np.ndarray, y_train: np.ndarray) -> Any:
    from sklearn.ensemble import GradientBoostingRegressor
    return GradientBoostingRegressor(
        n_estimators=100,
        max_depth=3,
        learning_rate=0.1,
        random_state=42,
    ).fit(X_train, y_train)


def _fit_sklearn_ridge_poly(X_train: np.ndarray, y_train: np.ndarray) -> Any:
    from sklearn.preprocessing import StandardScaler, PolynomialFeatures
    from sklearn.linear_model import Ridge
    from sklearn.pipeline import Pipeline
    pipe = Pipeline([
        ("poly", PolynomialFeatures(degree=2, include_bias=True)),
        ("scale", StandardScaler()),
        ("ridge", Ridge(alpha=1.0, random_state=42)),
    ])
    pipe.fit(X_train, y_train)
    return pipe


def _predict_sklearn(model: Any, X: np.ndarray) -> np.ndarray:
    return np.asarray(model.predict(X), dtype=float)


# ----- Numpy fallback (improved: linear + squared per feature) -----


def _build_design_numpy(X: np.ndarray, poly2: bool) -> np.ndarray:
    """Design matrix: [1, X] or [1, X, X^2] for linear/poly2."""
    ones = np.ones((len(X), 1))
    if not poly2:
        return np.hstack([ones, X])
    return np.hstack([ones, X, X ** 2])


def _fit_numpy_ridge(X_train: np.ndarray, y_train: np.ndarray, poly2: bool) -> np.ndarray:
    A = _build_design_numpy(X_train, poly2)
    # Small L2 for stability; use lstsq when underdetermined (few rows)
    lam = 1e-5 * np.eye(A.shape[1])
    lam[0, 0] = 0
    try:
        coeffs = np.linalg.solve(A.T @ A + lam, A.T @ y_train)
    except np.linalg.LinAlgError:
        coeffs, _, _, _ = np.linalg.lstsq(A, y_train, rcond=None)
    return coeffs


def _predict_numpy(coeffs: np.ndarray, X: np.ndarray, poly2: bool) -> np.ndarray:
    A = _build_design_numpy(X, poly2)
    return A @ coeffs


# ----- Model selection: HGBR primary (fixed params), then GBR, Ridge+Poly2, numpy -----

# Primary HGBR params: simple and effective, fast runtime (no grid search)
# min_samples_leaf relaxed when train set is small so HGBR can fit
def _hgb_params(n_train: int) -> dict[str, Any]:
    return {
        "max_depth": 3,
        "learning_rate": 0.05,
        "max_leaf_nodes": 31,
        "min_samples_leaf": min(20, max(1, n_train // 5)),
        "l2_regularization": 0.1,
    }


def _select_model(
    X: np.ndarray,
    y_delta: np.ndarray,
    prev_depths: np.ndarray,
    later_years: np.ndarray,
    feature_names: list[str],
    delta_clip_lo: float,
    delta_clip_hi: float,
) -> tuple[Any, str, dict[str, Any], bool]:
    """
    When sklearn is available: HistGradientBoostingRegressor (primary) with fixed params,
    then GradientBoostingRegressor, then Ridge+Poly2+StandardScaler. Otherwise numpy Ridge+poly2.
    Rolling backtest runs for evaluation; metrics stored in ml_model.metrics.
    Returns (model_obj, model_type, metrics, use_sklearn).
    """
    use_sklearn = False
    try:
        import sklearn  # noqa: F401
        use_sklearn = True
    except ImportError:
        pass

    metrics: dict[str, Any] = {}
    best_model: Any = None
    best_type = "numpy_ridge_poly2"

    if use_sklearn:
        # Primary: HistGradientBoostingRegressor with fixed strong params
        hgb_params = _hgb_params(len(X))
        try:
            best_model = _fit_sklearn_hgb(X, y_delta, **hgb_params)
            best_type = "HistGradientBoostingRegressor"
            metrics, _ = _rolling_backtest(
                X, y_delta, prev_depths, later_years,
                lambda a, b: _fit_sklearn_hgb(a, b, **_hgb_params(len(a))), _predict_sklearn,
                delta_clip_lo, delta_clip_hi,
            )
            return best_model, best_type, metrics, True
        except Exception:
            pass
        # Fallback: GradientBoostingRegressor
        try:
            best_model = _fit_sklearn_gbr(X, y_delta)
            best_type = "GradientBoostingRegressor"
            metrics, _ = _rolling_backtest(
                X, y_delta, prev_depths, later_years,
                _fit_sklearn_gbr, _predict_sklearn,
                delta_clip_lo, delta_clip_hi,
            )
            return best_model, best_type, metrics, True
        except Exception:
            pass
        # Fallback: Ridge + PolynomialFeatures(degree=2) + StandardScaler
        try:
            best_model = _fit_sklearn_ridge_poly(X, y_delta)
            best_type = "Ridge_Poly2_StandardScaler"
            metrics, _ = _rolling_backtest(
                X, y_delta, prev_depths, later_years,
                _fit_sklearn_ridge_poly, _predict_sklearn,
                delta_clip_lo, delta_clip_hi,
            )
            return best_model, best_type, metrics, True
        except Exception:
            use_sklearn = False

    # Numpy fallback when sklearn missing or all sklearn models failed
    if not use_sklearn or best_model is None:
        try:
            best_model = _fit_numpy_ridge(X, y_delta, poly2=True)
            best_type = "numpy_ridge_poly2"
            metrics, _ = _rolling_backtest(
                X, y_delta, prev_depths, later_years,
                lambda a, b: _fit_numpy_ridge(a, b, True),
                lambda c, x: _predict_numpy(c, x, True),
                delta_clip_lo, delta_clip_hi,
            )
        except Exception:
            best_model = _fit_numpy_ridge(X, y_delta, poly2=False)
            best_type = "numpy_ridge_linear"
            metrics, _ = _rolling_backtest(
                X, y_delta, prev_depths, later_years,
                lambda a, b: _fit_numpy_ridge(a, b, False),
                lambda c, x: _predict_numpy(c, x, False),
                delta_clip_lo, delta_clip_hi,
            )
        return best_model, best_type, metrics, False

    return best_model, best_type, metrics, use_sklearn


def _predict_model_delta(
    model_obj: Any,
    X: np.ndarray,
    model_type: str,
    poly2: bool = True,
) -> np.ndarray:
    """Predict y_delta. For sklearn use .predict; for numpy use design matrix."""
    if hasattr(model_obj, "predict"):
        return np.asarray(model_obj.predict(X), dtype=float)
    return _predict_numpy(model_obj, X, poly2)


def run_ml_projection(
    matches_df: pd.DataFrame,
    base_year: int,
    target_years: list[int],
) -> dict[str, Any]:
    """
    Per-anomaly ML: train on y_delta = later_depth - prev_depth; rolling backtest;
    project each anomaly as latest_depth + pred_delta(...), clamped [0, 100].
    """
    if matches_df is None or len(matches_df) == 0:
        _sklearn_version: str | None = None
        try:
            import sklearn
            _sklearn_version = getattr(sklearn, "__version__", None)
        except ImportError:
            pass
        return {
            "target_years": list(target_years),
            "ml_predictions": {},
            "ml_model": {
                "type": "none",
                "features": [],
                "train_rows": 0,
                "metrics": {},
                "sklearn_version": _sklearn_version,
                "backend_pid": os.getpid(),
                "model_params": None,
            },
            "ml_notes": "No training data (empty or missing matches).",
            "ml_predictions_by_anomaly": {str(ty): [] for ty in target_years},
            "ml_summary": {str(ty): {"mean": None, "median": None, "p90": None, "high_risk_count": 0} for ty in target_years},
        }

    X, y_delta, prev_depths, prev_years, later_years, anomaly_ids, slopes, feature_names, _ = _build_feature_matrix_delta(matches_df)
    train_rows = len(X)
    if train_rows < 2:
        _sklearn_version = None
        try:
            import sklearn
            _sklearn_version = getattr(sklearn, "__version__", None)
        except ImportError:
            pass
        return {
            "target_years": list(target_years),
            "ml_predictions": {str(ty): None for ty in target_years},
            "ml_model": {
                "type": "none",
                "features": feature_names,
                "train_rows": train_rows,
                "metrics": {},
                "sklearn_version": _sklearn_version,
                "backend_pid": os.getpid(),
                "model_params": None,
            },
            "ml_notes": "Need at least 2 rows for training.",
            "ml_predictions_by_anomaly": {str(ty): [] for ty in target_years},
            "ml_summary": {str(ty): {"mean": None, "median": None, "p90": None, "high_risk_count": 0} for ty in target_years},
        }

    # ----- Two-stage robust annual-growth model (demo-ready; 2030 != 2040 via horizons) -----
    (
        annual_rate_global,
        annual_rate_by_bin,
        annual_p5,
        annual_p95,
        rows_meta,
        _annual_per_row,
        _prev_depths_arr,
    ) = _compute_robust_annual_stage1(matches_df)

    # Optional: use HGBR for annual prediction only if it beats robust median
    hgbr_result, hgbr_type, hgbr_metrics = _try_annual_hgbr(
        matches_df, rows_meta, annual_p5, annual_p95, target_years,
    )
    if hgbr_result is not None and hgbr_type == "annual_hgbr":
        predictions_by_year = hgbr_result
        model_type = "annual_hgbr"
        metrics = hgbr_metrics
        robust_features = ["latest_depth", "horizon", "slope", "annual_rate_pred"]
    else:
        predictions_by_year = _project_robust_annual_stage2(
            rows_meta, annual_rate_global, annual_rate_by_bin, annual_p5, annual_p95, target_years,
        )
        model_type = "robust_annual_growth_model"
        metrics = {
            "annual_rate_global": round(annual_rate_global, 4),
            "annual_p5": round(annual_p5, 4),
            "annual_p95": round(annual_p95, 4),
            "rolling_folds": 0,
        }
        robust_features = ["latest_depth_bin", "annual_rate", "horizon"]

    ml_predictions: dict[str, float] = {}
    for ty in target_years:
        depths = [p["depth"] for p in predictions_by_year[str(ty)] if p.get("depth") is not None]
        ml_predictions[str(ty)] = round(float(np.mean(depths)), 2) if depths else None

    ml_summary: dict[str, dict[str, Any]] = {}
    for ty in target_years:
        depths_arr = np.array([p["depth"] for p in predictions_by_year[str(ty)] if p.get("depth") is not None], dtype=float)
        if len(depths_arr) == 0:
            ml_summary[str(ty)] = {"mean": None, "median": None, "p90": None, "high_risk_count": 0}
        else:
            ml_summary[str(ty)] = {
                "mean": round(float(np.mean(depths_arr)), 2),
                "median": round(float(np.median(depths_arr)), 2),
                "p90": round(float(np.percentile(depths_arr, 90)), 2),
                "high_risk_count": int(np.sum(depths_arr >= HIGH_RISK_DEPTH)),
            }

    ml_notes = (
        "Robust annual-growth model; depth-binned median annual growth; horizons applied per anomaly; "
        "no rolling metrics due to limited year diversity."
    )
    if model_type == "annual_hgbr":
        ml_notes = (
            "Annual HGBR model (predicts annual rate from depth/horizon/slope); "
            "horizons applied per anomaly; no rolling metrics due to limited year diversity."
        )

    sklearn_version: str | None = None
    try:
        import sklearn
        sklearn_version = getattr(sklearn, "__version__", None)
    except ImportError:
        pass
    model_params: dict[str, Any] | None = None
    model_obj: Any = None
    if hgbr_result is not None and model_type == "annual_hgbr":
        try:
            from sklearn.ensemble import HistGradientBoostingRegressor
            model_obj = HistGradientBoostingRegressor(max_iter=150, max_depth=3, min_samples_leaf=10, random_state=42)
        except ImportError:
            pass
    if model_obj is not None and hasattr(model_obj, "get_params"):
        try:
            model_params = model_obj.get_params()
        except Exception:
            model_params = None

    if os.environ.get("ML_DEBUG") == "1":
        import sys
        print(
            f"[ML_DEBUG] type={model_type} sklearn_version={sklearn_version} backend_pid={os.getpid()}",
            file=sys.stderr,
        )

    return {
        "target_years": list(target_years),
        "ml_predictions": ml_predictions,
        "ml_model": {
            "type": model_type,
            "features": robust_features,
            "train_rows": train_rows,
            "metrics": metrics,
            "sklearn_version": sklearn_version,
            "backend_pid": os.getpid(),
            "model_params": model_params,
        },
        "ml_notes": ml_notes,
        "ml_predictions_by_anomaly": predictions_by_year,
        "ml_summary": ml_summary,
    }
