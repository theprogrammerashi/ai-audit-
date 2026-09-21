# Prompt for the Databricks Assistant — Port "CareAudit AI" to Databricks

> Paste everything below this line into the Databricks Assistant. It is written as a
> task brief. Work through it section by section. Do **not** change product behaviour
> or remove features — this is an infrastructure port only. We keep **SQLite** as the
> database.

---

## 0. Context — what this app is

CareAudit AI is a clinical-audit web app. Two parts, both in this repo (uploaded from the
GitHub branch `fix/sqlite-schema-migration`):

| Part | Stack | Folder |
|---|---|---|
| Backend | FastAPI (Python 3.12), SQLite via `sqlite3`, JWT auth | `backend/` |
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, all client components, Axios | `frontend/` |

It currently runs locally like this:

```bash
# backend  (from careaudit-ai/backend)
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
set PYTHONIOENCODING=utf-8
python -m uvicorn app.main:app --port 8010 --reload

# frontend (from careaudit-ai/frontend)
npm install
npm run dev            # http://localhost:3000
```

`frontend/.env.local` points the browser at the API:
```
NEXT_PUBLIC_API_URL=http://localhost:8010
NEXT_PUBLIC_WS_URL=ws://localhost:8010   # unused – see §5
```

The SQLite database is committed at `data/careaudit.sqlite` (relative to `careaudit-ai/`).
It is already seeded: **25 users, 30 cases, 1000 historical PA rows, plus policies,
decisions, audit results, appeals, training modules and executive history.** You do
**not** need to re-seed unless you want a clean slate (§7).

### The only things that are genuinely Databricks-incompatible today
1. **LLM calls go to Groq.** Must be repointed at Databricks Foundation Model APIs. (§3)
2. **`backend/app/services/medical_nlp.py` hardcodes a Windows path** `D:/careaudit_models`
   for the HuggingFace cache — `os.makedirs()` on that will fail on Linux. (§3.4)
3. **SQLite file location** — Databricks Apps have an ephemeral filesystem; the DB must
   live on a Unity Catalog Volume so it survives restarts. (§4)
4. **The frontend is a Node app**; Databricks Apps only run Python. (§5)
5. **One hardcoded `http://127.0.0.1:8000`** in `frontend/src/app/page.tsx`. (§5.3)

Everything else is standard FastAPI and ports as-is.

---

## 1. Deliverables

1. Backend running as a **Databricks App** (FastAPI on serverless compute).
2. SQLite database on a **Unity Catalog Volume**, seeded from the committed file.
3. All LLM traffic on **Databricks Foundation Model APIs** (no Groq, no external keys).
4. Frontend deployed and talking to the Databricks App URL (pick option in §5).
5. A short `DATABRICKS_RUNBOOK.md` you write, documenting deploy + seed + credentials.

---

## 2. Research / confirm first (do this before editing)

Run these in a notebook and record the answers — the rest of the work depends on them:

```python
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

# 2a. Which chat model serving endpoints exist / are enabled?
for e in w.serving_endpoints.list():
    print(e.name)
# Expect Foundation Model APIs such as:
#   databricks-meta-llama-3-3-70b-instruct
#   databricks-meta-llama-3-1-8b-instruct
#   databricks-mixtral-8x7b-instruct / databricks-dbrx-instruct
#   databricks-claude-3-7-sonnet  (if Anthropic is enabled)
# and embedding endpoints: databricks-gte-large-en / databricks-bge-large-en

# 2b. Workspace URL (for the OpenAI-compatible base_url)
print(w.config.host)   # https://<workspace>.cloud.databricks.com

# 2c. Do we have a Unity Catalog + a schema we can create a Volume in?
for c in w.catalogs.list(): print(c.name)
```

