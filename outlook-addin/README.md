# WorkDesk AI — Outlook Add-in

A task-pane add-in for **Outlook compose** that reads your email draft, generates a polished version via the WorkDesk AI backend, and inserts it back — with full **HTML formatting**, **signature preservation**, and **version history**.

---

## What it does

### Compose tab

1. **Read draft** — Click **Refresh** to pull the current compose body. The add-in reads both HTML and plain-text, strips the signature (auto-detected by closing lines like "Regards" or `id="signature"` divs), and shows the editable portion in the preview.

2. **Set options**
   - **Tone** — Formal · Internal & Team · Government & Official
   - **Length** — Standard · Brief

3. **Generate** — Sends the draft text + options to `POST /generate/stream` on the WorkDesk backend. Responses stream token-by-token (NDJSON). A queue position is shown if the backend is busy. Generation can be stopped mid-stream.

4. **Insert** — Writes the AI output back to the compose body as properly formatted HTML (paragraphs, lists, bold), re-attaches the original signature, and optionally sets a **Subject** line if the model generated one. Falls back to Copy-to-clipboard if Office write access is denied.

5. **Copy** — Copies generated text to clipboard without inserting.

### History tab

Every successful insert is saved locally (up to **20 entries**, **50 KB** each). Each entry records:
- Original draft (plain text + full HTML)
- Generated version (plain text + HTML with signature)
- Tone, length, and timestamp

Actions per entry: **Restore original** (puts the pre-AI draft back), **Use generated** (re-inserts the AI version), **Delete**.

### Settings page

| Setting | Description |
|---------|-------------|
| **WorkDesk API URL** | URL of the FastAPI backend (`/generate/stream`, `/generate/llm-options`, etc.) |
| **Web app URL** | Opens the full WorkDesk AI web UI from within Outlook |
| **AI source** | `Local (organization)` — uses the org's Ollama/LLM backend |
| | `Cloud (my API key)` — BYOK via OpenAI, Anthropic, Google, or a Custom endpoint |
| **Local model** | Pick a specific local model or leave blank for org default |
| **Cloud provider + model** | Provider → Model from preset list (or type a custom model ID) |
| **API key** | Stored in `localStorage` only; never sent to the backend except as the generation payload |
| **Custom base URL** | For `Custom` provider: your OpenAI-compatible endpoint |
| **Test connection** | Hits `/generate/limits` to verify the API URL is reachable |
| **Use dev proxy URL** | One-click to set the Vite proxy path (`/workdesk-api`) — the safe default for HTTPS dev |

The active model is shown as a **status badge** on the Compose tab (e.g. `Anthropic · Claude Haiku 4.5 (fast)`).

### Open full app

The external link button in the header opens the WorkDesk AI web app in the browser (`Office.context.ui.openBrowserWindow` or `window.open` fallback).

---

## Architecture

| Layer | Technology |
|-------|-----------|
| UI | Vanilla TypeScript — no Angular/React/Vue |
| Styling | Single CSS file (`shared.css`), adaptive dark/light via `prefers-color-scheme` |
| Font | Inter (Google Fonts) with Segoe UI / system-ui fallback |
| Build | Vite (multi-page: `taskpane.html`, `settings.html`, `index.html`) |
| Office | `office.js` CDN, `Office.onReady`, Mailbox 1.3+ |
| State | Module-level variables + `localStorage` (no backend session) |

### Services (`src/services/`)

| File | Responsibility |
|------|---------------|
| `api-config.ts` | API + app URL storage, same-origin proxy path, mixed-content detection |
| `generate-client.ts` | NDJSON streaming from `/generate/stream`, cancel via `/generate/cancel`, input-size validation |
| `llm-settings.ts` | LLM options fetch, user settings persistence, generate payload builder |
| `office-mail.ts` | Office.js body read (HTML + text), insert (HTML), restore, subject set |
| `body-parts.ts` | Signature split/merge (HTML div markers + plain-text closing-line heuristic), plain→Outlook HTML conversion |
| `outlook-history.ts` | History CRUD in `localStorage` (max 20 entries, 50 KB body cap) |
| `outlook-rich-html.ts` | Plain text → Outlook-safe HTML with paragraph/list/bold formatting and style inheritance |
| `open-app.ts` | Open web app URL via Office API or `window.open` |

### Streaming protocol

The backend streams NDJSON frames. The add-in handles:

| Frame type | Action |
|------------|--------|
| `queued` | Shows queue position + ETA, stores `job_id` for cancel |
| `start` | Clears queue status, begins token accumulation |
| `token` | Appends `t` field to output textarea |
| `truncated` | Shows truncation warning |
| `done` | Finalises output, enables Insert/Copy |
| `error` | Shows error message |

Cancel sends `POST /generate/cancel` with the `job_id` and aborts the fetch stream.

### Signature handling

On **read**: the compose body is split into `(editableText, signatureHtml)` by:
1. HTML: looks for `<div id="signature">`, `class="signature"`, or `data-smartmail="signature"`
2. Plain text: looks for `--` separator or standard closing lines (Regards, Thanks, Sincerely, etc.)

On **insert**: the generated HTML is merged back with the preserved `signatureHtml` before writing to Office, so the signature is never lost.

On **restore**: the full original HTML (pre-generation snapshot) is written back verbatim.

---

## Prerequisites

