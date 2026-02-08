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

- **GET /health** – `{ "ok": true }`
- **POST /run-mvp** – multipart: `file` (Excel), `runs` (e.g. `2007,2015` or `2015,2022`). Returns `job_id`, `summary`, `download_url`.
- **GET /download/{job_id}** – returns `output.xlsx`.

Outputs are under `backend/jobs/{job_id}/` (gitignored).