Decisions to lock in from the results:
- **`LLM_MODEL`** = the ~70B instruct endpoint (replaces Groq `llama-3.3-70b-versatile`).
- **`LLM_FAST_MODEL`** = an 8B / small instruct endpoint (replaces Groq `llama-3.1-8b-instant`).
- **Volume path** = `/Volumes/<catalog>/<schema>/<volume>/careaudit.sqlite`.

---

## 3. Backend change 1 — LLM provider: Groq → Databricks

### 3.1 Where Groq is used (only 3 files, all identical shape)

| File | Function | Groq model used |
|---|---|---|
| `backend/app/services/chat_engine.py` (~line 7, 11–14, 898, 935) | `generate_chat_response` – conversational Q&A | `settings.GROQ_MODEL` |
| `backend/app/services/document_parser.py` (~line 462–520) | `extract_clinical_summary` – summarise uploaded docs | `settings.GROQ_FAST_MODEL` |
| `backend/app/services/icd10_suggester.py` (~line 17–75) | `suggest_icd10_from_narrative_groq` – ICD-10 suggestions | `settings.GROQ_FAST_MODEL` |

Every call is the OpenAI-compatible shape already:
```python
from groq import Groq
client = Groq(api_key=settings.GROQ_API_KEY)
response = client.chat.completions.create(
    model=settings.GROQ_MODEL,          # or GROQ_FAST_MODEL
    messages=[...],
    temperature=...,
    max_tokens=...,
)
text = response.choices[0].message.content
```
Databricks Foundation Model APIs speak the same protocol, so this is a near drop-in swap
(`base_url` + `api_key` instead of the Groq client).

### 3.2 Add one shared client helper — `backend/app/services/llm_client.py`

```python
"""Central LLM client. Talks to Databricks Foundation Model APIs via the
OpenAI-compatible protocol. Replaces the old per-file Groq clients."""
import os
from functools import lru_cache
from openai import OpenAI
from app.config import settings


@lru_cache(maxsize=1)
def get_llm_client() -> OpenAI | None:
    """Return an OpenAI client pointed at Databricks model serving, or None
    if not configured (callers already handle None with a rule-based fallback)."""
    base_url = settings.LLM_BASE_URL
    api_key = settings.LLM_API_KEY

    # When running inside a Databricks App, the platform injects auth — use the SDK
    # to mint a token and derive the serving base_url automatically.
    if not base_url or not api_key:
        try:
            from databricks.sdk import WorkspaceClient
            w = WorkspaceClient()
            return w.serving_endpoints.get_open_ai_client()
        except Exception:
            return None

    return OpenAI(base_url=base_url, api_key=api_key)


def chat(messages, *, fast: bool = False, temperature: float = 0.3,
         max_tokens: int = 800) -> str | None:
    client = get_llm_client()
    if client is None:
        return None
    model = settings.LLM_FAST_MODEL if fast else settings.LLM_MODEL
    resp = client.chat.completions.create(
        model=model, messages=messages,
        temperature=temperature, max_tokens=max_tokens,
    )
    return resp.choices[0].message.content
```

### 3.3 Edit the 3 call sites to use it

- **`chat_engine.py`**: delete `from groq import Groq` and `_get_groq_client()`. In
  `generate_chat_response`, replace the `client = _get_groq_client()` / `client.chat.completions.create(...)`
  block with `from app.services.llm_client import chat` then
  `content = chat([{"role":"system","content":system_prompt},{"role":"user","content":message}], temperature=0.3, max_tokens=800)`.
  Keep the existing `if not content: return {"content": format_fallback(...)}` behaviour
  (rename the `if not client` guard to `if content is None`).
- **`document_parser.py`** `extract_clinical_summary`: replace the inline
  `from groq import Groq` / `client = Groq(...)` / `client.chat.completions.create(model=settings.GROQ_FAST_MODEL, ...)`
  with `from app.services.llm_client import chat` and
  `summary = chat([{"role":"user","content":prompt}], fast=True, temperature=0.1, max_tokens=600)`.
  Keep the `try/except` and the rule-based fallback that follows.
