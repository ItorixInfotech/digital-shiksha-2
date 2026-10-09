# Digital Shiksha — Self-hosting migration guide (backend)

Backend framework: **FastAPI (Python 3.11) + Motor (async MongoDB driver) + Pydantic v2**, served by **uvicorn**.
Your live Emergent app is untouched — everything here lives in `/migration` and is a copy.

```
migration/
├── backend/                     ← deploy this folder (self-contained)
│   ├── server.py                ← ENTRY POINT  (ASGI app = server:app)
│   ├── requirements.txt         ← pruned, pinned production deps
│   ├── .env.example             ← every env var name (no secrets) — copy to .env
│   ├── Procfile / Dockerfile    ← start command for Render/Railway/Heroku/Docker
│   ├── lib/        db.py (Mongo client + indexes) · email.py (Resend) · whatsapp.py (Twilio) · pdf.py (ReportLab)
│   │               counsellors.py · seo_score.py · cron.py (cron auth) · dates.py
│   ├── models/     content.py (College/Course/Exam/Article/Lead/SEO/FAQ) · predictor.py · counsellor.py · landing.py · seo.py
│   ├── routers/    public.py · admin.py (AUTH) · predictor.py · cutoffs.py · whatsapp_admin.py · counsellors.py
│   │               seo.py · landing.py · seo_tools.py · export.py
│   ├── assets/logo.png          ← used in PDF reports
│   └── seed.py / seed_mh.py     ← demo seed data — DO NOT run against your imported Atlas DB
├── frontend-changes/            ← hosting configs for the exported frontend
└── scheduler/                   ← replacements for Emergent's managed cron jobs
```

## Changes vs. the Emergent copy (all backward-compatible)
| File | Change | Why |
|---|---|---|
| `lib/email.py` | Sends through **your own Resend account** (`RESEND_API_KEY`, `EMAIL_FROM`). Emergent proxy only used if `EMERGENT_EMAIL_KEY` is set. If neither is set, emails are skipped with a log warning (lead capture still works). | The Emergent-managed email key is not portable. |
| `routers/admin.py` | Cookie `SameSite` / `Secure` / `Domain` configurable via `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`. Defaults = current behaviour. | Lets the admin login work if the API is on another domain. |
| `routers/seo.py` | sitemap/robots use `PUBLIC_SITE_URL` first. | So the sitemap lists `www.digitalshiksha.in` URLs, not `api.` URLs. |
| `server.py` | trims spaces in `CORS_ORIGINS`. | — |
| `requirements.txt` | only what the code imports (no `emergentintegrations`, pandas, test tools). Adds `pymongo[srv]` for Atlas `mongodb+srv://`. | Smaller, faster deploys. |

## Authentication (how admin login works)
- `POST /api/auth/login {username, password}` compares against `ADMIN_USERNAME` / `ADMIN_PASSWORD` (constant-time).
- On success sets an **httpOnly cookie `ds_admin`** = JWT (HS256, signed with `JWT_SECRET`, 7-day expiry).
- Every `/api/admin/*` route depends on `require_admin` (routers/admin.py), which validates that cookie → 401 otherwise.
- `GET /api/auth/me` checks the session; `POST /api/auth/logout` clears it. No student accounts.
- `/api/cron/*` endpoints are protected by `Authorization: Bearer <WEBHOOK_CRON_SECRET>` instead.

## 1 · Connect MongoDB Atlas
1. Atlas → **Database Access** → create a user with `readWrite` on your database.
2. Atlas → **Network Access** → add your server's outbound IP (or `0.0.0.0/0` for Render/Railway/Vercel-style hosts with dynamic IPs).
3. Atlas → **Connect → Drivers → Python** → copy the `mongodb+srv://…` string → `MONGO_URL`. URL-encode special characters in the password (`@`→`%40`, `#`→`%23`).
4. `DB_NAME` = the database name you imported into. The Emergent export file (`digital-shiksha-db-*.json`) came from database **`app`**; the collections are
   `colleges, courses, exams, articles, leads, predictions, counsellors, landing_pages, settings, cron_runs, status_checks`.
