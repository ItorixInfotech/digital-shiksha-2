import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, GraduationCap, Inbox, Loader2, LogOut, School, Newspaper, Trash2, Lock } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ContentManager from "@/components/admin/ContentManager";
import type { FieldSpec } from "@/components/admin/ContentManager";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { beginSession, endSession } from "@/lib/session";
import type { AdminMe, AdminStats, Lead, LeadStatus } from "@/lib/types";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const STATUSES: LeadStatus[] = ["New", "Contacted", "In-Progress", "Converted"];
const STATUS_CLS: Record<LeadStatus, string> = {
  New: "bg-red-50 text-red-700", Contacted: "bg-indigo-50 text-indigo-800", "In-Progress": "bg-amber-50 text-amber-800", Converted: "bg-green-50 text-green-800",
};

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
  { key: "cutoffs", label: "Cutoffs (JSON)", type: "json", hint: 'e.g. [{"exam":"MHT CET","branch":"Computer","cutoff":"99.50 percentile","value":99.5}] — "value" (percentile, NEET score or JEE Adv rank) powers the College Predictor' },
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

const TABS = [
  { key: "leads", label: "Leads", icon: Inbox },
  { key: "colleges", label: "Colleges", icon: School },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "exams", label: "Exams", icon: FileText },
  { key: "articles", label: "Articles", icon: Newspaper },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function AdminLogin() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const login = useMutation({
    mutationFn: () => apiPost<AdminMe>("/auth/login", { username: u.trim(), password: p }),
    onSuccess: () => { beginSession(); nav("/admin", { replace: true }); },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 401 ? "Invalid username or password" : "Login failed"),
  });
  return (
    <div className="grid min-h-screen place-items-center bg-brand-ink px-4" data-testid="admin-login-page">
      <Toaster richColors />
      <form onSubmit={(e) => { e.preventDefault(); login.mutate(); }} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl animate-fade-up">
        <img src={SITE.logo} alt="Digital Shiksha" className="h-14 w-auto" />
        <h1 className="mt-6 flex items-center gap-2 text-xl font-semibold"><Lock className="size-5 text-brand-red" /> Admin login</h1>
        <p className="mt-1 text-sm text-slate-500">Manage leads, colleges, courses, exams and articles.</p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="admin-u">Username</Label><Input id="admin-u" data-testid="admin-login-username-input" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></div>
          <div className="grid gap-1.5"><Label htmlFor="admin-p">Password</Label><Input id="admin-p" type="password" data-testid="admin-login-password-input" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></div>
          <Button type="submit" disabled={login.isPending || !u || !p} data-testid="admin-login-submit-button" className="h-10 bg-brand-red text-white hover:bg-red-700">
            {login.isPending && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>
        </div>
        <a href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-brand-red" data-testid="admin-login-back-link">← Back to website</a>
      </form>
    </div>
  );
}

function LeadsPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const leads = useQuery({ queryKey: ["admin", "leads"], queryFn: () => apiGet<Lead[]>("/admin/leads") });
  const inval = () => { qc.invalidateQueries({ queryKey: ["admin", "leads"] }); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); };
  const upd = useMutation({ mutationFn: ({ id, s }: { id: string; s: LeadStatus }) => apiPatch<Lead>(`/admin/leads/${id}`, { status: s }), onSuccess: () => { toast.success("Status updated"); inval(); }, onError: () => toast.error("Update failed") });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/leads/${id}`), onSuccess: () => { toast.success("Lead deleted"); inval(); } });

  const rows = (leads.data ?? []).filter((l) => (status === "all" || l.status === status) && (!q || `${l.name} ${l.phone} ${l.city} ${l.course_interest} ${l.college}`.toLowerCase().includes(q.toLowerCase())));

  const exportCsv = () => {
    const head = ["Date", "Name", "Phone", "Email", "City", "Course", "College", "Budget", "Message", "Source", "Status"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((l) => [new Date(l.created_at).toLocaleString("en-IN"), l.name, l.phone, l.email ?? "", l.city, l.course_interest, l.college, l.budget, l.message, l.source, l.status].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `digital-shiksha-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div data-testid="admin-leads-panel">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Enquiries / Leads <span className="text-sm font-normal text-slate-500">({rows.length})</span></h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, city…" className="h-9 w-56 bg-white" data-testid="admin-leads-search-input" />
          <Select value={status} onValueChange={(v: string) => setStatus(v)}>
            <SelectTrigger className="w-40 bg-white" data-testid="admin-leads-status-filter"><SelectValue>{(v) => (v === "all" ? "All statuses" : (v as string))}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length} data-testid="admin-leads-export-button"><Download className="size-4" /> Export CSV</Button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border bg-white">
        <Table data-testid="admin-leads-table">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Interest</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {leads.isLoading && <TableRow><TableCell colSpan={6} className="text-slate-500">Loading…</TableCell></TableRow>}
            {rows.map((l) => (
              <TableRow key={l.id} data-testid={`admin-lead-row-${l.id}`}>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900" data-testid={`admin-lead-name-${l.id}`}>{l.name}</p>
                  <a href={`tel:+91${l.phone}`} className="text-xs text-brand-blue hover:underline">+91 {l.phone}</a>
                  {l.email && <p className="text-xs text-slate-500">{l.email}</p>}
                  {l.city && <p className="text-xs text-slate-500">{l.city}</p>}
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-sm">
                  {l.course_interest && <p>{l.course_interest}</p>}
                  {l.college && <p className="text-xs text-slate-500">{l.college}</p>}
                  {l.budget && <p className="text-xs text-slate-500">Budget: {l.budget}</p>}
                  {l.message && <p className="mt-1 text-xs italic text-slate-500">“{l.message}”</p>}
                </TableCell>
                <TableCell className="text-xs text-slate-500">{l.source}</TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={(v: string) => upd.mutate({ id: l.id, s: v as LeadStatus })}>
                    <SelectTrigger size="sm" className={cn("w-36 border-0 font-medium", STATUS_CLS[l.status])} data-testid={`admin-lead-status-${l.id}`}><SelectValue>{(v) => v as string}</SelectValue></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} data-testid={`admin-lead-status-option-${s.toLowerCase()}`}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Button size="icon-sm" variant="ghost" aria-label="Delete lead" data-testid={`admin-lead-delete-${l.id}`} onClick={() => { if (window.confirm(`Delete lead from ${l.name}?`)) del.mutate(l.id); }} className="text-red-600"><Trash2 className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!leads.isLoading && !rows.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">No enquiries yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<TabKey>("leads");
  const me = useQuery({ queryKey: ["admin", "me"], queryFn: () => apiGet<AdminMe>("/auth/me"), retry: false });
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => apiGet<AdminStats>("/admin/stats"), enabled: me.isSuccess });

  if (me.isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-slate-400" /></div>;
  if (me.isError) return <Navigate to="/admin/login" replace />;

  const cards = [
    ["Total leads", stats.data?.leads], ["New leads", stats.data?.new_leads], ["Colleges", stats.data?.colleges], ["Courses", stats.data?.courses], ["Exams", stats.data?.exams], ["Articles", stats.data?.articles],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex" data-testid="admin-dashboard">
      <Toaster richColors />
      <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="flex items-center gap-3 p-5">
          <div className="rounded-lg bg-white p-1.5"><img src={SITE.logo} alt="" className="h-8 w-auto" /></div>
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} data-testid={`admin-nav-${t.key}`}
              className={cn("flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", tab === t.key ? "bg-sidebar-primary text-white" : "text-slate-300 hover:bg-sidebar-accent hover:text-white")}>
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
          <button type="button" onClick={() => endSession("/admin/login")} data-testid="admin-logout-button" className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-sidebar-accent hover:text-white transition-colors lg:mt-6">
            <LogOut className="size-4" /> Logout
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {me.data?.username}</h1>
            <p className="text-sm text-slate-500">Digital Shiksha content & lead management</p>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid="admin-view-site-link">View website ↗</a>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(([l, v]) => (
            <div key={l} className="rounded-xl border bg-white p-4" data-testid={`admin-stat-${l.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-xs text-slate-500">{l}</p>
              <p className="mt-1 text-2xl font-bold">{v ?? "—"}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          {tab === "leads" && <LeadsPanel />}
          {tab === "colleges" && <ContentManager resource="colleges" title="Colleges" fields={COLLEGE_FIELDS} publicPath="/colleges" columns={[{ key: "name", label: "Name" }, { key: "city", label: "City" }, { key: "type", label: "Type" }, { key: "nirf_rank", label: "NIRF" }]} />}
          {tab === "courses" && <ContentManager resource="courses" title="Courses" fields={COURSE_FIELDS} publicPath="/courses" columns={[{ key: "name", label: "Name" }, { key: "stream", label: "Stream" }, { key: "level", label: "Level" }, { key: "duration", label: "Duration" }]} />}
          {tab === "exams" && <ContentManager resource="exams" title="Exams" fields={EXAM_FIELDS} publicPath="/exams" columns={[{ key: "name", label: "Name" }, { key: "stream", label: "Stream" }, { key: "level", label: "Level" }, { key: "exam_date", label: "Date" }]} />}
          {tab === "articles" && <ContentManager resource="articles" title="Articles" fields={ARTICLE_FIELDS} publicPath="/news" columns={[{ key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "published_at", label: "Published" }]} />}
        </div>
      </main>
    </div>
  );
}