- **`icd10_suggester.py`** `suggest_icd10_from_narrative_groq`: same swap, `fast=True,
  temperature=0.1, max_tokens=400`. Keep the JSON-parsing and the `return []` fallback.
  (You may rename the function to `_from_narrative_llm` and update its one caller in
  `suggest_icd10_codes`, or leave the name — cosmetic.)

### 3.4 `backend/app/services/medical_nlp.py` — fix the hardcoded Windows cache path

Lines ~23–26 currently:
```python
HF_CACHE_DIR = "D:/careaudit_models"
os.environ["TRANSFORMERS_CACHE"] = HF_CACHE_DIR
os.environ["HF_HOME"] = HF_CACHE_DIR
os.makedirs(HF_CACHE_DIR, exist_ok=True)
```
Change to:
```python
HF_CACHE_DIR = os.environ.get("HF_HOME") or os.path.join(tempfile.gettempdir(), "careaudit_models")
os.environ.setdefault("HF_HOME", HF_CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", HF_CACHE_DIR)
os.makedirs(HF_CACHE_DIR, exist_ok=True)
```
(add `import tempfile` at the top). This module powers ClinicalBERT / BioBERT semantic
search and BioBERT ICD-10 similarity. `transformers`/`torch` are imported lazily inside
functions, so the app still boots if the models can't download — features degrade to the
rule-based fallbacks that already exist. Set `HF_HOME=/tmp/hf_cache` in the app config (§6).

> Optional (only if cold-start size is a problem): replace the BERT embeddings with the
> `databricks-gte-large-en` embedding endpoint. This is a behaviour change — do it only
> if asked. Default: keep BERT.

### 3.5 `backend/app/config.py` — new settings

In `class Settings`, replace the Groq block with:
```python
    # LLM (Databricks Foundation Model APIs, OpenAI-compatible)
    LLM_BASE_URL: str = ""          # e.g. https://<workspace>.cloud.databricks.com/serving-endpoints
    LLM_API_KEY: str = ""           # Databricks PAT or leave blank inside a Databricks App
    LLM_MODEL: str = "databricks-meta-llama-3-3-70b-instruct"
    LLM_FAST_MODEL: str = "databricks-meta-llama-3-1-8b-instruct"
```
Keep `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `SQLITE_PATH`
as they are (they already read from env). You can delete `GROQ_*`, `CHROMA_*`, and
`DUCKDB_PATH` — grep first to be sure nothing else references them (`chromadb` is in
`requirements.txt` but is **not imported anywhere** in `backend/app`).

### 3.6 `backend/requirements.txt`

- Remove: `groq`, `langchain-groq`, `chromadb` (unused).
- `langgraph` / `langchain-core`: only referenced by `backend/app/agents/graph.py`, which
  is **dead code** (nothing imports `build_audit_graph` / `run_pipeline_sequential`). Safe
  to drop both the deps and the file, or leave them — your call. Nothing else breaks.
- Add: `openai>=1.40.0` and `databricks-sdk>=0.30.0`.
- Keep `torch`, `transformers`, `sentence-transformers`, `spacy`, `scikit-learn`,
  `pdfplumber`, `PyMuPDF`, `python-docx`, `Pillow` — all used, all lazy-imported.
- `pytesseract` stays in the file but the **`tesseract` system binary will not be present**
  on Databricks Apps, so scanned-PDF/image OCR will no-op. The code already wraps it in
  `try/except` and falls back, so uploads of *text* PDFs/DOCX still work. Note this in the
  runbook as a known limitation.

---

## 4. Backend change 2 — SQLite on a Unity Catalog Volume

We are keeping SQLite. The app uses a **single process-wide connection**
(`backend/app/database.py` → `DuckDBCompatConnection` singleton, `check_same_thread=False`),
so concurrency is low and a file on a Volume is workable.

### 4.1 Create the Volume and load the seeded DB (one-time, in a notebook)

```python
CATALOG, SCHEMA, VOLUME = "main", "careaudit", "data"   # adjust to §2c
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")
spark.sql(f"CREATE VOLUME IF NOT EXISTS {CATALOG}.{SCHEMA}.{VOLUME}")

