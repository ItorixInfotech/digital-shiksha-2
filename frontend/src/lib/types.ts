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
  overview: string;
  admission: string;
  courses: CollegeCourse[];
  cutoffs: CutoffRow[];
  top_recruiters: string[];
  facilities: string[];
  featured: boolean;
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
}
export interface Exam extends ExamIn {
  id: string;
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
}
export interface Lead extends LeadIn {
  id: string;
  status: LeadStatus;
  created_at: string;
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
export type PredictorCategory = "General" | "OBC" | "EWS" | "SC" | "ST";

export interface PredictorExam {
  name: string;
  metric: PredictorMetric;
  min: number;
  max: number;
  label: string;
  hint: string;
  rank_note: string;
}

export interface PredictorIn {
  exam: string;
  score: number;
  category: PredictorCategory;
  cities: string[];
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
}

export interface PredictorOut {
  exam: string;
  metric: PredictorMetric;
  score: number;
  category: PredictorCategory;
  results: PredictorResult[];
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
  created_at: string;
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
