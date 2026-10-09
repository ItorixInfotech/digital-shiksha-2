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

## Auth
Single admin from backend/.env (ADMIN_USERNAME / ADMIN_PASSWORD). See memory/test_credentials.md.
