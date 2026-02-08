# PipeAlign – Backend (ILI MVP API)

Minimal FastAPI wrapper around the ILI pipeline. No database, auth, or queues.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --reload --port 8000
```

If WatchFiles keeps reloading on `pipeline/src/ml_project.py` without you editing it, something else is touching that file (e.g. Cursor format-on-save, a formatter, or file sync). Workaround: exclude it from the reload watch so only `app.py` and other backend root changes trigger reload:

```bash
uvicorn app:app --reload --port 8000 --reload-exclude "pipeline/src/ml_project.py"
```

After editing `ml_project.py` you must restart the server to pick up changes.

**Finding what modifies the file**

- Confirm mtime changes without editing: from repo root run  
  `watch -n 1 "stat -f '%m' backend/pipeline/src/ml_project.py"` (macOS) or  
  `watch -n 1 "stat -c '%Y' backend/pipeline/src/ml_project.py"` (Linux). If the number updates every few seconds, something is writing the file.
- See which process has it open:  
  `lsof backend/pipeline/src/ml_project.py`  
  (often empty if the writer opens/writes/closes quickly).
- On macOS, see recent file writes:  
  `fs_usage -f filesys -e -w 2>&1 | grep ml_project`  
  (run in another terminal; needs sudo for full visibility).
- Likely causes: Cursor/VSCode **Format on Save** or a Python formatter (Black/Ruff) rewriting the file; turn off format-on-save for that file or for `backend/` to test.

- **GET /health** – `{ "ok": true }`
- **POST /run-mvp** – multipart: `file` (Excel), `runs` (e.g. `2007,2015` or `2015,2022`). Returns `job_id`, `summary`, `download_url`.
- **GET /download/{job_id}** – returns `output.xlsx`.

Outputs are under `backend/jobs/{job_id}/` (gitignored).
