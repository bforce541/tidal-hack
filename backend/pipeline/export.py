"""
Export pipeline outputs to Excel (e.g. projections.xlsx).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


ASSUMPTIONS_TEXT = [
    "Projections are linear extrapolations.",
    "Based only on historical inspection data.",
    "Intended for prioritization, not guarantees.",
]


def write_projections_excel(
    projections_by_year: dict[int, pd.DataFrame],
    out_path: Path,
) -> None:
    """
    Write projections.xlsx with sheets: Projections_2030, Projections_2040, Assumptions, Summary.
    """
    with pd.ExcelWriter(out_path, engine="openpyxl") as w:
        for target_year, df in sorted(projections_by_year.items()):
            sheet_name = f"Projections_{target_year}"[:31]
            df.to_excel(w, sheet_name=sheet_name, index=False)
        assumptions_df = pd.DataFrame({
            "Assumption": ASSUMPTIONS_TEXT,
        })
        assumptions_df.to_excel(w, sheet_name="Assumptions", index=False)
        if projections_by_year:
            first = next(iter(projections_by_year.values()))
            summary_rows = [
                {"Metric": "Total projected anomalies", "Value": len(first)},
                {"Metric": "Target years", "Value": ", ".join(str(y) for y in sorted(projections_by_year.keys()))},
            ]
        else:
            summary_rows = [
                {"Metric": "Total projected anomalies", "Value": 0},
                {"Metric": "Target years", "Value": ""},
            ]
        pd.DataFrame(summary_rows).to_excel(w, sheet_name="Summary", index=False)
