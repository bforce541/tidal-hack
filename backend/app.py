"""
FastAPI wrapper for ILI MVP pipeline.
POST /run-mvp: upload Excel + runs → run pipeline → return summary + download_url
GET /download/{job_id}: return output.xlsx
GET /preview/{job_id}: return JSON preview from existing CSVs (read-only, no pipeline)
GET /schema/{job_id}: return schema_report.json for job
POST /api/data-ready/run: run data readiness pipeline (inputPath, runs, debug)
GET /api/data-ready/files/<filename>: serve generated readiness file
GET /health: health check
"""

import csv
import json
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path

from summary_txt import build_summary_txt

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

# Backend root (where app.py lives); project root = parent (for resolving inputPath)
BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent
JOBS_DIR = BACKEND_ROOT / "jobs"
UPLOADS_DIR = BACKEND_ROOT / "uploads"
OUTPUT_MATCHING_DIR = BACKEND_ROOT / "output" / "matching"
PIPELINE_DIR = BACKEND_ROOT / "pipeline"
DATA_READY_DIR = BACKEND_ROOT / "data_ready"
DATA_READY_BUNDLE_ZIP = BACKEND_ROOT / "data_ready_bundle.zip"

# Upload limits (configurable)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB

# Allow only these filenames for GET /api/data-ready/files/<filename>
DATA_READY_ALLOWED_FILES = {"all_runs_clean.csv", "data_quality.csv", "schema_report.json", "README.md"}

# Ensure dirs exist
JOBS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_MATCHING_DIR.mkdir(parents=True, exist_ok=True)
DATA_READY_DIR.mkdir(parents=True, exist_ok=True)


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


# ---------- Uploads ----------

@app.post("/api/uploads")
async def api_uploads(file: UploadFile = File(...)):
    """
    Accept multipart/form-data file upload (.xlsx only, max 50MB).
    Saves to backend/uploads/<uuid>.xlsx and returns storedPath (relative to backend root) and originalName.
    """
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are allowed")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds {MAX_UPLOAD_BYTES // (1024*1024)}MB limit",
        )
    name = f"{uuid.uuid4()}.xlsx"
    path = UPLOADS_DIR / name
    path.write_bytes(content)
    return {
        "storedPath": f"uploads/{name}",
        "originalName": file.filename or "upload.xlsx",
    }


# ---------- Unified pipeline & file serving ----------

def _resolve_input_path(input_path: str) -> Path:
    """
    Resolve inputPath safely.
    - Reject path traversal (..).
    - If relative and starts with 'uploads/', resolve relative to BACKEND_ROOT.
    - Other relative paths resolve relative to PROJECT_ROOT (legacy sample paths).
    - Absolute paths must be under BACKEND_ROOT.
    """
    path_str = (input_path or "").strip()
    if not path_str:
        raise ValueError("inputPath is required")
    if ".." in path_str:
        raise ValueError("Invalid path: path traversal (..) is not allowed")
    p = Path(path_str)
    backend_resolved = BACKEND_ROOT.resolve()
    if p.is_absolute():
        resolved = p.resolve()
        try:
            resolved.relative_to(backend_resolved)
        except ValueError:
            raise ValueError("Absolute path must be under backend root") from None
        return resolved
    if path_str.startswith("uploads/") or path_str.startswith("uploads\\"):
        resolved = (BACKEND_ROOT / p).resolve()
        try:
            resolved.relative_to(backend_resolved)
        except ValueError:
            raise ValueError("Invalid path: uploads path escaped backend root") from None
        return resolved
    return (PROJECT_ROOT / p).resolve()