vol_path = f"/Volumes/{CATALOG}/{SCHEMA}/{VOLUME}/careaudit.sqlite"

# Copy the committed, pre-seeded DB from the repo into the Volume.
# (Upload careaudit-ai/data/careaudit.sqlite to /Volumes/.../ via the UI, or from a Repo:)
import shutil
shutil.copy("/Workspace/Repos/<you>/ai-audit-/careaudit-ai/data/careaudit.sqlite", vol_path)
print("seeded DB in place:", vol_path)
```

### 4.2 `backend/app/database.py` — hardening for the FUSE mount

At the top of `get_connection()`, after `sqlite3.connect(...)`, add:
```python
    raw_conn = sqlite3.connect(str(_db_path), check_same_thread=False, timeout=30)
    raw_conn.execute("PRAGMA busy_timeout=30000")
    try:
        raw_conn.execute("PRAGMA journal_mode=WAL")
    except sqlite3.OperationalError:
        raw_conn.execute("PRAGMA journal_mode=DELETE")  # some FUSE mounts reject WAL
```
Also make the "ensure parent dir exists" line tolerant (`_db_path.parent.mkdir(parents=True, exist_ok=True)` is already there — fine, but wrap in `try/except` since `/Volumes/...` parents can't be `mkdir`-ed).

### 4.3 Startup self-heal — `backend/app/main.py` `lifespan()`

Before `init_database()`, add: if `settings.SQLITE_PATH` does not exist, copy the bundled
`data/careaudit.sqlite` (ships in the repo/zip, resolve it relative to `app/config.py`'s
`ROOT_DIR`) to `settings.SQLITE_PATH`. Then `init_database()` (idempotent —
`CREATE TABLE IF NOT EXISTS` + guarded `ALTER`s) runs harmlessly on every boot.

### 4.4 Config

`SQLITE_PATH` is set via env in the app config (§6) to the Volume path. The app's service
principal needs **`READ VOLUME` + `WRITE VOLUME`** on `<catalog>.<schema>.<volume>`
(grant in §6.3).

---

## 5. Frontend — Next.js on Databricks

Databricks Apps run **Python only** — `next dev` / `next start` cannot run there. Pick one:

### Option A (recommended, zero refactor, full fidelity)
Deploy `frontend/` to a Node host (Vercel / Netlify / Azure Static Web Apps / a container).
- Set env there: `NEXT_PUBLIC_API_URL=https://<app-name>-<id>.aws.databricksapps.com`
  (the Databricks App URL from §6), `NEXT_PUBLIC_WS_URL` can be left unset.
- Add that frontend origin to the backend's `CORS_ORIGINS` env (§6).
- Fix the one hardcoded URL in §5.3.
- Nothing else changes. All dynamic routes, SSR, etc. keep working.

### Option B (everything inside Databricks — static export served by FastAPI)
One app, one URL, no CORS. Costs a small frontend refactor because
`output: 'export'` cannot resolve **runtime** dynamic route params.

1. `frontend/next.config.ts`:
   ```ts
   const nextConfig: NextConfig = {
     output: "export",
     images: { unoptimized: true },
     trailingSlash: true,
     devIndicators: false,
   };
   ```
