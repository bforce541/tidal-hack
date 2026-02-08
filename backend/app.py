"""
FastAPI wrapper for ILI MVP pipeline.
POST /run-mvp: upload Excel + runs → run pipeline → return summary + download_url
GET /download/{job_id}: return output.xlsx
GET /preview/{job_id}: return JSON preview from existing CSVs (read-only, no pipeline)
GET /health: health check
"""

import csv
import json
import subprocess
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="ILI MVP API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Backend root (where app.py lives)
BACKEND_ROOT = Path(__file__).resolve().parent
JOBS_DIR = BACKEND_ROOT / "jobs"
PIPELINE_DIR = BACKEND_ROOT / "pipeline"

# Ensure jobs dir exists
JOBS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health():
    return {"ok": True}


def _parse_runs(runs_str: str) -> list[int]:
    """Parse runs from '2007,2015' or '2015,2022' -> [2007, 2015] or [2015, 2022]."""
    s = (runs_str or "").strip()
    if not s:
        raise ValueError("runs is required (e.g. '2007,2015' or '2015,2022')")
    parts = [p.strip() for p in s.split(",") if p.strip()]
    if len(parts) != 2:
        raise ValueError("runs must be exactly two years (e.g. '2007,2015')")
    try:
        return [int(parts[0]), int(parts[1])]
    except ValueError:
        raise ValueError("runs must be integers (e.g. 2007, 2015)")


@app.post("/run-mvp")
async def run_mvp(
    file: UploadFile = File(...),
    runs: str = Form(...),
):
    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path = job_dir / "input.xlsx"

    try:
        runs_list = _parse_runs(runs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save uploaded file
    content = await file.read()
    input_path.write_bytes(content)

    # Run pipeline from backend/pipeline as cwd (use same interpreter as this app)
    cmd = [
        sys.executable,
        "run_ili.py",
        "--mode", "mvp",
        "--runs", str(runs_list[0]), str(runs_list[1]),
        "--input", str(input_path),
        "--output-dir", str(job_dir),
    ]
    try:
        result = subprocess.run(
            cmd,
            cwd=str(PIPELINE_DIR),
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        return {
            "error": True,
            "job_id": job_id,
            "message": "Pipeline timed out after 300s",
        }
    except Exception as e:
        return {
            "error": True,
            "job_id": job_id,
            "message": str(e),
        }

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip().split("\n")[-10:]
        return {
            "error": True,
            "job_id": job_id,
            "message": "Pipeline failed. " + ("; ".join(stderr_tail) if stderr_tail else result.stderr or "Unknown error"),
        }

    # Read summary.json (job_dir/tables/summary.json)
    summary_path = job_dir / "tables" / "summary.json"
    if not summary_path.exists():
        return {
            "error": True,
            "job_id": job_id,
            "message": "Pipeline completed but summary.json not found",
        }
    with open(summary_path) as f:
        summary = json.load(f)

    return {
        "job_id": job_id,
        "summary": summary,
        "download_url": f"/download/{job_id}",
    }


def _validate_job_id(job_id: str) -> None:
    if not job_id.replace("-", "").isalnum() or len(job_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid job_id")


@app.get("/download/{job_id}")
def download(job_id: str):
    _validate_job_id(job_id)
    path = JOBS_DIR / job_id / "output.xlsx"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Output not found for this job")
    return FileResponse(path, filename="output.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/preview/{job_id}")
def preview(
    job_id: str,
    limit: int = Query(50, ge=1, le=100),
    ambiguous_limit: int = Query(25, ge=1, le=50),
):
    """Read-only preview from existing CSVs under jobs/{job_id}/tables/. No pipeline run."""
    _validate_job_id(job_id)
    tables_dir = JOBS_DIR / job_id / "tables"
    if not tables_dir.exists():
        raise HTTPException(status_code=404, detail="Job output not found")
    summary_path = tables_dir / "summary.json"
    if not summary_path.exists():
        raise HTTPException(status_code=404, detail="Summary not found for this job")

    with open(summary_path) as f:
        summary = json.load(f)
    counts = summary.get("counts", {})

    def _read_csv_rows(glob_pattern: str, max_rows: int) -> list[dict]:
        files = list(tables_dir.glob(glob_pattern))
        if not files:
            return []
        path = files[0]
        rows = []
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= max_rows:
                    break
                rows.append(row)
        return rows

    matched_preview = _read_csv_rows("Matches_*.csv", limit)
    ambiguous_preview = _read_csv_rows("Ambiguous_*.csv", ambiguous_limit)

    return {
        "matched_preview": matched_preview,
        "ambiguous_preview": ambiguous_preview,
        "new_count": counts.get("new", 0),
        "missing_count": counts.get("missing", 0),
        "ambiguous_count": counts.get("ambiguous", 0),
        "matched_count": counts.get("matched", 0),
    }


@app.get("/schema/{job_id}")
def schema_report(job_id: str):
    """Return schema_report.json for this job (read-only)."""
    _validate_job_id(job_id)
    path = JOBS_DIR / job_id / "tables" / "schema_report.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Schema report not found for this job")
    with open(path) as f:
        return json.load(f)
