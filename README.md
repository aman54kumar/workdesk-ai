# WorkDesk AI

**WorkDesk AI** is a private, intranet-hosted productivity assistant for **Adit Microsys Pvt. Ltd.**, powered by an organization-configured **local LLM** (typically on-prem **Ollama**) with optional **cloud BYOK**. Employees open it in a browser—no install—and use guided **task tools** (not a blank chat) for emails, documents, project work, code, and presales.

| | |
| --- | --- |
| **Version** | 1.0 |
| **Access** | Company intranet (office LAN or VPN). Restrict network access before wider rollout. |
| **End users** | No login—open the app URL and pick a tool. Recent results and favorites are saved per browser. |
| **Operators** | [Admin console](#admin-console) to configure LLM settings, enable/disable tools, assign models, edit prompts, maintain a company profile, and view usage analytics. |

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
- [Outlook add-in (Email Composer POC)](#outlook-add-in-email-composer-poc)

---

## Overview

WorkDesk AI gives every department—developers, project managers, BD/presales, admin/HR/accounts—the same AI assistant with local-first privacy and optional user-controlled cloud keys.

**Design goals**

- **Task-based UI** — Each tool has a form, labels, and a tuned prompt so staff do not need to “prompt engineer.”
- **On-prem by default** — Local generation goes through your FastAPI server to your organization LLM (Ollama or OpenAI-compatible on the LAN). The browser never talks to Ollama or cloud APIs directly.
- **Optional cloud BYOK** — When enabled by an admin, users may send prompts to external providers (OpenAI, Anthropic, Google, or a custom OpenAI-compatible endpoint) using API keys stored in their browser.
- **CPU-friendly** — A single-consumer request queue (one **local** LLM call at a time) and a SQLite response cache keep a shared CPU Ollama instance usable under office load. Cloud requests bypass the queue. Waiting users see their **queue position** and an estimated wait instead of a frozen screen.
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
- **Queue position** — For **local** generation, when the server is busy, the tool shows your position in line (e.g. *“You’re #3 · ~40s”*) with a **Cancel** button, then switches to live output when your turn arrives. **Cloud (BYOK)** requests skip the queue.
- **AI model settings** — Open **AI model settings** in the sidebar to choose **Local (organization)** or **Cloud (my API key)**. Each tool shows a badge with the active model source (e.g. *Local · gemma4:latest* or *Anthropic · Claude Sonnet 4.6*).
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
| **LLM settings** | Configure organization local LLM (Ollama or OpenAI-compatible), tier models, allowed model list, cloud BYOK policy, cloud model list refresh keys, and sidebar display name. See [LLM configuration](#llm-configuration). |
| **Enable / disable tools** | Turn individual tools on or off for all users. |
| **Per-tool model** | Override which local model a tool uses, chosen from the org allowed model list. |
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

Every generation records an anonymous usage event (tool, model, LLM source local/cloud, cached?, latency, status, anonymous system id, web vs Outlook). The **Analytics** admin page includes:

- **Unique systems** — distinct devices/browsers (anonymous ID per machine/profile; aggregate counts only, no IP list)
- **Overview** — total requests, success rate, cache hits, latency, web vs Outlook split
- **AI usage** — local vs cloud breakdown, cloud providers, top models
- **Per tool** — popularity share, unique systems, local/cloud mix, errors, satisfaction
- **Unused tools** — enabled tools with zero use in the date range
- **Daily trends**, **peak hours**, and **feedback** summary

No user inputs or outputs are stored.

### LLM configuration

WorkDesk supports **two tiers** of model configuration:

1. **Organization local LLM (admin)** — Operators configure the shared on-prem or LAN-hosted stack at **`/admin/llm-settings`**:
   - Backend type (**Ollama** or **OpenAI-compatible**), base URL, optional local API key
   - Tier models (default / code / quality) and the **allowed model list** (users and per-tool overrides must pick from this list)
   - **Cloud policy** — whether users may use cloud BYOK, and which provider groups are allowed
   - **Cloud model lists** — optional admin refresh API keys to pull live model IDs from OpenAI, Anthropic, and Google; lists auto-refresh about every 30 days (configurable). Without refresh keys, built-in curated presets are used.
   - **White-label** — organization display name in the sidebar footer
   - **Test connection** and **Refresh models** buttons for the local stack

2. **End-user preference (browser)** — Each user opens **AI model settings** in the sidebar:
   - **Local (organization)** — pick a model from the org allowlist, or leave blank to use the admin per-tool default
   - **Cloud (my API key)** — pick provider, model (curated dropdown with an **Other** option for manual model IDs), and API key. Custom provider also requires a base URL. Preferences are stored in `localStorage` on that device only.

On first startup, org LLM settings are **seeded from `.env`** (`OLLAMA_*`, `ALLOW_USER_CLOUD`, `ORG_DISPLAY_NAME`). After that, the admin console is the source of truth—no redeploy needed to point at another org’s Ollama host.

**Cloud BYOK privacy:** When a user selects cloud, their prompt text is sent from the WorkDesk backend to the chosen external provider using the user’s API key (the browser never calls the provider directly). Admins can disable cloud usage entirely or restrict which provider groups are allowed.

**Supported cloud providers** (in dropdown order): OpenAI, Anthropic (Claude), Google (Gemini), and Custom (any OpenAI-compatible API with user-supplied base URL). Custom always appears last in the list.

**Cloud model presets:** `GET /generate/llm-options` returns curated model dropdowns per provider. Admins can force a refresh via **Refresh cloud model lists now** in LLM settings, or set optional refresh keys in the admin UI or `.env` (`CLOUD_MODEL_REFRESH_*_KEY`). See [Environment variables](#environment-variables).

---

## How it works

```text
Browser  →  Angular UI  →  FastAPI :8000  →  local: single-consumer queue  →  org LLM (Ollama / OpenAI-compatible)
                              │              cloud: direct provider adapter (no queue)
                              ↓
                        SQLite (cache · settings · profile · prompts · usage · feedback · org LLM)
```

| Mechanism | Behavior |
| --------- | -------- |
| **Model routing (local)** | Tier defaults (`default` / `code` / `quality`) come from org LLM settings in the database (seeded from `.env` on first boot). Admins can override per tool. Users may override with an allowed local model in AI settings. |
| **Model routing (cloud)** | User picks provider + model in AI settings. Resolved in `llm_resolution.py`; streamed via provider adapters in `app/services/llm/`. |
| **Request queue** | An explicit **single-consumer job queue** runs **one local LLM request** at a time. Each waiting request is told its **position** and an **ETA** (rolling average of recent generation times). **Cloud BYOK requests bypass the queue.** Do not run multiple Uvicorn workers. |
| **Cache before queue** | The SQLite cache is checked **before** a request joins the queue, so a cache hit returns immediately and never waits behind a live generation. |
| **Response cache** | Identical prompts are served from SQLite for **24 hours** by default (`CACHE_TTL_HOURS`). Creative/high-churn tasks (e.g. email, MoM, code tools) skip cache; **Tone Fixer**, **Translate**, and **Eligibility Check** may use cache when inputs match. **Cloud requests always skip cache.** |
| **Cancellation** | Cancelling or closing a queued **local** request frees its slot immediately so abandoned requests do not block the line. |
| **Guards** | Inputs over `MAX_INPUT_CHARS` are rejected; each generation has a hard timeout (`GENERATION_TIMEOUT_S`). Provider errors are surfaced to the UI with the provider message when available. |
| **Streaming** | `POST /generate/stream` returns a readable stream of newline-delimited JSON frames (`fetch` + `ReadableStream`). Optional `llm` payload selects local vs cloud. |
| **Public LLM options** | `GET /generate/llm-options` returns local models, cloud policy, provider list, and cloud model presets for the AI settings UI. |
| **Health** | `GET /health` reports API status and Ollama reachability (for the configured org local backend). |

### Stream frames

```jsonc
{"type":"queued","position":3,"eta_s":48,"job_id":"..."}   // local only; repeated as the line advances
{"type":"start"}                                              // acquired the worker (or cache hit)
{"type":"token","t":"..."}                                    // repeated
{"type":"done","cached":false,"model":"..."}                 // success
{"type":"error","msg":"..."}                                  // failure (may include provider detail)
```

### Company Q&A *(planned)*

A future **Company Q&A** tool will let admins maintain company documents and answer questions with BM25 retrieval over indexed chunks. It is **not implemented** in the current build—there is no admin Documents page, ingest pipeline, or Q&A tool yet.

## What v1.0 is not

- **Not** a free-form ChatGPT-style chat—only the guided task tools.
- **Not** per-user file upload—end users type or paste only.
- **Not** cross-device history—recent results and favorites live only in the local browser.
- **Not** per-employee user accounts or role-based tool access (only global tool on/off via admin).
- **Not** mandatory cloud APIs—default inference uses the organization local LLM; optional cloud BYOK is user-controlled when enabled by admin.
- **Not** Company Q&A or document upload—planned for a future release.

---

## Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Python 3.11, FastAPI, SQLAlchemy 2 async, aiosqlite |
| Frontend | Angular 19 (standalone), Tailwind CSS 3         |
| Storage  | SQLite (cache, settings, company profile, prompt overrides, usage, feedback, org LLM settings) |
| LLM      | Organization local: Ollama or OpenAI-compatible; optional user cloud BYOK (OpenAI, Anthropic, Google, Custom) via `app/services/llm/` |
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

Example `.env` (see `backend\.env.example` for the full template):

```env
SQLITE_DB_PATH=./workdesk_cache.db
OLLAMA_BASE_URL=http://localhost:11434
CORS_ORIGINS=http://localhost:4200,https://localhost:3000
CACHE_TTL_HOURS=24
OLLAMA_MODEL_DEFAULT=gemma4:latest
OLLAMA_MODEL_CODE=codellama:7b
OLLAMA_MODEL_QUALITY=gemma4:latest
OLLAMA_ALLOWED_MODEL_OVERRIDES=gemma3:4b,gemma4:latest,codellama:7b,llava:7b
ALLOW_USER_CLOUD=false
ORG_DISPLAY_NAME=Adit Microsys Pvt. Ltd.
CLOUD_PRESET_REFRESH_DAYS=30
MAX_INPUT_CHARS=20000
GENERATION_TIMEOUT_S=180
ETA_WINDOW=20
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRE_MINUTES=480
# Optional: cloud model list refresh (admin UI can store keys instead)
# CLOUD_MODEL_REFRESH_OPENAI_KEY=
# CLOUD_MODEL_REFRESH_ANTHROPIC_KEY=
# CLOUD_MODEL_REFRESH_GOOGLE_KEY=
```

Start the API (always **one worker**):

```cmd
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

The SQLite database and org LLM settings are created on first startup. Lightweight schema patches for existing databases run automatically in `main.py`; no manual migration step is required for local dev.

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
| `CORS_ORIGINS` | UI origin(s); add `https://<host>/outlook-addin/` (or dev `https://localhost:3000`) for the Outlook add-in |
| Model variables | Match models installed on the Ollama server |
| `ALLOW_USER_CLOUD` / `ORG_DISPLAY_NAME` | Bootstrap org LLM policy and sidebar name (admin UI overrides after first boot) |
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

**Ollama URL / models** — prefer **`/admin/llm-settings`** to change the local base URL, allowed models, and cloud policy. `.env` `OLLAMA_*` values seed the database on first boot only; restart the backend after editing `.env` on a fresh install.

**Cloud model lists** — update refresh keys in **LLM settings** and click **Refresh cloud model lists now**, or set `CLOUD_MODEL_REFRESH_*_KEY` in `.env` and restart (auto-refresh runs on startup when lists are stale).

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
| `OLLAMA_ALLOWED_MODEL_OVERRIDES` | Yes | Comma-separated allowlist seeded into org allowed models on first boot |
| `ALLOW_USER_CLOUD` | No | Bootstrap default for admin “allow cloud BYOK” (default `false`) |
| `ORG_DISPLAY_NAME` | No | Bootstrap organization name shown in the sidebar footer |
| `CLOUD_PRESET_REFRESH_DAYS` | No | Days between automatic cloud model list refreshes (default `30`) |
| `CLOUD_MODEL_REFRESH_OPENAI_KEY` | No | Optional OpenAI key for fetching live model IDs (admin UI alternative) |
| `CLOUD_MODEL_REFRESH_ANTHROPIC_KEY` | No | Optional Anthropic key for fetching live model IDs |
| `CLOUD_MODEL_REFRESH_GOOGLE_KEY` | No | Optional Google key for fetching live model IDs |
| `MAX_INPUT_CHARS` | No | Reject pastes longer than this (default `20000`) |
| `GENERATION_TIMEOUT_S` | No | Hard per-request generation timeout (default `180`) |
| `ETA_WINDOW` | No | Recent samples used for the queue ETA average (default `20`) |
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
│   │   ├── data/           cloud_model_presets.py (curated cloud model defaults)
│   │   ├── models/         cache, task_settings, org_llm_settings, company_profile,
│   │   │                   prompt_override, analytics, app_feedback
│   │   ├── prompts/        templates.py (default task prompts), resolver.py
│   │   ├── routers/        generate.py, admin.py, feedback.py
│   │   ├── auth/           JWT for admin only
│   │   ├── schemas/        generate, admin, feedback
│   │   └── services/       llm/ (ollama, openai_compat, anthropic, google, router),
│   │                       cloud_model_presets.py, job_queue.py, org_llm_settings.py,
│   │                       llm_resolution.py, cache.py, company_profile.py,
│   │                       company_profile_admin.py, prompts_admin.py,
│   │                       usage.py, app_feedback.py
│   ├── scripts/            start_prod.bat
│   ├── alembic/            migration scaffolding (SQLite patches also run in main.py)
│   ├── main.py
│   ├── task_definitions.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── core/           services (generate, tasks, admin, llm-settings, theme,
│   │   │                   history, feedback), guards, utils, constants
│   │   ├── features/       shell/, tasks/ (12 tool components), admin/
│   │   │                   (login, llm-settings, tools, prompts, company-profile,
│   │   │                   analytics, feedback)
│   │   └── shared/         ai-settings-modal, llm-source-badge, streaming-output,
│   │                       queue-status, copy-button, output-feedback, etc.
│   ├── src/environments/   environment.ts, environment.prod.ts
│   └── scripts/            start_frontend.bat
├── outlook-addin/          Outlook task-pane add-in (Email Composer POC)
│   ├── manifest.xml
│   ├── taskpane.html, settings.html
│   └── src/services/       generate client, Office.js mail, history
├── .gitignore
└── README.md
```

---

## Architecture notes

- All LLM traffic goes through FastAPI; the browser never calls Ollama or cloud provider APIs directly.
- **Local** requests use an explicit single-consumer job queue in `app/services/job_queue.py` (one local generation at a time, with position and ETA). **Cloud BYOK** requests call provider adapters directly and skip the queue.
- The cache is consulted **before** enqueueing local work, so cache hits bypass the queue entirely.
- Responses are cached in SQLite except tasks listed in `NO_CACHE_TASK_TYPES` in `generate.py` and all cloud requests.
- Org LLM settings (local backend URL, tiers, allowlist, cloud policy, cloud presets) live in SQLite and are managed at `/admin/llm-settings`.
- Prompts resolve via `prompts/resolver.py`: database override first, else the default in `prompts/templates.py`.
- Streaming uses `fetch()` + `ReadableStream` with newline-delimited JSON frames, not `EventSource`.
- Existing SQLite databases receive lightweight column migrations on startup via `main.py` (no separate Alembic step required for typical upgrades).

---

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| UI loads, generate fails | `http://<server>:8000/health`, firewall on port 8000, `CORS_ORIGINS` matches browser URL |
| `ollama: unreachable` | Org local base URL in **LLM settings**, Ollama service running, model names pulled |
| Cloud option greyed out | Admin must enable **Allow users to use their own cloud API keys** in **LLM settings** |
| Cloud generation fails (401/404) | User API key and model ID in **AI model settings**; pick from the provider dropdown or use **Other** with a valid model ID from the provider’s docs |
| Cloud model list outdated | Admin → **LLM settings** → set refresh keys → **Refresh cloud model lists now** (or wait for the ~30-day auto-refresh) |
| Tool missing from sidebar | Admin may have disabled it; check `/admin/tools` |
| 404 on refresh in production | Frontend must be served with SPA mode (`serve -s` or IIS rewrite) |
| Long wait / high queue position | Expected on CPU Ollama under load for **local** requests; cloud bypasses the queue. Do not increase Uvicorn workers. |
| Request rejected before running | Input exceeded `MAX_INPUT_CHARS`; shorten the paste. |
| Recent results / favorites missing | They are per-browser (`localStorage`); cleared browser data or a different device/browser will not have them. |
| Edited prompt has no effect | Confirm the override was saved in **Prompt templates**; restart not required. Use **Reset to default** to revert. |
| Company Q&A not available | Company Q&A is not yet implemented in this build. |
| Admin login fails | `ADMIN_USERNAME` / `ADMIN_PASSWORD` in server `.env`; restart backend after changes |

---

## Outlook add-in (Email Composer POC)

An **Outlook compose** task-pane add-in lives in [`outlook-addin/`](outlook-addin/). It reads the draft body, calls the same `POST /generate/stream` endpoint with `task_type: email_composer`, and inserts plain-text output back into the message. Tone and length match the web Email Composer (Formal, Internal & team, Government & official; Standard or Brief).

| Topic | Detail |
| ----- | ------ |
| **Scope (POC)** | Email only; other WorkDesk tools may be added later. |
| **Settings** | WorkDesk API URL, web app URL, local vs cloud LLM, BYOK API key (stored in browser `localStorage`, keys `workdesk_outlook_*`). |
| **Open app** | Opens the full WorkDesk web UI in the browser (`workdesk_outlook_app_v1`, default `http://localhost:4200`). |
| **History** | Local undo stack when inserting (restore original draft or re-apply a generated version). |
| **CORS** | Include `https://localhost:3000` for dev (see `backend/.env.example`). |
| **Docs** | Full sideload and production steps: [`outlook-addin/README.md`](outlook-addin/README.md). |

Quick dev: start the backend, then `cd outlook-addin && npm install && npm run dev`, sideload `outlook-addin/manifest.xml` in Outlook, open a new email, and use the **WorkDesk AI** ribbon button.

---

## Sharing with colleagues

1. Deploy on the intranet ([Production deployment](#production-deployment-windows)).
2. Share the UI URL, e.g. `http://<server-ip>/`.
3. Optionally share the admin URL with IT only: `http://<server-ip>/admin/login`.

No browser extension is required. Possible later enhancements: PWA install, VPN-only binding, Company Q&A with BM25/embedding retrieval, or per-user login.
