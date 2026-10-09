import type { FieldSpec } from "@/components/admin/ContentManager";
import type { SeoKind } from "@/lib/seo";

const COLLEGE_FIELDS: FieldSpec[] = [
  { key: "name", label: "College name", type: "text", required: true, full: true },
  { key: "slug", label: "URL slug", type: "text", required: true },
  { key: "short_name", label: "Short name", type: "text" },
  { key: "city", label: "City", type: "text", required: true },
  { key: "state", label: "State", type: "text", required: true },
  { key: "type", label: "Ownership", type: "text", hint: "Government / Private / Deemed" },
  { key: "established", label: "Established (year)", type: "number" },
  { key: "nirf_rank", label: "NIRF rank", type: "number" },
  { key: "rating", label: "Rating (0-5)", type: "number" },
  { key: "fees_min", label: "Min fees (₹ / yr)", type: "number" },
  { key: "fees_max", label: "Max fees (₹ / yr)", type: "number" },
  { key: "avg_package", label: "Avg package (LPA)", type: "number" },
  { key: "highest_package", label: "Highest package (LPA)", type: "number" },
  { key: "placement_rate", label: "Placement rate (%)", type: "number" },
  { key: "streams", label: "Streams", type: "list" },
  { key: "exams_accepted", label: "Exams accepted", type: "list" },
  { key: "approvals", label: "Approvals", type: "list" },
  { key: "top_recruiters", label: "Top recruiters", type: "list" },
  { key: "facilities", label: "Facilities", type: "list" },
  { key: "image", label: "Cover image URL", type: "text", full: true },
  { key: "overview", label: "Overview", type: "textarea" },
  { key: "admission", label: "Admission process", type: "textarea" },
  { key: "courses", label: "Courses & fees (JSON)", type: "json", hint: 'e.g. [{"name":"B.Tech","duration":"4 Years","fees":"₹1 L/yr","eligibility":"10+2 PCM","seats":60}]' },
  { key: "cutoffs", label: "Cutoffs (JSON)", type: "json", hint: 'e.g. [{"exam":"MHT CET","branch":"Computer","cutoff":"99.50 percentile","value":99.5,"category":"General"}] — "value" (percentile, NEET score or JEE Adv rank) powers the College Predictor' },
  { key: "featured", label: "Featured on home page", type: "bool" },
];
const COURSE_FIELDS: FieldSpec[] = [
  { key: "name", label: "Course name", type: "text", required: true },
  { key: "slug", label: "URL slug", type: "text", required: true },
  { key: "full_name", label: "Full name", type: "text", full: true },
  { key: "stream", label: "Stream", type: "text", required: true },
  { key: "level", label: "Level", type: "text", hint: "UG / PG / Diploma / Doctorate / Certification" },
  { key: "duration", label: "Duration", type: "text" },
  { key: "avg_fees", label: "Average fees", type: "text" },
  { key: "avg_salary", label: "Average salary", type: "text" },
  { key: "eligibility", label: "Eligibility", type: "text", full: true },
  { key: "entrance_exams", label: "Entrance exams", type: "list" },
  { key: "specializations", label: "Specialisations", type: "list" },
  { key: "careers", label: "Careers", type: "list", full: true },
  { key: "overview", label: "Overview", type: "textarea" },
  { key: "popular", label: "Show in popular courses", type: "bool" },
];
const EXAM_FIELDS: FieldSpec[] = [
  { key: "name", label: "Exam name", type: "text", required: true },
  { key: "slug", label: "URL slug", type: "text", required: true },
  { key: "full_name", label: "Full name", type: "text", full: true },
  { key: "stream", label: "Stream", type: "text", required: true },
  { key: "level", label: "Level", type: "text", hint: "National / State / University" },
  { key: "conducting_body", label: "Conducting body", type: "text" },
  { key: "exam_date", label: "Exam date", type: "text" },
  { key: "application_deadline", label: "Application deadline", type: "text" },
  { key: "mode", label: "Mode", type: "text" },
  { key: "website", label: "Official website", type: "text" },
  { key: "eligibility", label: "Eligibility", type: "text", full: true },
  { key: "syllabus", label: "Syllabus sections", type: "list", full: true },
  { key: "overview", label: "Overview", type: "textarea" },
];
const ARTICLE_FIELDS: FieldSpec[] = [
  { key: "title", label: "Title", type: "text", required: true, full: true },
  { key: "slug", label: "URL slug", type: "text", required: true },
  { key: "category", label: "Category", type: "text", hint: "Admission / Exam / College / Career" },
  { key: "author", label: "Author", type: "text" },
  { key: "published_at", label: "Publish date", type: "text", hint: "YYYY-MM-DD" },
  { key: "image", label: "Image URL", type: "text", full: true },
  { key: "tags", label: "Tags", type: "list", full: true },
  { key: "excerpt", label: "Excerpt", type: "textarea" },
  { key: "content", label: "Content", type: "textarea", hint: "Separate paragraphs with a blank line" },
];

export interface ResourceConfig {
  resource: SeoKind;
  title: string;
  fields: FieldSpec[];
  publicPath: string;
  columns: { key: string; label: string }[];
  faqs: boolean;
}

export const RESOURCES: Record<SeoKind, ResourceConfig> = {
  colleges: { resource: "colleges", title: "Colleges", fields: COLLEGE_FIELDS, publicPath: "/colleges", columns: [{ key: "name", label: "Name" }, { key: "city", label: "City" }, { key: "type", label: "Type" }, { key: "nirf_rank", label: "NIRF" }], faqs: true },
  courses: { resource: "courses", title: "Courses", fields: COURSE_FIELDS, publicPath: "/courses", columns: [{ key: "name", label: "Name" }, { key: "stream", label: "Stream" }, { key: "level", label: "Level" }, { key: "duration", label: "Duration" }], faqs: false },
  exams: { resource: "exams", title: "Exams", fields: EXAM_FIELDS, publicPath: "/exams", columns: [{ key: "name", label: "Name" }, { key: "stream", label: "Stream" }, { key: "level", label: "Level" }, { key: "exam_date", label: "Date" }], faqs: true },
  articles: { resource: "articles", title: "Articles", fields: ARTICLE_FIELDS, publicPath: "/news", columns: [{ key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "published_at", label: "Published" }], faqs: false },
};