- WorkDesk backend running (`uvicorn` on port 8000 by default)
- Node.js 18+
- Outlook for Windows (Microsoft 365 desktop) or [Outlook on the web](https://aka.ms/olksideload)
- HTTPS for the add-in dev server (Vite + Microsoft dev certs on port 3000)

---

## Development setup

You need **two servers running simultaneously**:

| App | Folder | Command | URL |
|-----|--------|---------|-----|
| WorkDesk **web UI** | `frontend/` | `npm start` | http://localhost:4200 |
| **Outlook add-in** | `outlook-addin/` | `npm run dev` | https://localhost:3000 |

`ERR_CONNECTION_REFUSED` on `https://localhost:3000` means the add-in server is not running — `npm start` in `frontend/` does **not** start it.

### 1. Install dependencies and dev certificates

Run once per machine (accepts the UAC/admin prompt):

```bash
cd outlook-addin
npm install
npm run certs
```

### 2. Start the dev server

```bash
npm run dev
```

### 3. Verify in Edge

Open these URLs — both must load without SSL errors:

- https://localhost:3000/taskpane.html
- https://localhost:3000/assets/icon-64.png

If you see `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`: stop the server, re-run `npm run certs`, restart `npm run dev`.

### 4. Sideload the manifest

**Outlook desktop (Windows)** — recommended for localhost:  
File → Get Add-ins → My add-ins → **Add a custom add-in** → **Add from file** → select `outlook-addin/manifest.xml`.

**Outlook on the web** — Outlook's servers cannot reach `localhost`. Use a tunnel:

```bash
ngrok http https://localhost:3000
```

Replace every `https://localhost:3000` in `manifest.xml` with the ngrok URL, add it under `<AppDomains>`, then sideload again.

### 5. Use the add-in

1. Open a **new compose** email in Outlook.
2. Click **WorkDesk AI** on the ribbon.
3. Go to **Settings** (sliders icon, top right) — set the API URL and LLM source, then **Save** and **Test connection**.
4. Back on **Compose**: click **Refresh** to read your draft, pick Tone and Length, then **Generate email**.
5. Review the output, then **Insert** to write it to the compose body, or **Copy** to paste manually.

---

## Backend configuration

Add the add-in origin to `CORS_ORIGINS` in `backend/.env`:

```env
CORS_ORIGINS=http://localhost:4200,https://localhost:3000
```

For cloud BYOK (user-supplied API keys), enable in admin LLM settings:

```env
ALLOW_USER_CLOUD=true
```

Update `manifest.xml` `<AppDomains>` if your API is not on `http://localhost:8000`.

### HTTPS → HTTP mixed-content

Outlook loads the task pane over HTTPS (`https://localhost:3000`). Browsers block `fetch` to plain `http://localhost:8000` from an HTTPS page. The Vite dev server proxies `/workdesk-api/*` → `http://localhost:8000/*` to work around this. The **Use dev proxy URL** button in Settings sets this automatically.

In production, host the API on HTTPS and point the API URL there directly.

---

## Production build

```bash
cd outlook-addin
npm run build
```

1. Deploy `dist/` to any HTTPS static host (e.g. `https://workdesk.company/outlook-addin/`).
2. Replace every `https://localhost:3000` in `manifest.xml` with your production URL.
3. Add that origin to `CORS_ORIGINS` on the backend.
4. Distribute the updated `manifest.xml` via your organisation's add-in catalog or re-sideload.

---

## Sideload troubleshooting

| Check | Expected |
|-------|---------|
| `npm run dev` running | `https://localhost:3000/` loads in Edge |
| Icons | `https://localhost:3000/assets/icon-64.png` shows the WorkDesk icon |
| Compose window | A new email must be open when clicking the ribbon button |

**"Installation failed" / "taking longer than expected":**

1. Dev server must be running before you install.
2. Run `npm run certs` if not done, then open the icon URL in Edge to confirm no SSL errors.
3. Use Outlook **desktop**, not Outlook on the web, for `localhost` (web version validates from Microsoft's cloud).
4. Remove a stuck add-in via Get Add-ins → My add-ins → remove, then re-install.
5. For Outlook on the web: use ngrok (see above).
6. If **Add from file** is missing, IT policy may block custom add-ins.

---

## Project layout

```
outlook-addin/
├── manifest.xml              # Office add-in manifest (IDs, icons, URLs, permissions)
├── taskpane.html             # Main UI: Compose + History tabs
├── settings.html             # Settings page: API, web app URL, LLM
├── index.html                # Dev index (redirects to taskpane.html)
├── vite.config.ts            # HTTPS dev server, /workdesk-api proxy, multi-page build
├── public/
│   └── assets/
│       ├── icon-16.png       # Manifest icons (branded WorkDesk AI icon)
│       ├── icon-32.png
│       ├── icon-64.png
│       ├── icon-80.png
│       ├── icon-128.png
│       ├── workdesk-ai-icon.svg        # Dark-mode icon (light strokes)
│       └── workdesk-ai-icon-light.svg  # Light-mode icon (dark strokes)
└── src/
    ├── styles/
    │   └── shared.css        # Full design system: tokens, components, dark/light themes
    ├── ui/
    │   └── icons.ts          # Inline SVG icon map (settings sliders, sparkles, etc.)
    ├── taskpane/
    │   └── taskpane.ts       # Main app logic: tabs, generate flow, history rendering
    ├── settings/
    │   └── settings.ts       # Settings page logic: load/save/test
    └── services/
        ├── api-config.ts     # URL management, mixed-content handling
        ├── generate-client.ts # Streaming generate, cancel, input validation
        ├── llm-settings.ts   # LLM options, user settings, payload builder
        ├── office-mail.ts    # Office.js body read/write, signature handling
        ├── body-parts.ts     # Signature split/merge, plain→HTML
        ├── outlook-rich-html.ts # Outlook-safe HTML generation
        ├── outlook-history.ts # Version history (localStorage)
        └── open-app.ts       # Launch web app from add-in
```