5. Indexes (unique slugs/ids, counsellor phone, lead filters) are created automatically at startup — no manual step.

> Imported from the JSON export? It's MongoDB Extended JSON. Per collection: `mongoimport --uri "$MONGO_URL" --db app --collection colleges --jsonArray file.json`, or load with `bson.json_util.loads` + `insert_many`. Dates must stay as real dates (`{"$date": …}`) — not strings.

## 2 · Environment variables (names only — values in your `.env` / host dashboard)
**Required:** `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `PUBLIC_SITE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`
**Email (Resend):** `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `LEAD_ALERT_EMAIL`, `SEO_REPORT_EMAIL` (optional), `EMERGENT_EMAIL_KEY` (leave empty)
**WhatsApp (Twilio, optional):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `WHATSAPP_ALERT_TO`, `TWILIO_LEAD_TEMPLATE_SID`, `TWILIO_STUDENT_TEMPLATE_SID`, `TWILIO_REMINDER_TEMPLATE_SID`, `TWILIO_SAMPLE_TEMPLATE_SID`
**Cron:** `WEBHOOK_CRON_SECRET`
**Cookie (only for cross-site hosting):** `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN`
**Optional:** `APP_TZ` (e.g. `Asia/Kolkata`)

Generate secrets: `python -c "import secrets;print(secrets.token_urlsafe(48))"` (use a NEW `JWT_SECRET` and `WEBHOOK_CRON_SECRET`; you may reuse your admin password and Twilio keys from your current setup).
Resend: sign up at resend.com → Domains → add `digitalshiksha.in` and its DNS records → API Keys → create key. `EMAIL_FROM` must be on that verified domain.

## 3 · Install & start
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in values
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2 --proxy-headers --forwarded-allow-ips="*"
```
- **Render / Railway / Heroku:** root dir `backend`, build `pip install -r requirements.txt`, start = the `Procfile` line (uses `$PORT`).
- **Docker:** `docker build -t ds-api backend && docker run -p 8001:8001 --env-file backend/.env ds-api`
- **VPS:** run the uvicorn command under systemd/supervisor and put nginx in front (see `frontend-changes/nginx.conf`).
- Health check: `GET /api/` → `{"message":"Digital Shiksha API"}`.
Note: `load_dotenv` reads `backend/.env` if present; host-dashboard env vars work too (they take precedence only if `.env` doesn't define them — prefer one or the other).

## 4 · Frontend / API URL configuration
The frontend calls **relative `/api/...`** paths (in `src/lib/api.ts`), and the admin cookie is first-party. Pick one:

**Option A — recommended, zero code changes: proxy `/api` from the frontend domain to the backend.**
- Vercel: put `frontend-changes/vercel.json` in the frontend root (edit `api.digitalshiksha.in` to your backend URL).
- Netlify: copy `frontend-changes/netlify_redirects` to `public/_redirects`.
- Own server: `frontend-changes/nginx.conf` (serves `dist/` + proxies `/api`, `/sitemap.xml`, `/robots.txt`).
- Backend env: `CORS_ORIGINS=https://www.digitalshiksha.in`, `COOKIE_SAMESITE=lax`.

**Option B — call the API directly on another domain.**
1. Replace `src/lib/api.ts` with `frontend-changes/option-b-separate-api-domain/api.ts` (adds `VITE_API_BASE_URL` + `credentials: "include"`).
2. Two download links use plain hrefs — change them to use the base:
   - `src/pages/Admin.tsx`: `href="/api/admin/export"` → `` href={`${BASE}/admin/export`} `` (add `import { BASE } from "@/lib/api";`)
   - `src/components/admin/CutoffUpload.tsx`: `href="/api/admin/cutoffs/template"` → `` href={`${BASE}/admin/cutoffs/template`} ``
