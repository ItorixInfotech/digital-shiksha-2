# Digital Shiksha — App Spec

Collegedunia-style India-only higher-education portal for Digital Shiksha (Pune admission consultant). No Study/Work Abroad.

## Brand
Logo `/frontend/public/logo.png` (from digitalshiksha.in). Colours: red #DC2626, navy #0A2540, blue #1E3A8A, teal #0D9488, green #16A34A. Font: Apple SF Pro system stack.
Contact: +91 8149 68 9468, enquiry@digitalshiksha.in, Saudamini Commercial Complex, C1-203, Paud Road, Bhusari Colony, Kothrud, Pune 411038.

## Data (Mongo, seeded by `backend/seed.py`, idempotent upsert by slug)
- colleges (28): slug, name, city, state, type, streams[], nirf_rank, fees, packages, exams_accepted[], courses[], cutoffs[] ... e.g. `coep-pune`, `iit-bombay`, `sibm-pune`, 11 in Pune, 6 in Mumbai
- courses (44): e.g. `btech`, `mba`, `mbbs`, `ba-llb`
- exams (32): e.g. `jee-main`, `neet-ug`, `mht-cet`, `cat`, `clat`
- articles (6): e.g. `mht-cet-2026-cap-round-guide`
- leads: created from public enquiry forms (phone must be 10-digit Indian mobile, regex ^[6-9]\d{9}$), status New/Contacted/In-Progress/Converted

## API (/api)
Public: GET /colleges (q, stream, city, state, type, max_fees, featured, sort=rank|rating|package|fees), /colleges/{slug}, /courses, /courses/{slug}, /exams, /exams/{slug}, /articles, /articles/{slug}, /search?q=, /meta; POST /enquiries
Auth: POST /auth/login (httpOnly cookie ds_admin JWT), POST /auth/logout, GET /auth/me
Admin (cookie): GET /admin/stats, GET /admin/leads, PATCH/DELETE /admin/leads/{id}, POST /admin/{colleges|courses|exams|articles}, PUT/DELETE /admin/{res}/{id}

## Frontend routes
/ , /colleges, /colleges/:slug (tabs), /courses, /courses/:slug, /exams, /exams/:slug, /compare (?c=slug1,slug2 up to 3; shortlist persisted in localStorage), /news, /news/:slug, /consultation, /admin/login, /admin
Enquiry modal (header "Enquire Now", college "Apply"), floating WhatsApp/Call, compare bar.

## Lead email alerts
POST /enquiries saves the lead then (BackgroundTask) emails LEAD_ALERT_EMAIL (enquiry@digitalshiksha.in) via Emergent-managed Resend (`backend/lib/email.py`, from_name = EMAIL_FROM_NAME "Digital Shiksha"). Same phone again within 10 min → saved but no 2nd email. Email failures are logged, never break the request.

## College predictor
GET /api/predictor/exams; POST /api/predictor {exam, score, city?} → results with chance High/Medium/Reach.
Exams: MHT CET (percentile), JEE Main (percentile), NEET UG (score /720), MAH MBA CET (percentile), JEE Advanced (rank, lower better).
Uses `cutoffs[].value` on colleges (curated in `backend/seed_mh.py` REAL_CUTOFFS, approx GOPEN previous-year). Margins: percentile 0/0.8/2.0, score 0/15/35, rank ×1/1.15/1.4.
Frontend /predictor; "Pune & Mumbai" option fires two requests (city=Pune, city=Mumbai) and merges.
Seed now has 56 colleges (incl. SPIT, DJ Sanghvi, Cummins, KEM, JJ, SIMSREE, SPJIMR...).

## Auth
Single admin from backend/.env (ADMIN_USERNAME / ADMIN_PASSWORD). See memory/test_credentials.md.
