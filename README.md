# PipeAlign

## Local development

### Backend (ILI MVP pipeline)

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

API: `http://localhost:8000` (health: `GET /health`, MVP: `POST /run-mvp`, download: `GET /download/{job_id}`).

### Frontend

```bash
npm install
npm run dev
```

Frontend runs on port 8080 and calls the backend at `http://localhost:8000` by default. To use a different backend URL, set `VITE_API_BASE_URL` in `.env` (e.g. `VITE_API_BASE_URL=http://localhost:8000`). Then: go to **Run MVP (backend)** or `/mvp`, upload Excel (e.g. `public/sample_data/ILIDataV2.xlsx`), select run pair, click **Run MVP**, then **Download Excel**.

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
