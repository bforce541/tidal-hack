"""
Presentation layer: human-readable column names, units, and ordering for pipeline outputs.
Machine CSVs stay unchanged; *_human.csv versions use this module.
"""

from __future__ import annotations

import pandas as pd

# Maps machine column name -> human label (with units where relevant)
MATCHES_HUMAN_COLUMNS = {
    "prev_idx": "Previous Run Anomaly ID",
    "later_idx": "Later Run Anomaly ID",
    "prev_year": "Previous Run Year",
    "later_year": "Later Run Year",
    "prev_distance_raw_m": "Previous Distance (m)",
    "later_distance_raw_m": "Later Distance (m)",
    "prev_distance_corrected_m": "Previous Distance Corrected (m)",
    "later_distance_corrected_m": "Later Distance Corrected (m)",
    "delta_distance_m": "Distance Change (m)",
    "prev_depth_percent": "Previous Depth (%)",
    "later_depth_percent": "Later Depth (%)",
    "prev_length_mm": "Previous Length (mm)",
    "later_length_mm": "Later Length (mm)",
    "prev_width_mm": "Previous Width (mm)",
    "later_width_mm": "Later Width (mm)",
    "score": "Match Score",
    "reason_flags": "Notes",
    "years": "Years Between Runs",
    "depth_rate": "Depth Rate (%/yr)",
    "length_rate": "Length Rate (mm/yr)",
    "width_rate": "Width Rate (mm/yr)",
    "growth_flag": "Growth Flag",
}

# Optional: generic renames for New/Missing/Ambiguous and other tables (subset of schema names)
GENERIC_HUMAN_COLUMNS = {
    "distance_raw_m": "Distance (m)",
    "distance_corrected_m": "Distance Corrected (m)",
    "depth_percent": "Depth (%)",
    "length_mm": "Length (mm)",
    "width_mm": "Width (mm)",
    "clock_position_deg": "Clock (deg)",
    "feature_type": "Feature Type",
    "joint_number": "Joint Number",
    "run_year": "Run Year",
    "row_index": "Row Index",
    "prev_idx": "Previous Run Anomaly ID",
    "later_idx": "Later Run Anomaly ID",
    "prev_year": "Previous Run Year",
    "later_year": "Later Run Year",
    "prev_distance_raw_m": "Previous Distance (m)",
    "later_distance_raw_m": "Later Distance (m)",
    "prev_distance_corrected_m": "Previous Distance Corrected (m)",
    "later_distance_corrected_m": "Later Distance Corrected (m)",
    "delta_distance_m": "Distance Change (m)",
    "prev_depth_percent": "Previous Depth (%)",
    "later_depth_percent": "Later Depth (%)",
    "prev_length_mm": "Previous Length (mm)",
    "later_length_mm": "Later Length (mm)",
    "prev_width_mm": "Previous Width (mm)",
    "later_width_mm": "Later Width (mm)",
    "score": "Match Score",
    "reason_flags": "Notes",
    "years": "Years Between Runs",
    "depth_rate": "Depth Rate (%/yr)",
    "length_rate": "Length Rate (mm/yr)",
    "width_rate": "Width Rate (mm/yr)",
    "growth_flag": "Growth Flag",
}

# Columns that should be rounded (distance: 3 decimals, rates: 3 decimals)
DISTANCE_COLUMNS = {
    "prev_distance_raw_m", "later_distance_raw_m",
    "prev_distance_corrected_m", "later_distance_corrected_m",
    "delta_distance_m", "distance_raw_m", "distance_corrected_m",
}
RATE_COLUMNS = {"depth_rate", "length_rate", "width_rate"}
DECIMAL_3 = DISTANCE_COLUMNS | RATE_COLUMNS | {"score"}


def format_for_humans(
    df: pd.DataFrame,
    column_map: dict[str, str] | None = None,
    preferred_order: list[str] | None = None,
) -> pd.DataFrame:
    """
    Make a DataFrame human-readable:
    - Rename columns via column_map (only mapped columns renamed)
    - Reorder columns into preferred_order (missing columns appended at end)
    - Round numeric columns (distance/rate to 3 decimals)
    - Replace "—" and empty string with NaN for numeric cols; leave as-is for others
    """
    if df is None or len(df) == 0:
        return df.copy() if df is not None else pd.DataFrame()
    out = df.copy()
    # Replace "—" with NaN
    for c in out.columns:
        if out[c].dtype == object:
            out[c] = out[c].replace("—", pd.NA).replace("", pd.NA)
    # Round numerics (before rename, using machine names)
    for c in out.columns:
        if c in DECIMAL_3:
            try:
                out[c] = pd.to_numeric(out[c], errors="coerce")
                if out[c].notna().any():
                    out[c] = out[c].round(3)
            except Exception:
                pass
    mapping = column_map or {}
    rename = {k: v for k, v in mapping.items() if k in out.columns}
    out = out.rename(columns=rename)
    # Reorder
    if preferred_order:
        order = [c for c in preferred_order if c in out.columns]
        rest = [c for c in out.columns if c not in order]
        out = out[order + rest]
    return out


def matches_human_preferred_order(prev_year: int, later_year: int) -> list[str]:
    """Preferred column order (human names) for Matches human CSV."""
    return [
        f"{prev_year} Anomaly ID",
        f"{later_year} Anomaly ID",
        "Previous Run Year",
        "Later Run Year",
        "Previous Distance (m)",
        "Later Distance (m)",
        f"{prev_year} Distance (Aligned, m)",
        f"{later_year} Distance (m)",
        "Distance Difference (m)",
        f"{prev_year} Depth (%)",
        f"{later_year} Depth (%)",
        "Previous Length (mm)",
        "Later Length (mm)",
        "Previous Width (mm)",
        "Later Width (mm)",
        "Years Between Runs",
        "Depth Rate (%/yr)",
        "Length Rate (mm/yr)",
        "Width Rate (mm/yr)",
        "Growth Flag",
        "Match Quality",
        "Needs Review",
    ]


def human_columns_for_matches(prev_year: int, later_year: int) -> dict[str, str]:
    """Column map for Matches table; use year-specific labels for IDs and distance/depth."""
    m = dict(MATCHES_HUMAN_COLUMNS)
    m["prev_idx"] = f"{prev_year} Anomaly ID"
    m["later_idx"] = f"{later_year} Anomaly ID"
    m["prev_distance_corrected_m"] = f"{prev_year} Distance (Aligned, m)"
    m["later_distance_corrected_m"] = f"{later_year} Distance (m)"
    m["delta_distance_m"] = "Distance Difference (m)"
    m["prev_depth_percent"] = f"{prev_year} Depth (%)"
    m["later_depth_percent"] = f"{later_year} Depth (%)"
    m["score"] = "Match Quality"
    m["reason_flags"] = "Needs Review"
    return m
