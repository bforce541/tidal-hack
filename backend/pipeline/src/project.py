"""
Future projections: linear extrapolation from matched anomalies only.
Deterministic, no ML. Uses historical growth rate to project depth to target years.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


# Column names in pipeline Matches CSV (machine)
COL_PREV_IDX = "prev_idx"
COL_LATER_IDX = "later_idx"
COL_PREV_YEAR = "prev_year"
COL_LATER_YEAR = "later_year"
COL_PREV_DEPTH = "prev_depth_percent"
COL_LATER_DEPTH = "later_depth_percent"
COL_DEPTH_RATE = "depth_rate"
COL_DISTANCE = "later_distance_corrected_m"


def _growth_rate_per_year(row: pd.Series) -> float | None:
    """Depth growth rate %/year from row. Prefer depth_rate if present else compute."""
    if COL_DEPTH_RATE in row.index and pd.notna(row.get(COL_DEPTH_RATE)):
        return float(row[COL_DEPTH_RATE])
    prev_y = row.get(COL_PREV_YEAR)
    later_y = row.get(COL_LATER_YEAR)
    prev_d = row.get(COL_PREV_DEPTH)
    later_d = row.get(COL_LATER_DEPTH)
    if pd.isna(prev_y) or pd.isna(later_y) or pd.isna(prev_d) or pd.isna(later_d):
        return None
    years = int(later_y) - int(prev_y)
    if years <= 0:
        return None
    return (float(later_d) - float(prev_d)) / years


def compute_projections(
    matches_df: pd.DataFrame,
    base_year: int,
    target_years: list[int],
    high_growth_p90: bool = True,
) -> dict[int, pd.DataFrame]:
    """
    For each matched row, compute growth_rate and projected depth for each target year.
    Returns { 2030: df, 2040: df } with columns:
    anomaly_id_prev, anomaly_id_curr, aligned_distance_m, depth_prev, depth_curr,
    growth_rate_per_year, projected_depth, confidence_flag, notes
    """
    if matches_df is None or len(matches_df) == 0:
        return {ty: _empty_projections_df() for ty in target_years}

    growth_rates = matches_df.apply(_growth_rate_per_year, axis=1)
    rates_valid = growth_rates.dropna()
    p90 = float(rates_valid.quantile(0.9)) if len(rates_valid) > 0 else 0.0

    result = {}
    for target_year in target_years:
        rows = []
        for _, row in matches_df.iterrows():
            gr = _growth_rate_per_year(row)
            depth_curr = row.get(COL_LATER_DEPTH)
            later_y = row.get(COL_LATER_YEAR)
            if pd.isna(depth_curr) or pd.isna(later_y):
                continue
            depth_curr_f = float(depth_curr)
            later_y_int = int(later_y)
            years_ahead = target_year - later_y_int
            if gr is not None:
                projected = depth_curr_f + gr * years_ahead
            else:
                projected = depth_curr_f
            projected = max(0.0, min(100.0, projected))

            flags = []
            if gr is not None:
                if gr < 0:
                    flags.append("negative_growth")
                if high_growth_p90 and gr is not None and len(rates_valid) > 0 and gr > p90:
                    flags.append("high_growth")
            confidence_flag = ";".join(flags) if flags else ""
            notes = ""
            if gr is None:
                notes = "missing_growth_rate"

            rows.append({
                "anomaly_id_prev": row.get(COL_PREV_IDX),
                "anomaly_id_curr": row.get(COL_LATER_IDX),
                "aligned_distance_m": row.get(COL_DISTANCE),
                "depth_prev": row.get(COL_PREV_DEPTH),
                "depth_curr": depth_curr_f,
                "growth_rate_per_year": gr,
                "projected_depth": round(projected, 2),
                "confidence_flag": confidence_flag,
                "notes": notes,
            })
        result[target_year] = pd.DataFrame(rows)
    return result


def _empty_projections_df() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "anomaly_id_prev", "anomaly_id_curr", "aligned_distance_m",
        "depth_prev", "depth_curr", "growth_rate_per_year", "projected_depth",
        "confidence_flag", "notes",
    ])


def load_matches_for_job(tables_dir: Path) -> tuple[pd.DataFrame | None, int | None, int | None]:
    """
    Load Matches_<prev>_<later>.csv from job tables dir (machine CSV, not _human).
    Returns (matches_df, prev_year, later_year) or (None, None, None) if not found.
    """
    if not tables_dir.exists():
        return None, None, None
    pattern = re.compile(r"^Matches_(\d+)_(\d+)\.csv$")
    for path in tables_dir.iterdir():
        if path.is_file() and pattern.match(path.name):
            m = pattern.match(path.name)
            prev_y, later_y = int(m.group(1)), int(m.group(2))
            df = pd.read_csv(path)
            return df, prev_y, later_y
    return None, None, None


def build_visual_series(
    matches_df: pd.DataFrame,
    prev_year: int,
    later_year: int,
    target_years: list[int],
) -> list[dict]:
    """
    Flatten to one time-series point per (anomaly, year) for charts.
    Returns list of { "anomaly_id": str, "year": int, "depth": float, "growth_rate": float | null, "flags": list[str] }.
    """
    if matches_df is None or len(matches_df) == 0:
        return []
    growth_rates = matches_df.apply(_growth_rate_per_year, axis=1)
    rates_valid = growth_rates.dropna()
    p90 = float(rates_valid.quantile(0.9)) if len(rates_valid) > 0 else 0.0
    out = []
    for _, row in matches_df.iterrows():
        gr = _growth_rate_per_year(row)
        depth_prev = row.get(COL_PREV_DEPTH)
        depth_curr = row.get(COL_LATER_DEPTH)
        if pd.isna(depth_curr):
            continue
        depth_curr_f = float(depth_curr)
        depth_prev_f = float(depth_prev) if pd.notna(depth_prev) else depth_curr_f
        later_y_int = int(row.get(COL_LATER_YEAR))
        anomaly_id = str(int(row.get(COL_LATER_IDX, 0)))
        flags = []
        if gr is not None:
            if gr < 0:
                flags.append("negative_growth")
            if len(rates_valid) > 0 and gr > p90:
                flags.append("high_growth")
        cf = (row.get("confidence_flag") or "")
        if cf:
            flags.extend(s.strip() for s in str(cf).split(";") if s.strip())
        flags = list(dict.fromkeys(flags))
        # Historical points
        out.append({
            "anomaly_id": anomaly_id,
            "year": prev_year,
            "depth": round(float(depth_prev_f), 2),
            "growth_rate": round(gr, 4) if gr is not None else None,
            "flags": flags,
        })
        out.append({
            "anomaly_id": anomaly_id,
            "year": later_y_int,
            "depth": round(depth_curr_f, 2),
            "growth_rate": round(gr, 4) if gr is not None else None,
            "flags": flags,
        })
        # Projected points
        for ty in target_years:
            years_ahead = ty - later_y_int
            if gr is not None:
                proj = depth_curr_f + gr * years_ahead
            else:
                proj = depth_curr_f
            proj = max(0.0, min(100.0, proj))
            out.append({
                "anomaly_id": anomaly_id,
                "year": ty,
                "depth": round(proj, 2),
                "growth_rate": round(gr, 4) if gr is not None else None,
                "flags": flags,
            })
    return out