3. Build with `VITE_API_BASE_URL=https://api.digitalshiksha.in/api yarn build`.
4. Backend env: `CORS_ORIGINS=https://www.digitalshiksha.in`. If the API is a subdomain of the same site (`api.digitalshiksha.in`) keep `COOKIE_SAMESITE=lax`; if it's a different site (e.g. `*.onrender.com`) set `COOKIE_SAMESITE=none` (HTTPS required; some browsers block third-party cookies — Option A avoids this).

Either way: the frontend host must rewrite unknown paths to `index.html` (SPA routes like `/colleges/coep-pune`, `/engineering-colleges-in-pune`, `/admin`) — included in all three configs. Static `/sitemap.xml` and `/robots.txt` must be proxied to `/api/sitemap.xml` and `/api/robots.txt` (also included); then submit `https://www.digitalshiksha.in/sitemap.xml` in Google Search Console.

## 5 · Scheduled jobs (Emergent crons don't move with you)
| Job | Schedule | Endpoint |
|---|---|---|
| Counsellor morning reminders | daily 08:00 IST (02:30 UTC) | `POST /api/cron/morning-reminders` |
| Weekly SEO report | Monday 09:00 IST (03:30 UTC) | `POST /api/cron/weekly-seo-report` |
Both need header `Authorization: Bearer <WEBHOOK_CRON_SECRET>` and a JSON body (`{}` is fine); an optional `X-Webhook-Id` makes retries idempotent. Use `scheduler/github-actions-crons.yml`, `scheduler/crontab.txt`, or any HTTP cron service (cron-job.org, Render Cron Job, Railway cron).

## 6 · Full API route list (all under `/api`)
Public: `GET /` · `GET /meta` · `GET /search` · `GET /colleges` · `GET /colleges/{slug}` · `GET /courses` · `GET /courses/{slug}` · `GET /exams` · `GET /exams/{slug}` · `GET /articles` · `GET /articles/{slug}` · `GET /landing` · `GET /landing/{slug}` · `GET /seo/pages` · `GET /sitemap.xml` · `GET /robots.txt` · `POST /enquiries` · `GET /predictor/exams` · `POST /predictor` · `GET /predictor/pdf`
Auth: `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`
Admin (cookie): `GET /admin/stats` · `GET /admin/leads` · `PATCH|DELETE /admin/leads/{id}` · `PATCH /admin/leads/{id}/assign` · `POST /admin/{colleges|courses|exams|articles}` · `PUT|DELETE /admin/{colleges|courses|exams|articles}/{id}` · `GET /admin/predictor-report` · `GET /admin/cutoffs/template` · `POST /admin/cutoffs/upload` · `GET /admin/whatsapp` · `POST /admin/whatsapp/check` · `PUT /admin/whatsapp/templates` · `POST /admin/whatsapp/test` · `GET /admin/whatsapp/messages/{sid}` · `GET|POST /admin/counsellors` · `PUT|DELETE /admin/counsellors/{id}` · `GET|PUT /admin/counsellor-settings` · `POST /admin/reminders/send` · `PUT /admin/landing/{slug}` · `PUT /admin/seo/pages` · `POST /admin/seo/keywords` · `POST /admin/seo/report/send` · `GET /admin/export`
Cron (bearer): `POST /cron/morning-reminders` · `POST /cron/weekly-seo-report`
Interactive docs once running: `https://<api-host>/docs`.

## 7 · Go-live checklist
1. `GET /api/` and `GET /api/colleges?limit=1` return data from Atlas.
2. Log in at `/admin/login` → Leads tab loads (cookie works through your proxy/domain).
3. Submit a test enquiry → lead appears in admin and the alert email arrives (Resend dashboard shows it).
4. `https://www.digitalshiksha.in/sitemap.xml` lists `www.` URLs.
5. Trigger each cron once manually (GitHub Actions "Run workflow" or curl) → 202.
6. Twilio: update the WhatsApp sender/templates if you change numbers; trial accounts only deliver to verified numbers.
