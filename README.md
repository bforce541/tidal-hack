# PipeAlign

## Local development

### Backend (ILI MVP pipeline)

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

API: `http://localhost:8000` (health: `GET /health`, uploads: `POST /api/uploads`, pipeline: `POST /api/pipeline/run`, files: `GET /api/files/{job_id}/...`).

### Frontend

```bash
npm install
npm run dev
```

Frontend runs on port 8080 and calls the backend at `http://localhost:8000` by default. Set `VITE_API_BASE_URL` in `.env` if needed. Go to **Run Pipeline** (e.g. `/mvp`): **upload** your ILI Excel (.xlsx) via the file picker, choose run pair, optionally enable **Include Data Analysis (optional download)** under Advanced options, then click **Run Pipeline**. The file is uploaded to the backend (stored under `backend/uploads/`) and the pipeline runs on it. After the run you get a summary and downloads: **Matches (Human-readable CSV)**, **Matches (Machine CSV)**, **Summary JSON**. The human-readable CSV uses spelled-out column names with units (e.g. "Distance (m)", "Depth (%)"). Under **Advanced Downloads**, if you enabled Data Analysis, you can download the **Data Analysis Bundle (zip)** with diagnostic reports.

### File upload and pipeline via API (curl)

Upload a file (max 50MB, .xlsx only); the backend returns a `storedPath` to use in the pipeline call:

```bash
curl -F "file=@ILIDataV2.xlsx" http://localhost:8000/api/uploads
# Example response: {"storedPath":"uploads/<uuid>.xlsx","originalName":"ILIDataV2.xlsx"}

curl -X POST http://localhost:8000/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"inputPath": "uploads/<uuid>.xlsx", "runs": [2015, 2022], "debug": false, "includeDataReadiness": false}'
```

### Data Analysis (diagnostic bundle) via CLI

To generate the diagnostic bundle (all_runs_clean.csv, data_quality.csv, schema_report.json, README.md) without the UI:

```bash
cd backend
python pipeline/run_data_ready.py --input ../public/sample_data/ILIDataV2.xlsx --out-dir data_ready --runs 2015 2022
```

Outputs go to `backend/data_ready/`. When you run the pipeline from the UI with **Include Data Analysis** enabled, the same outputs are bundled into a zip and served under Advanced Downloads.

---

    1    Sync dev locally:
git checkout dev
git pull --rebase origin dev
    2    Update your existing branch with latest dev:
git checkout <your-branch>
git rebase dev
# resolve conflicts if any
git push --force-with-lease
    3    Keep working on your branch:
# edit files
git add -A
git commit -m "message"
git push
    4    When ready, open a PR into dev:
    •    base: dev
    •    compare: <your-branch>
    5    After testing is good on dev, open a PR dev -> main and merge for release.
