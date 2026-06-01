# WorkDesk AI

**WorkDesk AI** is a private, intranet-hosted productivity assistant for **Adit Microsys Pvt. Ltd.**, powered by on-premise **Ollama** LLMs. Employees open it in a browser—no install—and use guided **task tools** (not a blank chat) for emails, documents, project work, code, and presales.

| | |
| --- | --- |
| **Version** | 1.0 |
| **Access** | Company intranet (office LAN or VPN). Restrict network access before wider rollout. |
| **End users** | No login—open the app URL and pick a tool. Recent results and favorites are saved per browser. |
| **Operators** | [Admin console](#admin-console) to enable/disable tools, assign models, edit prompts, maintain a company profile, view usage analytics, and (optionally) manage Q&A documents. |

---

## Table of contents

- [Overview](#overview)
- [Product tools](#product-tools)
- [User experience](#user-experience)
- [Admin console](#admin-console)
- [How it works](#how-it-works)
- [What v1.0 is not](#what-v10-is-not)
- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Production deployment (Windows)](#production-deployment-windows)
- [Updating after code changes](#updating-after-code-changes)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Architecture notes](#architecture-notes)
- [Troubleshooting](#troubleshooting)
- [Sharing with colleagues](#sharing-with-colleagues)

---

## Overview

WorkDesk AI gives every department—developers, project managers, BD/presales, admin/HR/accounts—the same on-prem AI assistant without sending data to the public cloud.

**Design goals**

- **Task-based UI** — Each tool has a form, labels, and a tuned prompt so staff do not need to “prompt engineer.”
- **On-prem privacy** — All generation goes through your FastAPI server to your Ollama host; the browser never talks to Ollama directly.
- **CPU-friendly** — A single-consumer request queue (one Ollama call at a time) and a SQLite response cache keep a shared CPU Ollama instance usable under office load. Waiting users see their **queue position** and an estimated wait instead of a frozen screen.
- **Department coverage** — Tools are grouped in the sidebar by audience (Everyone, Delivery/PM, Developers, BD/Presales).
- **Lightweight personalization** — Recent results and favorite tools are remembered in the browser; no accounts required.

---

## Product tools

| Section | Tool | What it does |
| ------- | ---- | ------------ |
| **Everyone** | **Email Composer** | Turn rough notes into a polished email (tone: Formal, Internal & team, Government & official; length: Standard or Brief). Rich-text copy for Outlook. |
| **Everyone** | **Meeting to MoM** | Convert meeting notes into structured minutes of meeting. |
| **Everyone** | **Summarise Document** | Extract key takeaways from long pasted text. |
| **Everyone** | **Tone Fixer** | Rewrite text for a different professional tone while keeping meaning. |
| **Everyone** | **Translate** | Translate workplace text to **English**, **Hindi**, or **Gujarati**. |
| **Everyone** | **Company Q&A** *(planned — not yet implemented)* | Intended for Q&A over admin-managed company documents using BM25 retrieval. Not available in the current build. |
| **Delivery / PM** | **Status Report** | Build a formal weekly status report (project name, period, team, bullet updates). |
| **Delivery / PM** | **Risk Register** | Identify and document project risks in a formal register style. |
| **Developers** | **Explain Code** | Plain-language explanation of a pasted code snippet. |
| **Developers** | **Commit Message** | Generate clear, conventional Git commit messages from a change description. |
| **Developers** | **Bug Report** | Structure a complete bug report from informal notes. |
| **BD / Presales** | **Eligibility Check** | Compare RFP/tender eligibility criteria against company credentials (uses the **quality** model; may run slower). Automatically references the admin-maintained [company profile](#company-profile). |
| **BD / Presales** | **De-AI Text** | Rewrite AI-sounding prose so it reads more natural and human. |

Disabled tools are hidden from the sidebar; admins control visibility from the [admin console](#admin-console).

---

## User experience

- **Streaming output** — Results appear token-by-token as the model generates.
- **Queue position** — When the server is busy, the tool shows your position in line (e.g. *“You’re #3 · ~40s”*) with a **Cancel** button, then switches to live output when your turn arrives.
- **Copy & regenerate** — Copy output to the clipboard; regenerate bypasses cache when needed.
- **Cache indicator** — Repeat identical requests may show a **Cached** badge and return instantly, even while another generation is running (see [How it works](#how-it-works)).
- **Recent results** — Your last results are saved in this browser and can be reopened from the **Recent** panel. A **Clear history** option removes them.
- **Favorites** — Star the tools you use most; favorites pin to the top of the sidebar.
- **Feedback** — A 👍 / 👎 control under each result lets you tell operators what works; 👎 offers an optional one-line comment. Feedback is anonymous.
- **Sidebar** — Tools grouped by section; **search** filters by name; sidebar can **collapse** to icons.
- **Light / dark theme** — Toggle in the sidebar footer; preference is remembered.
- **Validation** — Empty inputs are blocked with inline messages before calling the API. Oversized pastes are rejected with a friendly message before entering the queue.

**Email Composer** uses a dedicated layout: formatted preview and **Copy as Rich Text** (for email clients) in addition to plain text.

> Recent results and favorites are stored only in the local browser (`localStorage`). They are not shared between browsers or devices, and clearing browser data removes them.

---

## Admin console

Operators manage the deployment at **`/admin/login`** (not linked from the main app for end users).

| Capability | Description |
| ---------- | ----------- |
| **Sign in** | JWT-based admin login (`ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`). |
| **Enable / disable tools** | Turn individual tools on or off for all users. |
| **Per-tool model** | Override which Ollama model a tool uses, chosen from `OLLAMA_ALLOWED_MODEL_OVERRIDES`. |
| **Company profile** | Maintain reusable company credentials (certifications, clients, deployments, etc.) injected into relevant tools. See [Company profile](#company-profile). |
| **Prompt templates** | View and edit the tuned prompt for any tool, with reset-to-default. See [Editable prompts](#editable-prompts). |
| **Usage analytics** | Anonymous, aggregate view of tool usage, cache-hit rate, average latency, errors, and feedback. See [Analytics](#analytics). |
| **Documents** *(planned)* | Will manage and reindex company documents for Company Q&A (not yet implemented). |
| **Bulk save** | Review changes, then save or discard. |

Change default admin credentials in `backend\.env` before production. End users still do not need accounts.

### Company profile

A set of admin-editable sections (e.g. *Certifications*, *Clients*, *HappServe deployments*) is stored on the server and injected into the prompts of tools that opt in (default: **Eligibility Check**). Edit a section once and every relevant tool reflects it on the next request—no redeploy. Disabled sections are excluded.

### Editable prompts

Each tool’s prompt can be edited from the console. **Code holds the defaults; the database holds overrides.** Saving creates an override; **Reset to default** removes it and restores the shipped prompt. Templates are validated for required placeholders before saving. A per-tool flag controls whether the [company profile](#company-profile) is injected.

### Analytics

Every generation records an anonymous usage event (tool, model, cached?, latency, status). The analytics page shows usage counts per tool, cache-hit rate, average latency, error/timeout/cancel counts, and a 👍 / 👎 summary with recent comments. No user inputs or outputs are stored.

---

## How it works

```text
Browser  →  Angular UI  →  FastAPI :8000  →  single-consumer queue  →  Ollama :11434
                              ↓
                        SQLite (cache · settings · profile · prompts · usage · feedback)
```

| Mechanism | Behavior |
| --------- | -------- |
| **Model routing** | Most tools use `OLLAMA_MODEL_DEFAULT`; developer tools use `OLLAMA_MODEL_CODE`; Eligibility Check uses `OLLAMA_MODEL_QUALITY`. Admins can override per tool. |
| **Request queue** | An explicit **single-consumer job queue** runs **one** Ollama request at a time. Each waiting request is told its **position** and an **ETA** (rolling average of recent generation times). Do not run multiple Uvicorn workers. |
| **Cache before queue** | The SQLite cache is checked **before** a request joins the queue, so a cache hit returns immediately and never waits behind a live generation. |
| **Response cache** | Identical prompts are served from SQLite for **24 hours** by default (`CACHE_TTL_HOURS`). Creative/high-churn tasks (e.g. email, MoM, code tools) skip cache; **Tone Fixer**, **Translate**, and **Eligibility Check** may use cache when inputs match. |
| **Cancellation** | Cancelling or closing a queued request frees its slot immediately so abandoned requests do not block the line. |
| **Guards** | Inputs over `MAX_INPUT_CHARS` are rejected; each generation has a hard timeout (`GENERATION_TIMEOUT_S`). |
| **Streaming** | `POST /generate/stream` returns a readable stream of newline-delimited JSON frames (`fetch` + `ReadableStream`). |
| **Health** | `GET /health` reports API status and Ollama reachability. |

### Stream frames

```jsonc
{"type":"queued","position":3,"eta_s":48}   // repeated as the line advances
{"type":"start"}                              // acquired the worker (or cache hit)
{"type":"token","t":"..."}                    // repeated
{"type":"done","cached":false}                // success
{"type":"error","msg":"timeout"}              // failure
```

### Company Q&A (optional)

When enabled, an admin maintains a folder of company documents (policies, rules, holiday lists, process notes). A server-side **ingest** step extracts text, splits it into chunks, and indexes them in SQLite using **BM25 keyword search** (pure Python—no GPU, no embedding model required). At question time the top-matching chunks are passed to the model with an instruction to answer **only** from that context and to cite the source documents; if nothing matches, it replies that the information isn’t available. Answers run through the same single-consumer queue, so they add no concurrent load. Document ingest is admin-side only—end users still never upload files.

---

## What v1.0 is not

- **Not** a free-form ChatGPT-style chat—only the guided task tools.
- **Not** per-user file upload—end users type or paste only.
- **Not** cross-device history—recent results and favorites live only in the local browser.
- **Not** per-employee user accounts or role-based tool access (only global tool on/off via admin).
- **Not** dependent on external AI APIs—all inference stays on your Ollama host.

---

## Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Python 3.11, FastAPI, SQLAlchemy 2 async, aiosqlite |
| Frontend | Angular 19 (standalone), Tailwind CSS 3         |
| Storage  | SQLite (cache, settings, company profile, prompt overrides, usage, feedback, Q&A index) |
| Retrieval | BM25 (pure Python) for optional Company Q&A     |
| LLM      | Ollama (LAN or local, CPU-oriented)             |
| OS       | Windows (scripts and NSSM examples below)       |

---

## Prerequisites

| Component   | Version / notes                                      |
| ----------- | ---------------------------------------------------- |
| Python      | 3.11                                                 |
| Node.js     | 20 LTS (for Angular build and `serve`)               |
| Ollama      | Running and reachable from the app server            |
| NSSM        | Optional — for Windows services on a central server  |
| `serve`     | `npm install -g serve` — static host for production UI |

Pull models on the Ollama host before first use (names must match `.env`):

```cmd
ollama pull gemma4:latest
ollama pull codellama:7b
```

---

## Local development

### 1. Backend

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and edit values:

```cmd
copy .env.example .env
```

Example `.env`:

```env
SQLITE_DB_PATH=./workdesk_cache.db
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGINS=http://localhost:4200
CACHE_TTL_HOURS=24
OLLAMA_MODEL_DEFAULT=gemma4:latest
OLLAMA_MODEL_CODE=codellama:7b
OLLAMA_MODEL_QUALITY=gemma4:latest
OLLAMA_ALLOWED_MODEL_OVERRIDES=gemma3:4b,gemma4:latest,codellama:7b,llava:7b
MAX_INPUT_CHARS=20000
GENERATION_TIMEOUT_S=180
ETA_WINDOW=20
COMPANY_DOCS_DIR=./company_docs
RAG_TOP_K=5
RAG_CHUNK_TOKENS=700
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRE_MINUTES=480
```

Start the API (always **one worker**):

```cmd
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

The SQLite database is created on first startup. No migrations are required.

Health check:

```http
GET http://localhost:8000/health
→ {"status": "ok", "ollama": "reachable"}
```

### 2. Frontend

```cmd
cd frontend
npm install
npx ng serve --port 4200
```

Open `http://localhost:4200`. The UI calls `http://localhost:8000` (see `src/environments/environment.ts`).

Admin (local): `http://localhost:4200/admin/login`

---

## Production deployment (Windows)

Deploy on **one internal machine** that can reach Ollama. Colleagues open the server in a browser (e.g. `http://<WORKDESK_SERVER_IP>/`).

### Architecture

```text
Browser  →  static UI (port 80, serve)  →  FastAPI :8000  →  Ollama :11434
```

- Frontend and API may share the same host; production builds resolve the API as `http://<same-hostname>:8000` automatically.
- Uvicorn must use **`--workers 1`** so the in-process job queue in `app/services/job_queue.py` serialises Ollama requests.

### Folder layout (example)

Scripts work from any path; `C:\workdesk-ai\` is a common choice:

```text
C:\workdesk-ai\
  backend\
    venv\
    .env
    company_docs\            ← optional: documents for Company Q&A
    scripts\start_prod.bat
  frontend\
    dist\frontend\browser\   ← production build output
    scripts\start_frontend.bat
```

### Step 1 — Prepare backend on the server

```cmd
cd C:\workdesk-ai\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend\.env` for production:

| Variable | Production example |
| -------- | ------------------ |
| `OLLAMA_BASE_URL` | `http://<OLLAMA_HOST_IP>:11434` (Ollama host) |
| `CORS_ORIGINS` | `http://<WORKDESK_SERVER_IP>,http://<WORKDESK_SERVER_IP>:80` (UI origin; add `:80` if needed) |
| Model variables | Match models installed on the Ollama server |
| `COMPANY_DOCS_DIR` | Path to the Q&A documents folder (if using Company Q&A) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Strong credentials (not defaults) |
| `JWT_SECRET` | Long random secret |

Test manually:

```cmd
backend\scripts\start_prod.bat
```

### Step 2 — Build and copy the frontend

On a build machine or the server:

```cmd
cd frontend
npm install
npx ng build --configuration production
```

Output directory: `frontend\dist\frontend\browser\`.

Copy the whole `frontend` tree (or at least `dist\frontend\browser\` and `scripts\`) to the server if you built elsewhere.

Test manually:

```cmd
frontend\scripts\start_frontend.bat
```

Open `http://<server-ip>/` and run a tool. If the UI loads but generate fails, check `GET http://<server-ip>:8000/health` and `CORS_ORIGINS`.

### Step 3 — Register Windows services (NSSM)

Install [NSSM](https://nssm.cc/) and `serve` globally (`npm install -g serve`).

Adjust paths if your install is not under `C:\workdesk-ai\`.

**Backend:**

```cmd
nssm install WorkDeskBackend "C:\workdesk-ai\backend\scripts\start_prod.bat"
nssm set WorkDeskBackend DisplayName "WorkDesk AI — Backend"
nssm set WorkDeskBackend Description "FastAPI backend for WorkDesk AI"
nssm set WorkDeskBackend Start SERVICE_AUTO_START
nssm start WorkDeskBackend
```

**Frontend:**

```cmd
nssm install WorkDeskFrontend "C:\workdesk-ai\frontend\scripts\start_frontend.bat"
nssm set WorkDeskFrontend DisplayName "WorkDesk AI — Frontend"
nssm set WorkDeskFrontend Description "Static Angular UI for WorkDesk AI"
nssm set WorkDeskFrontend Start SERVICE_AUTO_START
nssm start WorkDeskFrontend
```

Verify:

```cmd
nssm status WorkDeskBackend
nssm status WorkDeskFrontend
curl http://localhost:8000/health
```

Share with the team: `http://<server-ip>/` (ensure firewall allows LAN access to ports **80** and **8000**).

### Alternative: IIS

You may host `dist\frontend\browser` in IIS with a URL rewrite rule for Angular routes, and run only the backend via NSSM. Point `CORS_ORIGINS` at the IIS site URL.

---

## Updating after code changes

**Backend** — pull/copy files, then:

```cmd
nssm restart WorkDeskBackend
```

**Frontend** — rebuild, copy `dist\frontend\browser\` to the server, then:

```cmd
cd frontend
npx ng build --configuration production
nssm restart WorkDeskFrontend
```

**Ollama URL** — edit `OLLAMA_BASE_URL` in `backend\.env`, then restart the backend service.

**Company Q&A documents** — update files in `COMPANY_DOCS_DIR`, then use **Reindex** in the admin **Documents** page (no restart needed).

---

## Environment variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SQLITE_DB_PATH` | No | Database path (default `./workdesk_cache.db`) |
| `OLLAMA_BASE_URL` | Yes | Ollama base URL, e.g. `http://<OLLAMA_HOST_IP>:11434` |
| `CORS_ORIGINS` | Yes | Comma-separated browser origins allowed to call the API |
| `CACHE_TTL_HOURS` | No | Cache TTL (default `24`) |
| `OLLAMA_MODEL_DEFAULT` | Yes | Default model for most tasks |
| `OLLAMA_MODEL_CODE` | Yes | Model for code-related tasks |
| `OLLAMA_MODEL_QUALITY` | Yes | Model for higher-quality tasks (e.g. eligibility) |
| `OLLAMA_ALLOWED_MODEL_OVERRIDES` | Yes | Comma-separated allowlist for admin per-tool overrides |
| `MAX_INPUT_CHARS` | No | Reject pastes longer than this (default `20000`) |
| `GENERATION_TIMEOUT_S` | No | Hard per-request generation timeout (default `180`) |
| `ETA_WINDOW` | No | Recent samples used for the queue ETA average (default `20`) |
| `COMPANY_DOCS_DIR` | No | Folder for Company Q&A documents (default `./company_docs`) |
| `RAG_TOP_K` | No | Chunks passed to the model for Company Q&A (default `5`) |
| `RAG_CHUNK_TOKENS` | No | Approximate chunk size for Q&A indexing (default `700`) |
| `ADMIN_USERNAME` | Yes | Admin console login |
| `ADMIN_PASSWORD` | Yes | Admin console password |
| `JWT_SECRET` | Yes | Secret for admin JWT tokens |
| `JWT_EXPIRE_MINUTES` | No | Admin session length (default `480`) |

See `backend\.env.example` for a full template.

---

## Project structure

```text
WorkDesk AI/
├── backend/
│   ├── app/
│   │   ├── models/         cache.py, task_settings.py, company_profile.py,
│   │   │                   prompt_override.py, analytics.py, app_feedback.py
│   │   ├── prompts/        templates.py (default task prompts), resolver.py
│   │   ├── routers/        generate.py, admin.py, feedback.py
│   │   ├── auth/           JWT for admin only (jwt.py, dependencies.py)
│   │   ├── schemas/        generate.py, admin.py, feedback.py
│   │   └── services/       ollama.py, job_queue.py, queue.py, cache.py,
│   │                       task_settings.py, company_profile.py,
│   │                       company_profile_admin.py, prompts_admin.py,
│   │                       usage.py, app_feedback.py
│   ├── scripts/            start_prod.bat
│   ├── alembic/            DB migration scaffolding (auto-applied on startup)
│   ├── main.py
│   ├── task_definitions.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── core/           services (generate, tasks, admin, theme, history,
│   │   │                   feedback), guards, utils, constants
│   │   ├── features/       shell/, tasks/ (12 tool components), admin/
│   │   │                   (login, dashboard, tools, prompts, profile,
│   │   │                   analytics, feedback)
│   │   └── shared/         streaming-output, queue-status, copy-button,
│   │                       output-feedback, generation-actions, brand-logo
│   ├── src/environments/   environment.ts, environment.prod.ts
│   └── scripts/            start_frontend.bat
├── .gitignore
└── README.md
```

---

## Architecture notes

- All LLM traffic goes through FastAPI; the browser never calls Ollama directly.
- An explicit single-consumer job queue in `app/services/job_queue.py` runs one Ollama request at a time and exposes each request’s position and ETA. It replaces the earlier `asyncio.Semaphore(1)`.
- The cache is consulted **before** enqueueing, so cache hits bypass the queue entirely.
- Responses are cached in SQLite except tasks listed in `NO_CACHE_TASK_TYPES` in `generate.py`.
- Prompts resolve via `prompt_resolver.py`: database override first, else the default in `prompts/templates.py`.
- Company Q&A (optional) uses BM25 retrieval in `services/rag.py` over chunks stored in SQLite—no embedding model or GPU required.
- Streaming uses `fetch()` + `ReadableStream` with newline-delimited JSON frames, not `EventSource`.
- 
---

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| UI loads, generate fails | `http://<server>:8000/health`, firewall on port 8000, `CORS_ORIGINS` matches browser URL |
| `ollama: unreachable` | `OLLAMA_BASE_URL`, Ollama service running, model names pulled |
| Tool missing from sidebar | Admin may have disabled it; check `/admin` |
| 404 on refresh in production | Frontend must be served with SPA mode (`serve -s` or IIS rewrite) |
| Long wait / high queue position | Expected on CPU Ollama under load; the queue serialises requests. The position/ETA indicator confirms it is working, not stuck. Do not increase Uvicorn workers. |
| Request rejected before running | Input exceeded `MAX_INPUT_CHARS`; shorten the paste. |
| Recent results / favorites missing | They are per-browser (`localStorage`); cleared browser data or a different device/browser will not have them. |
| Edited prompt has no effect | Confirm the override was saved in **Prompt Templates**; restart not required. Use **Reset to default** to revert. |
| Company Q&A not available | Company Q&A is not yet implemented in this build. |
| Admin login fails | `ADMIN_USERNAME` / `ADMIN_PASSWORD` in server `.env`; restart backend after changes |

---

## Sharing with colleagues

1. Deploy on the intranet ([Production deployment](#production-deployment-windows)).
2. Share the UI URL, e.g. `http://<server-ip>/`.
3. Optionally share the admin URL with IT only: `http://<server-ip>/admin/login`.

No browser extension is required. Possible later enhancements: PWA install, VPN-only binding, Company Q&A with BM25/embedding retrieval, or per-user login.
