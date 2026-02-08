"""
Continued issues: chain 2007→2015 and 2015→2022 matches to get issues present across all three runs.
Used by POST /api/pipeline/run-all.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def _pick_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def compute_continued_issues(
    matches_2007_2015_path: Path,
    matches_2015_2022_path: Path,
) -> tuple[pd.DataFrame, str]:
    """
    Join matches 2007→2015 and 2015→2022 on the 2015 anomaly ID to get continued issues (2007→2015→2022).
    Returns (dataframe with one row per continued issue, summary_text).
    """
    if not matches_2007_2015_path.exists() or not matches_2015_2022_path.exists():
        return pd.DataFrame(), "Missing one or both matches files."
    try:
        m1 = pd.read_csv(matches_2007_2015_path)
        m2 = pd.read_csv(matches_2015_2022_path)
    except Exception as e:
        return pd.DataFrame(), f"Failed to read matches: {e}"
    if len(m1) == 0 or len(m2) == 0:
        return pd.DataFrame(), "One or both matches files are empty."

    # Join key: 2015 anomaly ID (later in first = prev in second)
    key_candidates_1 = ["2015 Anomaly ID", "later_idx", "Later Run Anomaly ID"]
    key_candidates_2 = ["2015 Anomaly ID", "prev_idx", "Previous Run Anomaly ID"]
    key1 = _pick_col(m1, key_candidates_1)
    key2 = _pick_col(m2, key_candidates_2)
    if not key1 or not key2:
        return pd.DataFrame(), "Could not find 2015 anomaly ID column in one or both matches."
    m1_key = m1[key1].astype(str).str.strip()
    m2_key = m2[key2].astype(str).str.strip()
    merged = m1.merge(
        m2,
        left_on=key1,
        right_on=key2,
        how="inner",
        suffixes=("_07_15", "_15_22"),
    )
    if len(merged) == 0:
        return pd.DataFrame(), "No continued issues (no matching 2015 anomaly IDs between the two pairs)."

    # Build output table: prefer ID columns with suffixes, then include key metrics
    id_2007 = _pick_col(merged, ["2007 Anomaly ID_07_15", "prev_idx_07_15", "2007 Anomaly ID"])
    id_2015 = _pick_col(merged, [f"{key1}_07_15", key1, f"{key2}_15_22", key2])
    id_2022 = _pick_col(merged, ["2022 Anomaly ID_15_22", "later_idx_15_22", "2022 Anomaly ID"])
    out_cols = []
    if id_2007:
        merged["continued_2007_id"] = merged[id_2007]
        out_cols.append("continued_2007_id")
    if id_2015:
        merged["continued_2015_id"] = merged[id_2015]
        out_cols.append("continued_2015_id")
    if id_2022:
        merged["continued_2022_id"] = merged[id_2022]
        out_cols.append("continued_2022_id")
    for col in merged.columns:
        if col in out_cols or col.startswith("continued_"):
            continue
        if col in (key1, key2):
            continue
        out_cols.append(col)
    out_cols = [c for c in out_cols if c in merged.columns]
    result = merged[out_cols].copy() if out_cols else merged.copy()

    summary_lines = [
        "CONTINUED ISSUES — 2007 → 2015 → 2022",
        "",
        f"Matches 2007→2015: {len(m1)} rows",
        f"Matches 2015→2022: {len(m2)} rows",
        f"Continued issues (chained on 2015 anomaly ID): {len(result)} rows",
        "",
    ]
    summary_text = "\n".join(summary_lines)
    return result, summary_text