2. Convert the 5 dynamic-segment pages to **query-param** pages (they are all
   `"use client"` and already read the id via `useParams()`):
   | from | to |
   |---|---|
   | `app/(dashboard)/cases/[id]/page.tsx` | `app/(dashboard)/cases/detail/page.tsx` → `useSearchParams().get("id")` |
   | `app/(dashboard)/audit/[id]/page.tsx` | `app/(dashboard)/audit/detail/page.tsx` |
   | `app/(dashboard)/workspace/[id]/page.tsx` | `app/(dashboard)/workspace/detail/page.tsx` |
   | `app/(dashboard)/cases/appeal/[id]/page.tsx` | `app/(dashboard)/cases/appeal/page.tsx` |
   | `app/(dashboard)/workspace/appeal/[id]/page.tsx` | `app/(dashboard)/workspace/appeal/page.tsx` |
   Then update every `router.push(...)` / `<Link href=...>` that targets those routes
   (grep `/workspace/`, `/cases/`, `/audit/` under `frontend/src`) to
   `/workspace/detail?id=${id}` style. Wrap the pages using `useSearchParams` in a
   `<Suspense>` boundary (Next 16 requirement).
3. Build locally (Node on a dev machine — Databricks won't build it):
   ```bash
   cd frontend && npm ci && NEXT_PUBLIC_API_URL="" npm run build   # emits frontend/out/
   ```
   Use `NEXT_PUBLIC_API_URL=""` so the Axios client falls back to **same-origin**
   (`/api/v1`), since FastAPI will serve both.
4. Commit `frontend/out/` (or copy it into `backend/static/` in the deploy bundle).
5. In `backend/app/main.py`, after routers, mount it:
   ```python
   from fastapi.staticfiles import StaticFiles
   import os
   _static = os.path.join(os.path.dirname(__file__), "..", "static")  # = frontend/out
   if os.path.isdir(_static):
       app.mount("/", StaticFiles(directory=_static, html=True), name="frontend")
   ```
   Keep this mount **after** all `/api/v1` routes and `/health`.

### 5.3 Hardcoded URL to fix (both options)
`frontend/src/app/page.tsx` ~line 139:
```js
fetch("http://127.0.0.1:8000/api/v1/stats/public")
```
Change to use the shared base:
```js
import { API_BASE } from "@/lib/api";
fetch(`${API_BASE}/api/v1/stats/public`)
```
(`API_BASE` already resolves from `NEXT_PUBLIC_API_URL`, empty → same-origin.)

### 5.4 Dead weight you can ignore
The frontend has **no WebSocket code** (`grep` for `WebSocket`/`socket.io`/`/ws/` in
`frontend/src` → nothing). So `NEXT_PUBLIC_WS_URL`, the `socket.io-client` dependency,
and the backend `backend/app/api/v1/websocket.py` (`/ws/agent-pipeline/{case_id}`) are
all unused. Leave them or strip them; they do not affect the port. Databricks Apps have
limited WebSocket support anyway — fine, because nothing calls it.

---

## 6. Package the backend as a Databricks App

### 6.1 App source root
Deploy the **`backend/`** folder as the app (so `app.main:app` resolves). If you must
deploy the repo root, set the command to `["uvicorn", "backend.app.main:app", ...]` and
ensure `backend/` is on `PYTHONPATH`.

### 6.2 `backend/app.yaml`
```yaml
command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

env:
  - name: SQLITE_PATH
    value: /Volumes/main/careaudit/data/careaudit.sqlite      # from §2c / §4.1
  - name: LLM_BASE_URL
    value: https://<workspace>.cloud.databricks.com/serving-endpoints
  - name: LLM_MODEL
    value: databricks-meta-llama-3-3-70b-instruct             # from §2a
  - name: LLM_FAST_MODEL
    value: databricks-meta-llama-3-1-8b-instruct              # from §2a
  - name: HF_HOME
    value: /tmp/hf_cache
  - name: PYTHONIOENCODING
    value: utf-8
  - name: CORS_ORIGINS
    value: https://<your-frontend-domain>                     # Option A; omit/"*" if Option B
  - name: SECRET_KEY
    valueFrom: secret-key                                     # see §6.3 (secret scope)
  # LLM_API_KEY intentionally omitted — inside a Databricks App the SDK mints the token
```
> Databricks Apps expect the process to listen on port **8000** (or `$DATABRICKS_APP_PORT`).
> Hardcoding 8000 is fine; if you prefer, read `int(os.environ.get("DATABRICKS_APP_PORT", 8000))`
> in a small `__main__` launcher instead of the uvicorn CLI.

### 6.3 Grants for the app's service principal
After the app is created (it gets a service principal), grant:
```sql
-- LLM
GRANT CAN_QUERY ON FUNCTION ... ;   -- or via Serving UI: give the SP "Can Query" on
                                    -- databricks-meta-llama-3-3-70b-instruct and the fast model
-- Volume (SQLite file)
GRANT READ VOLUME, WRITE VOLUME ON VOLUME main.careaudit.data TO `<app-service-principal>`;
```
Create the JWT secret:
```bash
databricks secrets create-scope careaudit
databricks secrets put-secret careaudit secret-key --string-value "$(openssl rand -hex 32)"
```
and reference it as an app resource named `secret-key` (or inline a strong value — but a
scope is better).

### 6.4 Deploy
```bash
databricks apps create careaudit-ai
databricks sync ./backend "/Workspace/Users/<you>/careaudit-ai-src"
databricks apps deploy careaudit-ai --source-code-path "/Workspace/Users/<you>/careaudit-ai-src"
databricks apps get careaudit-ai        # -> url, status
```
Open `<app-url>/health` → `{"status":"healthy"}`. Open `<app-url>/docs` for Swagger.

---

## 7. Seeding (only if you want a clean DB instead of the committed one)

The committed `data/careaudit.sqlite` is already fully populated — normally just copy it
into the Volume (§4.1) and skip this.

To regenerate from scratch, run in a notebook (not in the App — Apps have no shell):
```python
import os, sys
os.environ["SQLITE_PATH"] = "/Volumes/main/careaudit/data/careaudit.sqlite"
os.environ["PYTHONIOENCODING"] = "utf-8"
repo = "/Workspace/Repos/<you>/ai-audit-/careaudit-ai"
sys.path.insert(0, f"{repo}/backend")
os.chdir(f"{repo}/backend/scripts")     # seed_full.py does `import seed_executive` by bare name
%pip install -r ../requirements.txt
import seed_full; seed_full.main()
```
`seed_full.main()` calls `init_database()`, wipes all tables, then seeds:
**25 users, 5 policies, 30 cases, 30 policy matches, 20 nurse decisions, 20 audit results,
20 appeals, reviewer stats, training modules**, and runs `seed_executive.run_all_seeders()`
for 12 months of executive history + 1000 historical PA rows.

Other one-off scripts in `backend/scripts/` (`load_historical_pa.py`, `seed_appeal_intake.py`,
`populate_reviewer_stats.py`, etc.) are already baked into the committed DB; only run them
if `seed_full` output shows a table empty.

---

## 8. Login credentials (seeded, work as-is after the port)

**Every seeded user has the password: `CareAudit@2025`**

| Role | Email | Use for |
|---|---|---|
| ADMIN | `admin@careaudit.ai` | Everything, incl. Executive Command Center |
| QA_LEAD | `priya.sharma@careaudit.ai` | Team of 5 nurses (N001–N005), QA dashboards |
| QA_LEAD | `james.mitchell@careaudit.ai` | Team N006–N010 |
| QA_LEAD | `lisa.chen@careaudit.ai` | Team N011–N015 |
| QA_LEAD | `robert.davis@careaudit.ai` | Team N016–N020 |
| NURSE | `sarah.collins@careaudit.ai` | Nurse workspace, submit decisions |
| NURSE | `michael.torres@careaudit.ai` … +18 more | see `backend/scripts/seed_full.py` `USERS` |

Notes:
- There is **no `EXECUTIVE`-role user**; `require_admin()` accepts `ADMIN` **or**
  `EXECUTIVE`, so `admin@careaudit.ai` covers the executive views.
- **Bug to fix while you're in there:** `frontend/src/app/(auth)/login/page.tsx` pre-fills
  `sarah.collins@careaudit.ai` / **`nurse123`** — that password is stale and will 401.
  Change the default password value to `CareAudit@2025` (or blank both fields).
- Auth flow: `POST /api/v1/auth/login` → bcrypt check against `users.hashed_password` →
  JWT signed with `SECRET_KEY` (HS256, 480-min expiry). Frontend stores it in
  `localStorage` (`careaudit_token`) and Axios attaches `Authorization: Bearer`. A 401
  auto-redirects to `/login`. `SECRET_KEY` **must** be set in the app env (§6.2) — the
  default in `config.py` is a dev placeholder.

---

## 9. Acceptance checklist

- [ ] `<app-url>/health` returns healthy; `<app-url>/docs` loads.
- [ ] `POST /api/v1/auth/login` with `admin@careaudit.ai` / `CareAudit@2025` returns a token.
- [ ] Frontend loads, login works, sidebar navigates.
- [ ] **Cases** list shows 30 cases; opening one renders the 3-panel workspace.
- [ ] **Executive** page renders 12-month trend + org KPIs (proves historical/agg data + SQLite reads on the Volume).
- [ ] **Chat** page: ask "compare nurse performance for Priya Sharma's team" → a Markdown
      answer comes back → proves the **Databricks LLM** path (`chat_engine` → `llm_client`).
- [ ] Upload a text PDF on **Cases → New** → clinical summary + ICD-10 suggestions appear
      → proves `document_parser` + `icd10_suggester` on Databricks LLM. (Scanned-image OCR
      is expected to no-op — tesseract binary absent.)
- [ ] Submit a nurse decision → QA score + appeal risk populate → proves `qa_engine` /
      `appeal_classifier` (rule-based, no LLM) still work.
- [ ] Restart the App → data persists (proves the Volume, not ephemeral disk).
- [ ] `grep -rn "groq\|GROQ\|127.0.0.1:8000\|D:/careaudit_models" backend/ frontend/src` → no hits.

---

## 10. Summary of every file you will touch

| File | Change |
|---|---|
| `backend/app/services/llm_client.py` | **new** – shared Databricks LLM client |
| `backend/app/services/chat_engine.py` | drop Groq, call `llm_client.chat(...)` |
| `backend/app/services/document_parser.py` | drop Groq, call `llm_client.chat(..., fast=True)` |
| `backend/app/services/icd10_suggester.py` | drop Groq, call `llm_client.chat(..., fast=True)` |
| `backend/app/services/medical_nlp.py` | HF cache path → env / `tempfile`, not `D:/` |
| `backend/app/config.py` | `GROQ_*` → `LLM_*`; drop `CHROMA_*`, `DUCKDB_PATH` |
| `backend/app/database.py` | `busy_timeout` + `journal_mode` pragmas; tolerant `mkdir` |
| `backend/app/main.py` | startup: seed-from-bundled-file if missing; (Option B) mount static frontend |
| `backend/requirements.txt` | − groq, langchain-groq, chromadb; + openai, databricks-sdk |
| `backend/app.yaml` | **new** – Databricks App command + env |
| `backend/app/agents/graph.py` | (optional) delete – dead code |
| `frontend/src/app/page.tsx` | hardcoded `127.0.0.1:8000` → `API_BASE` |
| `frontend/src/app/(auth)/login/page.tsx` | default password `nurse123` → `CareAudit@2025` |
| `frontend/next.config.ts` | (Option B only) `output: 'export'` + `images.unoptimized` |
| `frontend/src/app/(dashboard)/**/[id]/page.tsx` ×5 | (Option B only) → query-param routes |
| `DATABRICKS_RUNBOOK.md` | **new** – you write: deploy + seed + creds |

Keep behaviour identical. When done, write `DATABRICKS_RUNBOOK.md` and report the app URL
plus the §9 checklist results.
