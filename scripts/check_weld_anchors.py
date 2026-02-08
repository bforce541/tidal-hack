#!/usr/bin/env python3
"""
Check weld-anchor logic: load a sheet (e.g. 2022) from ILIDataV2.xlsx and print
value_counts of Event Description for rows containing "weld", and counts kept vs
excluded by is_anchor_weld(). Demonstrates that "Seam Weld Manufacturing Anomaly"
is excluded (>0). Not wired into the production pipeline.
Run from repo root: python scripts/check_weld_anchors.py --input public/sample_data/ILIDataV2.xlsx --sheet 2022
"""
import argparse
import sys
from pathlib import Path

# Add backend/pipeline so we use the same schema and align logic
_repo_root = Path(__file__).resolve().parent.parent
_pipeline = _repo_root / "backend" / "pipeline"
if _pipeline.is_dir():
    sys.path.insert(0, str(_pipeline))
else:
    print("Error: backend/pipeline not found", file=sys.stderr)
    sys.exit(1)

import pandas as pd

from src.schema import FEATURE_TYPE, load_and_parse_runs
from src.align import is_anchor_weld, _has_weld_substring


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check weld anchors: value_counts and kept/excluded by is_anchor_weld()."
    )
    parser.add_argument("--input", "-i", required=True, help="Path to Excel file (e.g. ILIDataV2.xlsx)")
    parser.add_argument("--sheet", type=int, default=2022, help="Sheet name (year), e.g. 2022")
    args = parser.parse_args()
    path = Path(args.input)
    if not path.is_absolute():
        path = _repo_root / path
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        return 1
    year = args.sheet
    parsed, _ = load_and_parse_runs(path, [year])
    if year not in parsed:
        print(f"Error: sheet {year} not found", file=sys.stderr)
        return 1
    df = parsed[year]
    if FEATURE_TYPE not in df.columns:
        print(f"Error: column {FEATURE_TYPE} not in parsed data", file=sys.stderr)
        return 1
    col = df[FEATURE_TYPE]
    weld_mask = col.apply(_has_weld_substring)
    print("Event Description value_counts (rows containing 'weld'):")
    print(col[weld_mask].value_counts().to_string())
    print()
    kept = col.apply(is_anchor_weld)
    n_kept = int(kept.sum())
    n_excluded = int(weld_mask.sum()) - n_kept
    print("By is_anchor_weld():")
    print(f"  kept as girth weld anchors: {n_kept}")
    print(f"  excluded (e.g. seam weld): {n_excluded}")
    if n_excluded > 0:
        print("  (Seam Weld Manufacturing Anomaly / similar excluded as expected.)")
    else:
        print("  (No seam-weld rows in this sheet.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