def _build_data_ready_bundle() -> None:
    """Zip data_ready/ contents into data_ready_bundle.zip."""
    paths = [
        DATA_READY_DIR / "all_runs_clean.csv",
        DATA_READY_DIR / "data_quality.csv",
        DATA_READY_DIR / "schema_report.json",
        DATA_READY_DIR / "README.md",
    ]
    with zipfile.ZipFile(DATA_READY_BUNDLE_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in paths:
            if p.exists():
                zf.write(p, p.name)


def _read_matches_preview(matches_csv_path: Path, limit: int) -> list[dict]:
    """Read first `limit` rows of matches CSV as list of dicts."""
    if not matches_csv_path.exists():
        return []
    rows = []
    with open(matches_csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append({k: (v if v != "" else None) for k, v in row.items()})
    return rows


@app.post("/api/pipeline/run")
def api_pipeline_run(body: dict):
    """
    Single pipeline endpoint. Body: { inputPath: str, runs: number[], debug?: bool }.
    Runs alignment + matching + growth. Writes matches_<prev>_<later>.csv and summary_<prev>_<later>.txt
    to output/matching/. Returns status, outputs (matches_csv, summary_txt), preview, metrics.
    """
    input_path = body.get("inputPath")
    runs = body.get("runs")
    debug = bool(body.get("debug", False))

    if not input_path or not isinstance(input_path, str):
        raise HTTPException(status_code=400, detail="inputPath (string) is required")
    if not runs or not isinstance(runs, list):
        raise HTTPException(status_code=400, detail="runs (list of integers) is required")
    try:
        runs_list = [int(r) for r in runs]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="runs must be a list of integers")
    if len(runs_list) != 2:
        raise HTTPException(status_code=400, detail="runs must be exactly two years (e.g. [2015, 2022])")

    try:
        resolved = _resolve_input_path(input_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not resolved.exists():
        raise HTTPException(status_code=400, detail=f"Input path does not exist: {resolved}")

    job_id = str(uuid.uuid4())
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        "run_ili.py",
        "--mode", "mvp",
        "--runs", str(runs_list[0]), str(runs_list[1]),
        "--input", str(resolved),
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
        raise HTTPException(status_code=504, detail="Pipeline timed out after 300s")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if result.returncode != 0:
        stderr_tail = (result.stderr or "").strip().split("\n")[-10:]
        raise HTTPException(
            status_code=422,
            detail="Pipeline failed. " + ("; ".join(stderr_tail) if stderr_tail else result.stderr or "Unknown error"),
        )

    tables_dir = job_dir / "tables"
    summary_path = tables_dir / "summary.json"
    if not summary_path.exists():
        raise HTTPException(status_code=500, detail="Pipeline completed but summary.json not found")
    with open(summary_path) as f:
        summary = json.load(f)

    prev_year, later_year = sorted(runs_list)
    counts = summary.get("counts") or {}
    matched = int(counts.get("matched", 0))
    new_count = int(counts.get("new", 0))
    missing = int(counts.get("missing", 0))
    ambiguous = int(counts.get("ambiguous", 0))
    match_rate = float(summary.get("match_rate_pct") or 0)

    # Write to output/matching/ with deterministic names
    human_csv_name = f"Matches_{prev_year}_{later_year}_human.csv"
    human_src = tables_dir / human_csv_name
    matches_filename = f"matches_{prev_year}_{later_year}.csv"
    summary_filename = f"summary_{prev_year}_{later_year}.txt"
    matches_dest = OUTPUT_MATCHING_DIR / matches_filename
    summary_dest = OUTPUT_MATCHING_DIR / summary_filename
    if human_src.exists():
        shutil.copy2(human_src, matches_dest)
    summary_text = build_summary_txt(tables_dir, prev_year, later_year, summary)
    summary_dest.write_text(summary_text, encoding="utf-8")

    # Preview: first 25 rows of matches
    preview_matches_path = matches_dest if matches_dest.exists() else human_src
    matches_rows = _read_matches_preview(preview_matches_path, 25)

    outputs = {
        "matches_csv": f"/api/files/{matches_filename}",
        "summary_txt": f"/api/files/{summary_filename}",
    }
    preview = {
        "matches_rows": matches_rows,
        "summary_text": summary_text,
    }
    metrics = {
        "matched": matched,
        "new_or_unmatched": new_count,
        "missing": missing,
        "ambiguous": ambiguous,
        "match_rate": match_rate,
    }
    return {
        "status": "ok",
        "job_id": job_id,
        "outputs": outputs,
        "preview": preview,
        "metrics": metrics,
    }


# Allowlist for pipeline output files (only these are served to UI)
MATCHES_CSV_PATTERN = re.compile(r"^matches_\d+_\d+\.csv$")
SUMMARY_TXT_PATTERN = re.compile(r"^summary_\d+_\d+\.txt$")


def _allowed_output_filename(filename: str) -> bool:
    """Only allow matches_<prev>_<later>.csv and summary_<prev>_<later>.txt."""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return False
    return bool(MATCHES_CSV_PATTERN.match(filename) or SUMMARY_TXT_PATTERN.match(filename))


@app.get("/api/files/{filename}")
def api_files_output(filename: str):
    """Serve pipeline output files: only matches_<prev>_<later>.csv and summary_<prev>_<later>.txt."""
    if not _allowed_output_filename(filename):
        raise HTTPException(status_code=404, detail="File not found")
    path = OUTPUT_MATCHING_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    media_types = {"csv": "text/csv", "txt": "text/plain"}
    ext = path.suffix.lower().lstrip(".")
    return FileResponse(path, filename=filename, media_type=media_types.get(ext, "application/octet-stream"))


@app.get("/api/pipeline/preview")
def api_pipeline_preview(
    limit: int = Query(25, ge=1, le=100),
    prev_year: int = Query(..., description="Previous run year"),
    later_year: int = Query(..., description="Later run year"),
):
    """Return matches_rows (first N rows) and full summary_text for the given run pair."""
    matches_filename = f"matches_{prev_year}_{later_year}.csv"
    summary_filename = f"summary_{prev_year}_{later_year}.txt"
    matches_path = OUTPUT_MATCHING_DIR / matches_filename
    summary_path = OUTPUT_MATCHING_DIR / summary_filename
    if not matches_path.exists():
        raise HTTPException(status_code=404, detail="No matching output for this run pair; run pipeline first")
    matches_rows = _read_matches_preview(matches_path, limit)
    summary_text = summary_path.read_text(encoding="utf-8") if summary_path.exists() else ""
    return {"matches_rows": matches_rows, "summary_text": summary_text}


def _allowed_job_filename(filename: str) -> bool:
    """Allow only safe filenames (no path traversal)."""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return False
    return filename.endswith((".csv", ".json")) or filename in ("output.xlsx", "projections.xlsx")


@app.post("/project")
def project(body: dict):
    """
    Generate 2030/2040 projections from matched anomalies for a job.
    Body: { "job_id": str, "target_years": [2030, 2040] }.
    Uses matches CSV for that job; base_year is inferred from run.
    Returns download_url and preview (first 20 rows of 2030).
    """
    job_id = body.get("job_id")
    target_years = body.get("target_years")
    if not job_id or not isinstance(job_id, str):
        raise HTTPException(status_code=400, detail="job_id (string) is required")
    if not target_years or not isinstance(target_years, list):
        raise HTTPException(status_code=400, detail="target_years (list, e.g. [2030, 2040]) is required")
    try:
        target_years = [int(y) for y in target_years]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="target_years must be integers")
    _validate_job_id(job_id)
    tables_dir = JOBS_DIR / job_id / "tables"
    if not tables_dir.exists():
        raise HTTPException(status_code=404, detail="Job output not found; run pipeline first")
    if str(PIPELINE_DIR) not in sys.path:
        sys.path.insert(0, str(PIPELINE_DIR))
    from src.project import compute_projections, load_matches_for_job
    from export import write_projections_excel
    matches_df, prev_year, later_year = load_matches_for_job(tables_dir)
    if matches_df is None or len(matches_df) == 0:
        raise HTTPException(status_code=422, detail="No matches found for this job")
    base_year = later_year
    projections_by_year = compute_projections(matches_df, base_year, target_years)
    out_path = JOBS_DIR / job_id / "projections.xlsx"
    write_projections_excel(projections_by_year, out_path)
    preview_2030 = []
    if 2030 in projections_by_year and len(projections_by_year[2030]) > 0:
        df30 = projections_by_year[2030].head(20)
        for _, row in df30.iterrows():
            rec = {}
            for k, v in row.items():
                if hasattr(v, "item"):
                    rec[k] = v.item()
                elif isinstance(v, float) and v != v:
                    rec[k] = None
                else:
                    rec[k] = v
            preview_2030.append(rec)
    download_url = f"/api/files/{job_id}/projections.xlsx"
    return {
        "download_url": download_url,
        "preview": preview_2030,
    }


@app.get("/project/visual/{job_id}")
def project_visual(job_id: str):
    """
    Time-series points per anomaly for trajectory chart.
    Returns list of { anomaly_id, year, depth, growth_rate, flags }.
    No aggregation; frontend builds lines and median.
    """
    _validate_job_id(job_id)
    tables_dir = JOBS_DIR / job_id / "tables"
    if not tables_dir.exists():
        raise HTTPException(status_code=404, detail="Job output not found; run pipeline first")
    if str(PIPELINE_DIR) not in sys.path:
        sys.path.insert(0, str(PIPELINE_DIR))
    from src.project import load_matches_for_job, build_visual_series
    matches_df, prev_year, later_year = load_matches_for_job(tables_dir)
    if matches_df is None or len(matches_df) == 0:
        raise HTTPException(status_code=422, detail="No matches found for this job")
    series = build_visual_series(matches_df, prev_year, later_year, [2030, 2040])
    return {"points": series, "years": [prev_year, later_year, 2030, 2040]}


@app.get("/api/files/{job_id}/{file_path:path}")
def api_files_job(job_id: str, file_path: str):
    """Serve a file from a job directory (tables/ or root). Only allowed filenames."""
    _validate_job_id(job_id)
    if ".." in file_path or file_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    parts = [p for p in file_path.split("/") if p]
    if not parts:
        raise HTTPException(status_code=400, detail="Filename required")
    filename = parts[-1]
    if not _allowed_job_filename(filename):
        raise HTTPException(status_code=404, detail="File not found")
    # Allow tables/foo.csv or output.xlsx
    if len(parts) == 1:
        path = JOBS_DIR / job_id / filename
    else:
        path = JOBS_DIR / job_id / "/".join(parts)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    media_types = {"csv": "text/csv", "json": "application/json", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    ext = path.suffix.lower().lstrip(".")
    return FileResponse(path, filename=path.name, media_type=media_types.get(ext, "application/octet-stream"))


@app.get("/api/pipeline/data_ready_bundle.zip")
def api_pipeline_data_ready_bundle():
    """Serve the data analysis bundle zip (only when includeDataReadiness was used)."""
    if not DATA_READY_BUNDLE_ZIP.exists():
        raise HTTPException(status_code=404, detail="Bundle not found; run pipeline with Data Analysis option")
    return FileResponse(DATA_READY_BUNDLE_ZIP, filename="data_ready_bundle.zip", media_type="application/zip")


# ---------- Data Readiness (legacy / optional) ----------

def run_data_readiness(input_path: str, out_dir: Path, runs: list[int], debug: bool = False) -> dict:
    """
    Run the data readiness pipeline by invoking run_data_ready.py (same interpreter, cwd=pipeline).
    """
    resolved_input = _resolve_input_path(input_path)
    cmd = [
        sys.executable,
        "run_data_ready.py",
        "--input", str(resolved_input),
        "--out-dir", str(out_dir),
        "--runs", *[str(r) for r in runs],
    ]
    if debug:
        cmd.append("--debug")
    try:
        result = subprocess.run(
            cmd,
            cwd=str(PIPELINE_DIR),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "error": "Data readiness timed out after 120s",
            "out_dir": str(out_dir.resolve()),
            "outputs": {},
            "summary": {},
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "out_dir": str(out_dir.resolve()),
            "outputs": {},
            "summary": {},
        }
    if result.returncode != 0:
        return {
            "status": "error",
            "error": (result.stderr or result.stdout or "Pipeline failed").strip(),
            "out_dir": str(out_dir.resolve()),
            "outputs": {},
            "summary": {},
        }
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {
            "status": "error",
            "error": "Pipeline did not return valid JSON",
            "out_dir": str(out_dir.resolve()),
            "outputs": {},
            "summary": {},
        }


@app.post("/api/data-ready/run")
def api_data_ready_run(body: dict):
    """
    Run data readiness pipeline. Body: { "inputPath": str, "runs": [int], "debug": bool }.
    Writes to deterministic folder (data_ready/) and returns status, out_dir, outputs, summary.
    """
    input_path = body.get("inputPath")
    runs = body.get("runs")
    debug = bool(body.get("debug", False))

    if not input_path or not isinstance(input_path, str):
        raise HTTPException(status_code=400, detail="inputPath (string) is required")
    if not runs or not isinstance(runs, list):
        raise HTTPException(status_code=400, detail="runs (list of integers) is required")
    try:
        runs = [int(r) for r in runs]
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="runs must be a list of integers")

    resolved = _resolve_input_path(input_path)
    if not resolved.exists():
        raise HTTPException(status_code=400, detail=f"Input path does not exist: {resolved}")

    result = run_data_readiness(
        input_path=input_path,
        out_dir=DATA_READY_DIR,
        runs=runs,
        debug=debug,
    )

    if result["status"] == "error":
        raise HTTPException(status_code=422, detail=result.get("error", "Data readiness failed"))

    # Return server-relative download URLs for the four outputs
    base = "/api/data-ready/files"
    result["outputs"] = {
        "all_runs_clean_csv": f"{base}/all_runs_clean.csv",
        "data_quality_csv": f"{base}/data_quality.csv",
        "schema_report_json": f"{base}/schema_report.json",
        "readme_md": f"{base}/README.md",
    }
    return result


@app.get("/api/data-ready/files/{filename}")
def api_data_ready_files(filename: str):
    """Serve a generated file from the data readiness output directory."""
    if filename not in DATA_READY_ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="File not found")
    path = DATA_READY_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not generated yet; run data readiness first")
    media_types = {
        "all_runs_clean.csv": "text/csv",
        "data_quality.csv": "text/csv",
        "schema_report.json": "application/json",
        "README.md": "text/markdown",
    }
    return FileResponse(path, filename=filename, media_type=media_types.get(filename, "application/octet-stream"))


@app.get("/api/data-ready/preview")
def api_data_ready_preview(limit: int = Query(50, ge=1, le=200)):
    """Return first N rows of all_runs_clean.csv as JSON (for UI preview)."""
    path = DATA_READY_DIR / "all_runs_clean.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run data readiness first")
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append(row)
    return {"rows": rows, "limit": limit}
