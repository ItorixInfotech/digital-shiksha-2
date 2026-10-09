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

## Category predictor (v3)
POST /api/predictor body: {exam, score, category: General|OBC|EWS|SC|ST, cities: ["Pune","Mumbai"] | [] (all India)}.
Reserved-category cutoffs are ESTIMATED from the General value: percentile 100-(100-v)*factor (EWS 1.4, OBC 1.6, SC 3.5, ST 6); NEET score minus (EWS 10, OBC 12, SC 70, ST 110); JEE Adv category rank = GEN rank × (EWS .2, OBC .45, SC .25, ST .12). Results carry `estimated` + `general_cutoff`.
Every prediction is logged to `predictions` collection.

## Student confirmation email
If a lead includes an email, a fixed-template thank-you (counsellor phone/email/address/hours) is sent to the student — max 1 per email address per 24 h; only a sanitised first name is interpolated.

## Admin Predictor Report
GET /api/admin/predictor-report (admin cookie): totals, last 7 days, predictor leads count, per-exam searches/avg/score buckets/category counts, 50 recent predictions. Admin tab "Predictor Report" also lists leads with source=predictor.

## v4: Official cutoff upload, WhatsApp alerts, shareable prediction
- cutoffs[] rows now have `category` (General|OBC|EWS|SC|ST, default General). Predictor uses an official row for the student's category when present (estimated=false), else estimates from General.
- Admin "Cutoff Upload" tab: GET /api/admin/cutoffs/template (xlsx: Instructions, Cutoffs [College, Course/Branch, Exam, Category, Closing value] pre-filled, Colleges), POST /api/admin/cutoffs/upload?dry_run=true|false (multipart file .xlsx/.csv ≤5MB). Upsert key = college + branch(case-insens.) + exam + category. College matched by name / short name / slug. CET codes GOPENS/GOBCS/GSCS/GSTS accepted; ladies (L*) rejected.
- WhatsApp: lib/whatsapp.py sends Twilio WhatsApp message to WHATSAPP_ALERT_TO (+918149689468) on each new (non-duplicate) lead — NO-OP until TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM are set in backend/.env (currently empty). AdminStats.whatsapp_alerts shows status. Leads table has one-tap wa.me buttons (message student / forward to counsellor).
- Predictor page is URL-driven (/predictor?exam=&score=&category=&city=both|Pune|Mumbai|all) → shareable; GET /api/predictor/pdf?exam=&score=&category=&cities=Pune,Mumbai returns branded PDF (reportlab, not logged as a prediction). "Share on WhatsApp" uses wa.me/?text= with the results link.

## v5: Twilio WhatsApp live keys + student WhatsApp list
- backend/.env has real Twilio TRIAL creds (sender +17372508034). Trial = free-form Body rejected ("ContentSid Required") and only verified recipients allowed. Needs: TWILIO_LEAD_TEMPLATE_SID ({{1}} name, {{2}} mobile, {{3}} interest, {{4}} details) and TWILIO_STUDENT_TEMPLATE_SID ({{1}} first name, {{2}} exam & score, {{3}} top colleges, {{4}} results link); empty → falls back to Body.
- LeadIn has `prediction` {exam, score, category, cities} + `whatsapp_opt_in`. Predictor "Get guidance" sends both; form shows opt-in checkbox (default on). Student list sent max once per phone / 24 h; link uses PUBLIC_SITE_URL env.
- Last send status per kind stored in `settings` collection (key whatsapp_lead / whatsapp_student) and shown in Admin → Leads banner via AdminStats.whatsapp.

## v6: Admin → WhatsApp tab
- GET /api/admin/whatsapp (panel), POST /api/admin/whatsapp/check (re-query Twilio Content API), PUT /api/admin/whatsapp/templates {lead_sid, student_sid} (HX + 32 hex, or empty; stored in settings key whatsapp_templates, env fallback), POST /api/admin/whatsapp/test {kind: sample|lead|student} → sends to WHATSAPP_ALERT_TO[0], GET /api/admin/whatsapp/messages/{SM|MM sid} → delivery status (UI polls every 2.5s until delivered/read/failed/undelivered).
- effective_template(kind): template used only if WhatsApp status approved (or "unavailable"/"unknown" = cannot verify, e.g. trial → tried anyway); non-approved re-checked at most every 10 min, so it switches on automatically.
- TWILIO_SAMPLE_TEMPLATE_SID = Twilio's fixed sample (HXfe5ab5…) used only by "Connection test" — delivered OK to +918149689468 on trial.

## v7: Counsellor assignment + morning reminders
- `counsellors` collection {id, name, phone (10-digit, unique), email?, active, created_at}. Admin → Counsellors tab: add / activate / remove (removing unassigns their leads), lead counts.
- Lead has `counsellor_id` (admin-only; not in public LeadIn). Leads tab: per-row Counsellor select (PATCH /api/admin/leads/{id}/assign {counsellor_id|null, notify}) → WhatsApp + email alert to that counsellor; counsellor filter; CSV has Counsellor column; "forward" wa.me button uses assigned counsellor's number.
- Settings (GET/PUT /api/admin/counsellor-settings {auto_assign, reminder_template_sid}): auto-assign = round-robin over active counsellors (atomic rr_cursor in settings key counsellor_settings).
- New enquiry: WhatsApp → assigned counsellor (else WHATSAPP_ALERT_TO); email → owner LEAD_ALERT_EMAIL always + counsellor email if set.
- Reminders: all status=New leads grouped per active counsellor; unassigned → admin number + LEAD_ALERT_EMAIL. WhatsApp (template TWILIO_REMINDER_TEMPLATE_SID / settings: {{1}} first name, {{2}} count, {{3}} list; else free-form Body) + email. POST /api/admin/reminders/send (manual button) and POST /api/cron/morning-reminders (Bearer WEBHOOK_CRON_SECRET, idempotent on X-Webhook-Id in cron_runs) scheduled by .emergent/crons.yml at 08:00 Asia/Kolkata. Last run summary in settings.last_reminder.
