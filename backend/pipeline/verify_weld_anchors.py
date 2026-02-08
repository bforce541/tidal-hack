#!/usr/bin/env python3
"""
Verify weld-anchor logic: load a sheet (e.g. 2022), print value_counts for rows
containing "weld", and counts kept vs excluded by is_anchor_weld().
Run from backend/pipeline: python verify_weld_anchors.py --input ../public/sample_data/ILIDataV2.xlsx --sheet 2022
"""
import argparse
import sys
from pathlib import Path

# Run from pipeline dir so src is on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

from src.schema import FEATURE_TYPE, load_and_parse_runs
from src.align import is_anchor_weld, _has_weld_substring


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify weld anchor counts: value_counts and kept/excluded.")
    parser.add_argument("--input", "-i", required=True, help="Path to Excel file")
    parser.add_argument("--sheet", type=int, default=2022, help="Sheet name (year), e.g. 2022")
    args = parser.parse_args()
    path = Path(args.input)
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
