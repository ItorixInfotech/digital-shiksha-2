// Hand-written mirrors of backend/models/content.py — keep in sync.

export interface CollegeCourse {
  name: string;
  duration: string;
  fees: string;
  eligibility: string;
  seats: number | null;
}

export interface CutoffRow {
  exam: string;
  branch: string;
  cutoff: string;
  value: number | null;
  category: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface LandingOverrideIn {
  intro: string;
  faqs: FaqItem[];
  seo: SeoMeta;
}

export interface LandingSummary {
  slug: string;
  stream: string;
  city: string;
  label: string;
  count: number;
  customised: boolean;
  default_title: string;
  default_description: string;
  override: LandingOverrideIn | null;
}

export interface LandingStats {
  count: number;
  fees_min: number;
  fees_max: number;
  avg_fees: number;
  avg_package: number;
  top_package: number;
  exams: string[];
}

export interface LandingLink {
  slug: string;
  label: string;
  count: number;
}

export interface LandingCutoff {
  college: string;
  slug: string;
  branch: string;
  closing_rank: number;
}

export interface LandingPage extends LandingSummary {
  year: number;
  h1: string;
  intro: string;
  faqs: FaqItem[];
  seo: SeoMeta;
  stats: LandingStats;
  colleges: College[];
  same_city: LandingLink[];
  same_stream: LandingLink[];
  cutoff_table: LandingCutoff[]; // Karnataka engineering pages: official KCET closing ranks
  cutoff_source: string;
  predictor_exam: string;
}

export interface SeoMeta {
  meta_title: string;
  meta_description: string;
  keywords: string[];
  canonical_url: string;
  og_image: string;
  noindex: boolean;
}

export interface PageSeoIn {
  key: string;
  meta_title: string;
  meta_description: string;
  og_image: string;
  noindex: boolean;
}

export interface PageSeo extends PageSeoIn {
  label: string;
  path: string;
  default_title: string;
  default_description: string;
}

export interface SeoPages {
  year: number;
  pages: PageSeo[];
}

export interface SeoPagesIn {
  pages: PageSeoIn[];
}

export interface CollegeIn {
  slug: string;
  name: string;
  short_name: string;
  city: string;
  state: string;
  type: string;
  established: number | null;
  streams: string[];
  nirf_rank: number | null;
  rating: number;
  fees_min: number;
  fees_max: number;
  avg_package: number;
  highest_package: number;
  placement_rate: number;
  approvals: string[];
  exams_accepted: string[];
  image: string;
  logo: string;
  overview: string;
  admission: string;
  courses: CollegeCourse[];
  cutoffs: CutoffRow[];
  top_recruiters: string[];
  facilities: string[];
  featured: boolean;
  faqs: FaqItem[];
  seo: SeoMeta;
}
export interface College extends CollegeIn {
  id: string;
}

export interface CourseIn {
  slug: string;
  name: string;
  full_name: string;
  stream: string;
  level: string;
  duration: string;
  avg_fees: string;
  avg_salary: string;
  eligibility: string;
  overview: string;
  entrance_exams: string[];
  specializations: string[];
  careers: string[];
  popular: boolean;
  seo: SeoMeta;
}
export interface Course extends CourseIn {
  id: string;
}

export interface ExamIn {
  slug: string;
  name: string;
  full_name: string;
  stream: string;
  level: string;
  conducting_body: string;
  exam_date: string;
  application_deadline: string;
  mode: string;
  eligibility: string;
  overview: string;
  syllabus: string[];
  website: string;
  faqs: FaqItem[];
  seo: SeoMeta;
}
export interface Exam extends ExamIn {
  id: string;
  /** Server-computed days to the end of the application_deadline month; null = rolling / no fixed deadline. */
  days_left: number | null;
}

export interface ArticleIn {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  author: string;
  image: string;
  published_at: string;
  tags: string[];
  seo: SeoMeta;
}
export interface Article extends ArticleIn {
  id: string;
}

export type LeadStatus = "New" | "Contacted" | "In-Progress" | "Converted";

export interface PredictionContext {
  exam: string;
  score: number;
  category: string;
  cities: string[];
}

export interface LeadIn {
  name: string;
  phone: string;
  email: string | null;
  city: string;
  course_interest: string;
  college: string;
  budget: string;
  message: string;
  source: string;
  prediction: PredictionContext | null;
  whatsapp_opt_in: boolean;
  role?: LeadRole | null; // server default null
}
export type LeadRole = "Student" | "Parent";
export interface Lead extends LeadIn {
  id: string;
  status: LeadStatus;
  counsellor_id: string | null;
  created_at: string;
}

export interface CounsellorIn {
  name: string;
  phone: string;
  email: string | null;
  active: boolean;
}

export interface Counsellor extends CounsellorIn {
  id: string;
  created_at: string;
}

export interface CounsellorWithStats extends Counsellor {
  total_leads: number;
  new_leads: number;
}

export interface CounsellorSettings {
  auto_assign: boolean;
  reminder_template_sid: string;
  last_reminder: string;
  fallback_numbers: string[];
}

export interface CounsellorSettingsIn {
  auto_assign: boolean;
  reminder_template_sid: string;
}

export interface LeadAssignIn {
  counsellor_id: string | null;
  notify: boolean;
}

export interface ReminderRecipient {
  name: string;
  to: string;
  leads: number;
}

export interface ReminderRun {
  queued: boolean;
  total_leads: number;
  recipients: ReminderRecipient[];
}

export interface SearchHit {
  kind: "college" | "course" | "exam";
  slug: string;
  title: string;
  subtitle: string;
}

export interface FacetCount {
  name: string;
  count: number;
}

export interface Meta {
  streams: FacetCount[];
  cities: FacetCount[];
  states: FacetCount[];
  types: FacetCount[];
  totals: Record<string, number>;
}

// Mirrors backend/models/content.py ForgotOut / ResetIn
export interface ForgotOut {
  sent_to: string; // masked owner inbox
}
export interface ResetIn {
  token: string;
  password: string; // 10–128 chars
}

export interface AdminMe {
  username: string;
}

export interface AdminStats {
  leads: number;
  new_leads: number;
  colleges: number;
  courses: number;
  exams: number;
  articles: number;
  whatsapp_alerts: boolean;
  whatsapp: WhatsAppStatus | null;
}

export interface WhatsAppStatus {
  configured: boolean;
  lead_template: boolean;
  student_template: boolean;
  last_lead: string;
  last_student: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface CutoffImportResult {
  dry_run: boolean;
  rows_read: number;
  added: number;
  updated: number;
  skipped: number;
  colleges_affected: number;
  issues: ImportIssue[];
}

// Mirrors backend/models/predictor.py
export type PredictorMetric = "percentile" | "score" | "rank";
export type PredictorChance = "High" | "Medium" | "Reach";
export type PredictorCategory = "General" | "OBC" | "EWS" | "SC" | "ST" | "VJ" | "NT1" | "NT2" | "NT3" | "SEBC" | "TFWS" | "1" | "2A" | "2B" | "3A" | "3B"; // 1–3B: KCET only

export interface PredictorExam {
  name: string;
  metric: PredictorMetric;
  min: number;
  max: number;
  label: string;
  hint: string;
  rank_note: string;
  fee: number; // ₹; >0 = results unlock only after a verified Razorpay payment
  payment_link: string;
  payment_auto_check: boolean; // true once Razorpay API keys are set
}

export interface PredictorIn {
  exam: string;
  score: number;
  category: PredictorCategory;
  cities: string[];
  // MHT CET (official CAP data) only — server defaults: false / "" / ""
  ladies?: boolean;
  home_university?: string;
  branch_group?: string;
  kannada?: boolean; // KCET only
  rural?: boolean; // KCET only
}

export interface UnlockIn {
  prediction: PredictorIn;
  name: string;
  phone: string;
  email?: string; // optional: receipt goes to the Razorpay payer email
  payment_id: string; // "" = find the payment by mobile number
}

export interface PredictorAccess {
  paid: boolean; // this browser has unlocked this exam + score
}

export interface PaymentRecord {
  payment_id: string;
  exam: string;
  score: number;
  name: string;
  phone: string;
  amount: number;
  email: string;
  email_sent: boolean;
  verified: boolean; // false = not yet checked with Razorpay — cross-check in the dashboard
  created_at: string;
}

// The unlock token itself is only in the httpOnly ds_unlocks cookie.
export interface UnlockOut {
  payment_id: string;
  exam: string;
  score: number;
  amount: number;
  email: string; // payer email from Razorpay (masked) — the PDF is emailed here
  phone: string; // payer mobile from Razorpay (masked)
  pdf_url: string; // receipt + full college list PDF
}

export interface RoundCutoff {
  round: number;
  percentile: number | null;
  merit_no: number | null;
  seat: string;
}

export interface CapMeta {
  available: boolean;
  year: number;
  source: string;
  colleges: number;
  courses: number;
  home_universities: string[];
  branch_groups: string[];
  categories: string[];
  cities: string[]; // KCET: cities with colleges
}

export interface PredictorResult {
  college_slug: string;
  college_name: string;
  short_name: string;
  city: string;
  type: string;
  image: string;
  course: string;
  cutoff: string;
  cutoff_value: number;
  general_cutoff: string;
  estimated: boolean;
  chance: PredictorChance;
  fees_min: number;
  fees_max: number;
  avg_package: number;
  rounds: RoundCutoff[];
  seat: string;
  official: boolean;
  course_code: string;
}

export interface PredictorOut {
  exam: string;
  metric: PredictorMetric;
  score: number;
  category: PredictorCategory;
  results: PredictorResult[];
  total: number;
  source: string;
}

export interface PredictionLog {
  id: string;
  exam: string;
  metric: PredictorMetric;
  score: number;
  category: PredictorCategory;
  cities: string[];
  results: number;
  high: number;
  params: Record<string, unknown>; // full PredictorIn used to re-create the PDF
  name: string;
  phone: string;
  paid_exam: boolean;
  paid: boolean;
  payment_id: string;
  created_at: string;
}

/** Mirrors backend RazorpayStatus (admin connection check; counts only). */
export interface RazorpayStatus {
  configured: boolean;
  mode: string;
  api_ok: boolean;
  error: string;
  pages_found: string[];
  pages_missing: string[];
  payments_48h: number;
  fee_payments_48h: number;
  with_contact_48h: number;
  last_payment_at: number | null;
}

/** Mirrors backend PredictionLogIn — sent when a score is submitted (before any payment). */
export interface PredictionLogIn {
  prediction: PredictorIn;
  name: string;
  phone: string;
}

export interface PredictorBucket {
  label: string;
  count: number;
}

export interface ExamReport {
  exam: string;
  metric: PredictorMetric;
  searches: number;
  avg_score: number;
  buckets: PredictorBucket[];
  categories: Record<string, number>;
}

export interface PredictorReport {
  total_searches: number;
  last_7_days: number;
  predictor_leads: number;
  exams: ExamReport[];
  recent: PredictionLog[];
}

// Mirrors backend/routers/whatsapp_admin.py
export interface WaTemplateInfo {
  sid: string;
  status: string;
  name: string;
  body: string;
  variables: number;
  rejection_reason: string;
  note: string;
  checked_at: string | null;
  in_use: boolean;
}

export interface WhatsAppPanel {
  configured: boolean;
  sender: string;
  alert_to: string[];
  lead: WaTemplateInfo | null;
  student: WaTemplateInfo | null;
  sample_available: boolean;
  last_lead: string;
  last_student: string;
}

export interface WaTemplateSidsIn {
  lead_sid: string;
  student_sid: string;
}

export type WaTestKind = "sample" | "lead" | "student";

export interface WaTestOut {
  ok: boolean;
  message_sid: string;
  detail: string;
  used_template: string;
  to: string;
}

export interface WaMessageStatus {
  status: string;
  error: string;
}

export interface KeywordFillItem {
  kind: string;
  slug: string;
  name: string;
  keyword: string;
}

export interface KeywordFillResult {
  dry_run: boolean;
  without_keyword: number;
  will_fill: number;
  skipped: number;
  newly_green: number;
  items: KeywordFillItem[];
}

export interface SeoReportItem {
  kind: string;
  slug: string;
  name: string;
  score: number;
  level: string;
  fixes: string[];
  url: string;
}

export interface SeoReportKind {
  kind: string;
  label: string;
  green: number;
  amber: number;
  red: number;
}

export interface SeoReportSummary {
  baseline: boolean;
  since: string;
  total: number;
  needs_fix: number;
  kinds: SeoReportKind[];
  turned_green: SeoReportItem[];
  top_fixes: SeoReportItem[];
}


/** Mirrors backend models/redirect.py */
export interface RedirectIn {
  from_path: string;
  to_path: string;
  include_subpages: boolean;
}
export interface Redirect extends RedirectIn {
  id: string;
  created_at: string;
}
