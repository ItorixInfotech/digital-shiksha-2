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

## v8: On-page SEO
- `seo` (SeoMeta: meta_title, meta_description, keywords[], canonical_url, og_image, noindex) on colleges/courses/exams/articles; edited in every admin record dialog (SeoEditor: live Google preview + counters, title 60 / desc 160). Empty → auto defaults from `frontend/src/lib/seo.ts` defaultSeo() (e.g. "COEP Pune: Fees, Cutoff, Placements 2026 | Digital Shiksha"); year from server (GET /api/seo/pages .year).
- Static pages (home, colleges, courses, exams, news, predictor, compare, consultation): GET /api/seo/pages (public), PUT /api/admin/seo/pages; stored in settings key seo_pages; Admin tab "SEO → Pages".
- `components/Seo.tsx` (Seo / PageSeo / EntitySeo) writes title, description, keywords, robots, OG/Twitter, canonical and JSON-LD (CollegeOrUniversity, Course, NewsArticle, BreadcrumbList, EducationalOrganization + WebSite on home) into <head>. Admin + 404 are noindex.
- /api/sitemap.xml + /api/robots.txt (host from X-Forwarded-Host, else PUBLIC_SITE_URL); Vite server+preview proxy also serves them at /sitemap.xml and /robots.txt. noindex records/pages and off-site canonicals are excluded.

## v9: SEO score, FAQs, City landing pages
- `faqs: FaqItem[] {question, answer}` on colleges + exams (admin FaqEditor in record dialog); rendered by `components/FaqSection.tsx` accordion on detail pages + FAQPage JSON-LD.
- SEO score (`lib/seo.ts` seoScore/entityScore): title 30–60, description 70–160, focus keyword (seo.keywords[0]) in title/desc, OG/cover image, overview/content ≥300 chars, ≥1 FAQ (colleges/exams/city pages only), not noindex. ≥80 green, ≥50 amber, else red. `SeoBadge` (hover checklist) in admin Colleges/Courses/Exams/Articles/City Pages lists + live score in dialogs.
- City landing pages: routers/landing.py auto-generates every stream × city with colleges; slug `{stream}-colleges-in-{city}` (Management → `mba`, Computer Applications → `bca-mca`), e.g. /engineering-colleges-in-pune, /mba-colleges-in-mumbai. GET /api/landing (list), GET /api/landing/{slug} (h1, intro, stats, ranked colleges, faqs, related links), PUT /api/admin/landing/{slug} {intro, faqs, seo} (all-empty body deletes override). Overrides in `landing_pages` collection; empty intro/FAQs → auto-generated from data. Frontend route `/:landing` (pages/Landing.tsx; unknown slug → NotFound). Included in sitemap. Admin tab "City Pages". Footer "Popular Searches" links.

## v10: SEO Fix List (Admin tab "SEO Fix List", components/admin/SeoDashboard.tsx)
- Client-side: scores every college/course/exam/article/city page (same query keys as the content tabs so saves refresh it). Summary cards (green/amber/red per type, click = filter), type + colour filters (default red+amber).
- Sort: fixEffort = sum of FIX_EFFORT of failing checks (index 1, keyword 1, title 2, description 2, image 2, faqs 3, content 4), then higher score, then name. Failing checks shown as chips.
- "Fix" opens the record's own edit dialog in place: ContentManager / LandingManager accept `editSlug` + `onClose` (dialog-only mode). Field specs moved to components/admin/resources.ts (RESOURCES).
- City page default title is now "Top {Stream} Colleges in {City} {year} | Digital Shiksha"; city page focus keyword defaults to its label.

## v11: One-click focus keywords + weekly SEO email
- `backend/lib/seo_score.py` = Python mirror of lib/seo.ts defaultSeo/seoScore/FIX_EFFORT (KEEP IN SYNC; parity verified: 136 to-fix both sides before keyword fill).
- POST /api/admin/seo/keywords?dry_run=true|false: fills seo.keywords=[kw] only for colleges/courses/exams/articles with no keywords; kw = suggest_keyword() (college "{short} {city}", exam "{name} {year}", course name, article tag/title words) and must already appear in the effective title/description. Returns will_fill, newly_green, skipped, items. UI: SEO Fix List → "Fill focus keywords" (preview dialog → Apply).
- Weekly report: POST /api/admin/seo/report/send (manual, doesn't move baseline) and POST /api/cron/weekly-seo-report (crons.yml weekly-seo-report, Mon 09:00 Asia/Kolkata; updates baseline). Email to SEO_REPORT_EMAIL or LEAD_ALERT_EMAIL: per-type green/amber/red, pages turned green since last snapshot (settings key seo_snapshot {levels{"kind:slug": level}, at}), top 10 quickest fixes. Cron auth shared in lib/cron.py accept_cron().

## v12: Database export
- GET /api/admin/export (admin cookie required, 401 otherwise) → attachment `digital-shiksha-db-YYYY-MM-DD-HHMM.json`: {exported_at, database, counts, collections{name: [docs]}} for every non-system collection, MongoDB Extended JSON (relaxed) via bson.json_util. Admin sidebar "Download database" link.

## v13: Office address removed
- Street address + Google map removed from footer, Consultation page, PDF report header, student confirmation email; SITE.address/mapHref deleted. JSON-LD keeps only Pune, Maharashtra, IN. Brand accent text = logo green (--color-brand-leaf #03541C, -soft #6FD08C on dark).

## v14: Official MHT CET 2026 CAP cut-offs in the Predictor
- Source: fe2026.mahacet.org CAP Round I–IV "MH Cut Off" PDFs (Maharashtra & minority seats). Parsed once by `backend/scripts/parse_cap_pdfs.py` (PyMuPDF, not a runtime dep) → `backend/data/cap_cutoffs_2026.json.gz` (2,332 college×branch rows, 387 colleges).
- `lib/cap.py` load_cap_data() runs at startup (lifespan task) and (re)loads collection `cap_cutoffs` when settings.cap_cutoffs_version differs → works on Atlas prod without manual import. Fields: course_code (unique), college_code, college_name, branch, branch_lc, status, home_university, city, region, college_slug (SLUG_BY_CODE map to site colleges), rounds{"1".."4": {seat_code: [merit_no, percentile]}} (closing = most lenient stage).
- Predictor (MHT CET only, when cap data present): PredictorIn adds ladies, home_university, branch_group (7 groups in cap.BRANCH_GROUPS). Categories now General, OBC, EWS, SC, ST, VJ, NT1, NT2, NT3, SEBC, TFWS (estimate factors added for other exams). Eligible seats = G(+L if ladies) × (OPEN + own category) × (S + H if college HU == student HU else O) + EWS/TFWS. Chance on Round I (or first available round) closing via chance_for margins (Medium −0.8, Reach −2.0). Results sorted most competitive first, capped at 300 (`total` = all matches). PredictorResult adds rounds[RoundCutoff], seat, official, course_code. GET /api/predictor/cap-meta (home universities, branch groups, counts). City filter = exact city (city_of with locality aliases; fallback = last comma part / CAP region).
- PDF report labels "Round I cutoff (official 2026)" + source note. Defence/PWD/orphan/minority-specific seat types are not used.

## v15: Pharmacy CAP cut-offs + predictor text
- Added official B.Pharmacy & Pharm.D CAP Round I–IV (Maharashtra seats) from ph2026.mahacet.org → `backend/data/cap_pharmacy_2026.json.gz` (559 rows, 528 colleges). `parse_cap_pdfs.py --program pharmacy`.
- `cap_cutoffs.program` = engineering | pharmacy; lib/cap.py DATA_FILES loads each file with its own version key `cap_cutoffs_version:{program}`; canonical_hu() repairs wrapped university names; "Status:" prefix stripped.
- New predictor exam "MHT CET Pharmacy" (cap.EXAM_PROGRAM); branch groups for pharmacy = B.Pharmacy / Pharm.D. GET /api/predictor/cap-meta?program=engineering|pharmacy (400 otherwise).
- MAH MBA CET Maharashtra-seat cut-offs NOT added: the MBA portal (mba2026.mahacet.org.in) serves them only via a logged-in app; only an All-India Round I PDF was found. MBA predictions remain estimates.
- Predictor page heading no longer shows "2026" ("College Predictor"); badge/disclaimer/hint/PDF/SEO title no longer mention 2026.

## v16: Predictor lead gate
- First prediction on a device opens PredictorGate (components/PredictorGate.tsx): Full Name, Mobile, City, Are You (Student/Parent), Which college → POST /api/enquiries (source 'predictor-gate', prediction context, role). localStorage ds_predictor_details_v1=1 unlocks; results query disabled until then (shared links too). LeadIn.role Optional[Literal['Student','Parent']]; shown as badge in admin Leads + in lead alert email.

## Paid MHT CET (engineering) predictor — Razorpay
- Only exam "MHT CET" (engineering) is paid: ₹1500 via the static Razorpay Payment Page https://rzp.io/rzp/6wXdLUk (constants in backend/lib/razorpay.py; exposed as `fee`/`payment_link` on GET /api/predictor/exams). Pharmacy, MBA, JEE, NEET stay free.
- Flow: Predict → lead popup (once per device) → payment dialog (Pay link + "I've paid" with mobile and optional pay_ ID) → POST /api/predictor/unlock verifies with Razorpay REST (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET): captured, 150000 paise INR, payment ID never used before (unique index on predictor_unlocks.payment_id). Without an ID it finds the latest unused ₹1500 captured payment from that mobile in the last 24 h.
- Unlock returns a token bound to exam + score (localStorage `ds_predictor_unlocks_v1`). POST /api/predictor and GET /api/predictor/pdf return 402 for MHT CET without a matching token. Changing the percentile needs a new payment; category/branch/city/HU/ladies filters are free.
- On unlock the student's top colleges go to their WhatsApp (send_student_prediction; needs approved TWILIO_STUDENT_TEMPLATE_SID). Collection predictor_unlocks {payment_id, token, exam, score, phone, name, amount, payer_contact, payer_email, prediction, created_at}.
- Without Razorpay API keys (current state): the payment step requires the pay_… ID from the receipt; each ID unlocks once (409 on reuse) and is saved with verified=false. Admin → Predictor shows "MHT CET payments" (GET /api/admin/predictor-payments) with a "Check in Razorpay" badge + dashboard link. Once RAZORPAY_KEY_ID/SECRET are set, payment_auto_check=true and IDs/mobile are checked with Razorpay automatically.
- If the Razorpay page redirects back to /predictor?razorpay_payment_id=…, the pending prediction (localStorage ds_predictor_pending_v1) is restored and the ID prefilled.
- Receipt email: payment dialog requires an email (UnlockIn.email; falls back to Razorpay payer email). After unlock, a fixed-template receipt (amount, payment ID, date, top 10 colleges) is emailed via managed Resend with an https download link GET /api/predictor/receipt/{receipt_id}.pdf (random receipt_id; PDF = full college list + green PAYMENT RECEIPT box). Resend proxy has no attachments, so the PDF is a link. Max 5 unlocks per email per 24 h (429). Admin payments table shows email + "Receipt sent".

- Owner payment alert: each unlock emails LEAD_ALERT_EMAIL (name, mobile, exam, percentile, amount, payment ID + Razorpay link, verified status, "Download prediction PDF" link to the receipt PDF — no attachments in the email service).
- Owner WhatsApp payment alert: notify_payment_whatsapp sends to WHATSAPP_ALERT_TO using the approved lead-alert template ({{1}} name, {{2}} mobile, {{3}} "PAID Rs.X - exam percentile", {{4}} Parent/Student, payment ID, top 5 colleges, PDF link); status saved as settings.whatsapp_payment. Unlock docs now store role (Parent/Student) from the latest gate lead for that mobile; email alert shows it too.
- Drop-down labels: "MHT CET (Engineering)" / "MHT CET (Pharmacy)" (display only; exam keys unchanged).
- MHT CET Pharmacy is also paid: ₹599 via https://rzp.io/rzp/6vvZNmq (razorpay.PAID_EXAMS maps exam -> (fee paise, link)). Same flow; unlock tokens are per exam + score, so an engineering payment never unlocks pharmacy. MBA, JEE, NEET stay free.
- Unlock storage (code-review fix): unlock tokens are NOT exposed to JS. POST /api/predictor/unlock sets httpOnly Secure SameSite=Lax cookie `ds_unlocks` (path /api/predictor, "."-joined tokens, last 20, 1 year); UnlockOut = {payment_id, exam, score}. GET /api/predictor/access?exam&score -> {paid} drives the paywall; /predictor and /predictor/pdf read the cookie (no token param/body field). Frontend storage helpers in src/lib/predictor-storage.ts: gate flag in localStorage, contact {name, phone} in sessionStorage only.

## Admin forgot-password (email reset)
- Login page "Forgot username or password? Email me a reset link" -> POST /api/auth/forgot (no body) emails the fixed owner inbox LEAD_ALERT_EMAIL only: admin username + https link /admin/reset?token=… (30 min, single-use, only sha256 stored in db.admin_auth; 2-min cooldown -> 429). Response {sent_to: masked email}.
- /admin/reset page -> POST /api/auth/reset {token, password 10-128} stores a PBKDF2 hash in db.admin_auth (key "admin"), bumps pv (all old sessions 401; JWT carries pv), clears the ds_admin cookie.
- Login checks the DB hash when present AND its env_fp matches the current ADMIN_PASSWORD; if the owner later changes ADMIN_PASSWORD in .env, the env value wins again. Deleting the admin_auth doc restores the .env password.
- Razorpay keys set (24 Oct 2026): preview/test slot = rzp_test_ keys (cannot see the live rzp.io payment pages' payments), live slot = owner's live keys (used after deploy). payment_auto_check=true -> payment ID optional, IDs/mobile verified via Razorpay API; fake IDs -> 404.
- Step 2 (26 Oct): no payment-ID or email fields. Student confirms with the mobile they paid with (prefilled from the pop-up); backend finds the newest unused captured payment of the exam fee from that mobile in 24 h via Razorpay API (razorpay_payment_id from a redirect URL is used silently if present). UnlockOut now also returns amount, masked payer email/phone from Razorpay, and pdf_url (/api/predictor/receipt/{receipt_id}.pdf). The dialog shows a "Payment confirmed" panel with those details, auto-downloads the PDF, and the receipt email goes to the Razorpay payer email.
- Admin: MHT CET payments table has a PDF column -> GET /api/admin/predictor-payments/{payment_id}/pdf (admin cookie) = receipt + full college list.
- JEE Main is also paid: ₹2499 via https://rzp.io/rzp/UIqrKC9h (PAID_EXAMS). NEET UG, MAH MBA CET, JEE Advanced stay free. Admin table heading is now "Predictor payments".
- MAH MBA CET is also paid: ₹1199 via https://rzp.io/rzp/aG2c274. Only NEET UG and JEE Advanced stay free.
- JEE Advanced is also paid: ₹2999 via https://rzp.io/rzp/Yf8GaPJK. Only NEET UG stays free. Data is thin: JEE Advanced has cut-offs for only 3 colleges, MAH MBA CET 4, JEE Main ~8 options.
- NEET UG is also paid: ₹3499 via https://rzp.io/rzp/C5otnMZx — now ALL predictors are paid. Wording follows exam metric (percentile / score / rank) in dialog, emails, WhatsApp (lib.email.score_text). NEET UG has cut-offs for 12 colleges (~10 options at 650, 0 at 450).
- Fee source of truth = the live Razorpay Payment Page: lib.razorpay.exam_fee(exam) reads "amount" from the rzp.io page (10-min cache, falls back to PAID_EXAMS constants). Used by /predictor/exams (displayed fee) and /predictor/unlock (matching). Fixes live 404 where the MHT CET page charged ₹1499 vs coded ₹1500.
- Admin: PredictionLog stores full params; Recent predictions (last 200) each have a PDF button -> GET /api/admin/predictions/{id}/pdf; "Download all paid PDFs (ZIP)" -> GET /api/admin/predictor-payments/pdfs.zip (latest 200 receipts).
- SEO files: /robots.txt (Allow /, Allow /api/sitemap.xml; Disallow /admin, /api/, payment-return, /compare?, /predictor?, /colleges?, ?q=; single Sitemap line) and /sitemap.xml (static pages + colleges/courses/exams/news + landing pages, with priority, changefreq, lastmod where dated, 1h cache). Served via the frontend proxy rewrite to /api/*.
- Main domain = https://www.digitalshiksha.in (CANONICAL_SITE in backend/routers/seo.py, env CANONICAL_SITE_URL overrides; CANONICAL_ORIGIN in frontend/src/lib/seo.ts). On any non-preview host, sitemap/robots and canonical/OG/schema URLs use it; preview (*.emergentagent.com, localhost) keeps its own host.
- Production serves the static build, so root /robots.txt and /sitemap.xml are static files in frontend/public: robots.txt (rules + Sitemap lines) and sitemap.xml = sitemap index pointing to the live https://www.digitalshiksha.in/api/sitemap.xml. In dev the Vite proxy still serves the dynamic versions.

- Header: College Predictor is a highlighted green pill (sparkle icon, light-sweep + soft halo animation, yellow "Try now" badge). Desktop: right side before search/Enquire (compact "Predictor · Try" at 1024-1279px). Mobile/tablet (<1024px): centred in the header right after the logo (testid mobile-header-predictor), also at the top of the mobile menu.
- Home: PredictorBanner at the very top ("Find your college in 30 seconds"): exam chips from /api/predictor/exams + score input -> /predictor?exam=&score=&category=General&city=both (auto-runs; range-validated).
- College pages: PredictorNudge card after 20 s ("Can you get into <college>?" -> /predictor), once per browser session (sessionStorage ds_predictor_nudge_v1); bottom-left on desktop, above the bottom bar on phones.
- Phones (<768px): MobileBottomBar sticky (Predictor | Call | WhatsApp); floating call/WhatsApp buttons are desktop-only; compare bar sits above the bottom bar; page has pb-16 on mobile.
- Exit intent (desktop ≥1024px + mouse only, not /admin): mouse leaving through the top after 5 s on a page opens a "Wait — which colleges can you get?" dialog -> /predictor. Once per session (sessionStorage ds_exit_intent_v1) and never if the visitor opened /predictor this session (ds_predictor_tried_v1).
- Exam pages: ExamPredictorBox "Check colleges for your score" under the key facts. Exams whose name matches a predictor (MHT CET, JEE Main, JEE Advanced, NEET UG, MAH MBA CET) get a score box -> /predictor?exam=&score= (range-validated); other exams get an "Open College Predictor" link.

## Course page predictor box
- CourseDetail shows ExamPredictorBox (testid prefix `course-predictor`) for btech (MHT CET / JEE Main / JEE Advanced picker), mba (MAH MBA CET), mbbs (NEET UG), bpharm (MHT CET Pharmacy). Score -> /predictor?exam=..&score=..; other courses show no box.

## 2027 season rollover
- Site copy says 2027 (frontend strings; SEO/landing year = max(ADMISSION_YEAR=2027, current year) in backend lib/year_rollover.py).
- Startup migration lib/year_rollover.py (settings flags year_rollover_2027 / _text): exam dates/deadlines/overview shifted +1 year once; articles/SEO text 2026->2027 incl. slugs; GET /api/articles/{old-2026-slug} still resolves. Article publish dates untouched. Footer copyright has no year.

## 2027 guides + deadline countdown
- lib/articles_2027.py inserts 3 Admission articles at startup if slug missing: jee-main-2027-admission-guide, mht-cet-2027-admission-guide, neet-ug-2027-admission-guide (published_at = insert day).
- Exam API adds computed days_left (end of last month in application_deadline, IST today; null for Rolling). DeadlineBadge shows "X days left to apply" on /exams cards, home upcoming list and exam detail (red <=30, amber <=90, "Applications closed" if past).

## Exams keep 2026 (user request)
- Exam data/titles/SEO stay on 2026 (EXAM_YEAR=2026 in backend lib/year_rollover.py and frontend lib/site.ts). restore_exam_years() undid the earlier +1 exam shift once (flag exam_years_2026_restored). Rest of site stays 2027. Countdown badges reflect 2026 deadlines (many show "Applications closed").

## Redirects (old website pages)
- Collection `redirects` {id, from_path (normalised lower-case, no trailing slash, unique), to_path (/path or https://), include_subpages, created_at}. Admin tab "Redirects" (CRUD via /api/admin/redirects, admin cookie). Public GET /api/redirects read by useOldPageRedirect() in Layout: exact match, else longest include_subpages prefix; navigates with replace. Unknown top-level addresses wait for the list before rendering (no flash).
- Seeded once at startup (flag redirects_seeded): /blog (+sub-pages) -> /news. Redirect is client-side (SPA), Google follows JS redirects.

## Rich text editor (admin)
- components/admin/RichTextEditor.tsx (TipTap v3): paragraph/H1-H6, font size, bold/italic/strike, text + background colour, align L/C/R/Justify, bullet/numbered/check lists + nest/un-nest, links (internal /path, external https with new-tab option, mailto, tel, #anchor) with edit/remove, anchors (id on paragraph/heading), tables (insert, add/delete rows & columns, header toggle, delete), image by URL + alt, YouTube embed (nocookie). Undo/redo via Ctrl+Z/Y only (user did not want buttons).
- Used for: college overview + admission, course overview, exam overview, article content, city page intro (resources.ts type "richtext"; LandingManager). Stores HTML; legacy plain text auto-converted on edit.
- Public render: components/RichText.tsx -> DOMPurify sanitize (lib/richtext.ts; iframes only youtube embed), .rich-content CSS in index.css; internal links navigate in-app. SEO scoring/descriptions strip HTML (frontend toPlain, backend seo_score._plain).

## Draft autosave (admin)
- lib/drafts.ts + ContentManager (colleges/courses/exams/articles dialogs): edits autosave to this browser localStorage (key ds-admin-draft:{resource}:{id|new}) ~1s after typing; saved also on tab close (beforeunload prompt) and on Cancel/Escape (toast). Reopening shows amber banner Restore/Discard; rows with drafts show a "Draft" chip; "Add new (draft)" for unsaved new records. Draft cleared on successful Save, Discard or record delete. City page intro editor not covered.

## Same-tab payment + auto confirm
- Pay button opens the Razorpay payment page in the SAME tab; before leaving, sessionStorage ds_predictor_pending_v2 stores the exam/score query (no personal data).
- Return: Razorpay dashboard redirect -> /predictor?paid=1 (optionally with razorpay_payment_id) restores the prediction and polls POST /api/predictor/unlock (10 tries x 4s) using the gate mobile; Back button without redirect -> one quiet check. Success shows the "Payment confirmed" screen + PDF download automatically; otherwise manual "I've paid" form remains.
- Each of the 6 Razorpay Payment Pages must have Page Settings -> Action after successful payment -> Redirect to https://www.digitalshiksha.in/predictor?paid=1

## Predictor log for every submitted score
- POST /api/predictor/log {prediction, name, phone} (PredictionLogIn) is sent by the predictor page once per submitted prediction after the details pop-up — including paid exams before payment. POST /api/predictor no longer logs. Log rows carry name, phone, paid_exam, paid, payment_id; unlock marks matching rows paid. Admin Predictor Report "Recent predictions" (full width) shows Student + Paid/Not paid and a PDF for every row.

## Payment flow reverted to new tab (user request)
- Pay button opens the Razorpay page in a NEW tab again; student returns and taps "I've paid" (step 2 "After paying, confirm here"). The Razorpay dashboard redirect link (/predictor?paid=1) is no longer needed; the page still handles it harmlessly if it is set.

## Razorpay connection check (admin)
- GET /api/admin/razorpay-status (admin) -> RazorpayStatus: key mode live/test (prefix only), API ok, which of the 6 predictor payment pages this account owns (GET /v1/payment_pages), payments in last 48h, captured at predictor prices, with contact, last payment time. Shown as a card at the top of Admin -> Predictor Report with "Check again". No key values or payer details returned.

## MH + KA B.Tech import (Collegedunia)
- scripts/build_college_import.py turns data/cd_mh.txt + cd_ka.txt (name|city|logo|total fees|rating, from collegedunia.com B.Tech listings) into data/colleges_mh_ka.json (196 colleges) and downloads logos to frontend/public/logos/{slug}.ext.
- lib/college_import.py runs once at startup (settings flag colleges_cd_import_v1): inserts new colleges (fees_min=fees_max=total/4 per year, course row with total fee, rating, type, exams MHT CET/JEE Main or KCET/COMEDK/JEE Main) and for 14 existing matches sets only logo + fees.
- College.logo field: cards show the logo tile instead of the photo; college header shows a logo badge and hides the photo background.

## v17: Placements + cut-offs, Karnataka city pages, KCET predictor
- Startup chain (server.py lifespan, in order): run_college_import → CAP load → lib/kcet.load_kcet_data → lib/college_enrich.run_college_enrich (flag colleges_placements_v1) → lib/karnataka_pages.setup_karnataka_pages (flag karnataka_city_pages_v1). All one-time / version-keyed; only empty fields filled, admin edits never overwritten.
- Placements/cut-offs for top 15 new MH + top 15 new KA colleges (Collegedunia order): avg/highest package + placement rate are APPROXIMATE recent figures (PLACEMENTS in college_enrich.py). Cut-offs: MH = official CAP 2026 R1 Open closing percentile (CAP_CODE map), KA = official KCET 2025 R1 GM closing rank, IIT/NIT/IIIT = approximate JoSAA ranks (value null except IIT Dharwad JEE Advanced). cap.SLUG_BY_CODE extended with 12 MH codes; slugs synced on every startup.
- KCET data: data/kcet_cutoffs_2025.json.gz (1,578 college×branch rows, 224 colleges, 24 KEA categories) built by scripts/build_kcet_data.py from the optionentry.com transcription of the KEA UGCET 2025 First Round final allotment PDF (KEA portal unreachable from pod). Collection kcet_cutoffs {college_code, college_name, display_name, branch, branch_lc, ranks{GM,GMK,GMR,1G..STR}, college_slug (kcet.SLUG_BY_CODE), city, type, course_code}. Reload when version or kcet.LOADER_REV changes.
- KCET predictor (PAID ₹1999 via https://rzp.io/rzp/f201wv0, razorpay.PAID_EXAMS; same unlock flow as other exams): exam "KCET" metric rank 1–300000. PredictorIn adds kannada, rural; Category adds "1","2A","2B","3A","3B" (KCET only; others → 422). Eligible seats = GM (+GMK/GMR) + own category G (+K/R); best closing rank decides chance via chance_for("rank"). Results sorted lowest rank first, capped 300; seat chip shown. GET /predictor/cap-meta?program=kcet → branch groups (engineering), categories, cities. Frontend: KCET-specific categories, Karnataka locations (city key "karnataka" = all), Kannada/Rural checkboxes, URL params kannada=1 / rural=1; PDF supports kannada/rural.
- Karnataka city pages: /engineering-colleges-in-bengaluru | -mysuru | -mangaluru get hand-written intro, FAQs and SEO (landing_pages overrides, editable in Admin → City Pages). LandingPage adds cutoff_table (best GM KCET closing rank per college in the city, CSE preferred, top 30), cutoff_source, predictor_exam ("KCET") → KCET predictor box + table on any Karnataka engineering page. NIT Surathkal city set to Mangaluru. Footer Popular Searches links the 3 pages + KCET predictor; B.Tech course page predictor box includes KCET.
