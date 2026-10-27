import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, Download, FileSpreadsheet, MessageCircle, Send, FileText, GraduationCap, Inbox, Loader2, LogOut, School, Newspaper, Trash2, Lock, Users, SearchCheck, MapPinned, Wrench, Signpost, RotateCw, FileCode2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ContentManager from "@/components/admin/ContentManager";
import PredictorReportPanel from "@/components/admin/PredictorReport";
import CutoffUploadPanel from "@/components/admin/CutoffUpload";
import WhatsAppPanel from "@/components/admin/WhatsAppPanel";
import CounsellorsPanel from "@/components/admin/CounsellorsPanel";
import SeoPagesPanel from "@/components/admin/SeoPagesPanel";
import LandingManager from "@/components/admin/LandingManager";
import RedirectsPanel from "@/components/admin/RedirectsPanel";
import PageManager from "@/components/admin/PageManager";
import { Seo } from "@/components/Seo";
import { RESOURCES } from "@/components/admin/resources";
import SeoDashboard from "@/components/admin/SeoDashboard";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { beginSession, endSession } from "@/lib/session";
import type { AdminMe, ForgotOut, AdminStats, CounsellorWithStats, Lead, LeadAssignIn, LeadStatus, WhatsAppStatus } from "@/lib/types";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const STATUSES: LeadStatus[] = ["New", "Contacted", "In-Progress", "Converted"];
const STATUS_CLS: Record<LeadStatus, string> = {
  New: "bg-red-50 text-red-700", Contacted: "bg-indigo-50 text-indigo-800", "In-Progress": "bg-amber-50 text-amber-800", Converted: "bg-green-50 text-green-800",
};

const TABS = [
  { key: "leads", label: "Leads", icon: Inbox },
  { key: "counsellors", label: "Counsellors", icon: Users },
  { key: "predictor", label: "Predictor Report", icon: BarChart3 },
  { key: "cutoffs", label: "Cutoff Upload", icon: FileSpreadsheet },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "colleges", label: "Colleges", icon: School },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "exams", label: "Exams", icon: FileText },
  { key: "articles", label: "Articles", icon: Newspaper },
  { key: "landing", label: "City Pages", icon: MapPinned },
  { key: "seo-fix", label: "SEO Fix List", icon: Wrench },
  { key: "seo", label: "SEO → Pages", icon: SearchCheck },
  { key: "pages", label: "Pages & Schema", icon: FileCode2 },
  { key: "redirects", label: "Redirects", icon: Signpost },
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
  const forgot = useMutation({
    mutationFn: () => apiPost<ForgotOut>("/auth/forgot", {}),
    onSuccess: (r) => toast.success(`Reset link sent to ${r.sent_to}. It includes your username and expires in 30 minutes.`, { duration: 8000 }),
    onError: (e) => toast.error(e instanceof ApiError && typeof (e.body as { detail?: unknown })?.detail === "string" ? (e.body as { detail: string }).detail : "Could not send the reset link"),
  });
  return (
    <div className="grid min-h-screen place-items-center bg-brand-ink px-4" data-testid="admin-login-page">
      <Seo title="Admin login | Digital Shiksha" description="Digital Shiksha admin" noindex />
      <Toaster richColors />
      <form onSubmit={(e) => { e.preventDefault(); login.mutate(); }} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl animate-fade-up">
        <img src={SITE.logo} alt="Digital Shiksha" className="h-14 w-auto" />
        <h1 className="mt-6 flex items-center gap-2 text-xl font-semibold"><Lock className="size-5 text-brand-leaf" /> Admin login</h1>
        <p className="mt-1 text-sm text-slate-500">Manage leads, colleges, courses, exams and articles.</p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="admin-u">Username</Label><Input id="admin-u" data-testid="admin-login-username-input" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></div>
          <div className="grid gap-1.5"><Label htmlFor="admin-p">Password</Label><Input id="admin-p" type="password" data-testid="admin-login-password-input" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></div>
          <Button type="submit" disabled={login.isPending || !u || !p} data-testid="admin-login-submit-button" className="h-10 bg-brand-red text-white hover:bg-red-700">
            {login.isPending && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>
        </div>
        <button type="button" onClick={() => forgot.mutate()} disabled={forgot.isPending} data-testid="admin-login-forgot-button"
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-brand-blue hover:text-brand-leaf disabled:opacity-60 transition-colors">
          {forgot.isPending && <Loader2 className="size-3.5 animate-spin" />} Forgot username or password? Email me a reset link
        </button>
        <a href="/" className="mt-4 block text-center text-sm text-slate-500 hover:text-brand-leaf" data-testid="admin-login-back-link">← Back to website</a>
      </form>
    </div>
  );
}

const COUNSELLOR_WA = "918149689468";
const leadSummary = (l: Lead) =>
  [`New Digital Shiksha enquiry`, `Name: ${l.name}`, `Mobile: +91 ${l.phone}`, l.email && `Email: ${l.email}`, l.city && `City: ${l.city}`,
    l.course_interest && `Course: ${l.course_interest}`, l.college && `College: ${l.college}`, l.message && `Message: ${l.message}`].filter(Boolean).join("\n");

/** Owner alert email state for a lead; "pending" for over 5 minutes means the send never completed. */
function alertLabel(l: Lead): { label: string; cls: string; hint: string } {
  const at = l.alert_email_at ? new Date(l.alert_email_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
  switch (l.alert_email) {
    case "sent": return { label: "Sent", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", hint: `Accepted by the email service ${at}${l.alert_email_id ? ` · id ${l.alert_email_id}` : ""}. Not in your inbox? Check Spam / Quarantine.` };
    case "failed": return { label: "Failed", cls: "bg-red-50 text-red-700 ring-red-200", hint: `${l.alert_email_error || "Email service error"} ${at}` };
    case "duplicate": return { label: "Skipped (repeat)", cls: "bg-slate-100 text-slate-600 ring-slate-200", hint: "Same mobile number enquired within 10 minutes, so no second alert was sent." };
    case "off": return { label: "Not set up", cls: "bg-amber-50 text-amber-700 ring-amber-200", hint: "No alert email address is configured." };
    case "pending": return Date.now() - new Date(l.created_at).getTime() > 5 * 60_000
      ? { label: "Not sent", cls: "bg-red-50 text-red-700 ring-red-200", hint: "The alert never completed (server restarted?). Use resend." }
      : { label: "Sending…", cls: "bg-sky-50 text-sky-700 ring-sky-200", hint: "Alert email is being sent." };
    default: return { label: "—", cls: "bg-slate-50 text-slate-400 ring-slate-200", hint: "Enquiry received before alert tracking was added." };
  }
}

function AlertEmailCell({ lead, onResend, busy }: { lead: Lead; onResend: () => void; busy: boolean }) {
  const a = alertLabel(lead);
  const canResend = lead.alert_email !== "sent" && lead.alert_email !== "off";
  return (
    <div className="flex items-center gap-1.5">
      <span title={a.hint} className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", a.cls)} data-testid={`admin-lead-alert-${lead.id}`}>{a.label}</span>
      {(canResend || lead.alert_email === "sent") && (
        <Button size="icon-sm" variant="ghost" disabled={busy} onClick={onResend} title={canResend ? "Send alert email now" : "Send alert email again"} aria-label="Resend alert email"
          className="text-slate-500 transition-colors hover:text-brand-navy" data-testid={`admin-lead-alert-resend-${lead.id}`}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
        </Button>
      )}
    </div>
  );
}

function LeadsPanel({ whatsappOn, wa }: { whatsappOn: boolean | undefined; wa: WhatsAppStatus | null | undefined }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const counsellors = useQuery({ queryKey: ["admin", "counsellors"], queryFn: () => apiGet<CounsellorWithStats[]>("/admin/counsellors") });
  const byId = new Map((counsellors.data ?? []).map((c) => [c.id, c]));
  const leads = useQuery({ queryKey: ["admin", "leads"], queryFn: () => apiGet<Lead[]>("/admin/leads") });
  const inval = () => { qc.invalidateQueries({ queryKey: ["admin", "leads"] }); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); };
  const upd = useMutation({ mutationFn: ({ id, s }: { id: string; s: LeadStatus }) => apiPatch<Lead>(`/admin/leads/${id}`, { status: s }), onSuccess: () => { toast.success("Status updated"); inval(); }, onError: () => toast.error("Update failed") });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/leads/${id}`), onSuccess: () => { toast.success("Lead deleted"); inval(); } });
  const resend = useMutation({
    mutationFn: (id: string) => apiPost<Lead>(`/admin/leads/${id}/resend-alert`, {}),
    onSuccess: (l) => { if (l.alert_email === "sent") toast.success("Alert email sent again"); else toast.error(l.alert_email_error || "Alert email could not be sent"); inval(); },
    onError: () => toast.error("Could not resend the alert"),
  });
  const assign = useMutation({
    mutationFn: ({ id, cid }: { id: string; cid: string | null }) => apiPatch<Lead>(`/admin/leads/${id}/assign`, { counsellor_id: cid, notify: true } satisfies LeadAssignIn),
    onSuccess: (l) => { toast.success(l.counsellor_id ? `Assigned to ${byId.get(l.counsellor_id)?.name ?? "counsellor"} — WhatsApp & email alert queued` : "Lead unassigned"); inval(); qc.invalidateQueries({ queryKey: ["admin", "counsellors"] }); },
    onError: () => toast.error("Assignment failed"),
  });

  const rows = (leads.data ?? []).filter((l) => (status === "all" || l.status === status) && (owner === "all" || (owner === "none" ? !l.counsellor_id : l.counsellor_id === owner)) && (!q || `${l.name} ${l.phone} ${l.city} ${l.course_interest} ${l.college}`.toLowerCase().includes(q.toLowerCase())));

  const exportCsv = () => {
    const head = ["Date", "Name", "Phone", "Email", "City", "Course", "College", "Budget", "Message", "Source", "Alert email", "Status", "Counsellor"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((l) => [new Date(l.created_at).toLocaleString("en-IN"), l.name, l.phone, l.email ?? "", l.city, l.course_interest, l.college, l.budget, l.message, l.source, alertLabel(l).label, l.status, (l.counsellor_id && byId.get(l.counsellor_id)?.name) || ""].map(esc).join(","));
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
          <Select value={owner} onValueChange={(v: string) => setOwner(v)}>
            <SelectTrigger className="w-44 bg-white" data-testid="admin-leads-counsellor-filter"><SelectValue>{(v) => (v === "all" ? "All counsellors" : v === "none" ? "Unassigned" : byId.get(v as string)?.name ?? "Counsellor")}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counsellors</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {(counsellors.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length} data-testid="admin-leads-export-button"><Download className="size-4" /> Export CSV</Button>
        </div>
      </div>
      {whatsappOn !== undefined && (
        <div data-testid="admin-whatsapp-status" className={cn("mt-4 flex items-start gap-2 rounded-xl p-3 text-sm", whatsappOn && wa?.lead_template ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900")}>
          <MessageCircle className="mt-0.5 size-4 shrink-0" />
          {!whatsappOn ? "Automatic WhatsApp alerts are OFF until Twilio WhatsApp keys are added. Meanwhile use the green buttons to WhatsApp the student or forward a lead to the counsellor in one tap." : (
            <div className="space-y-0.5">
              <p className="font-semibold">Twilio WhatsApp connected — alerts go to the assigned counsellor (unassigned → +91 8149 68 9468).{!wa?.lead_template && " Waiting for an approved lead-alert template (TWILIO_LEAD_TEMPLATE_SID)."}</p>
              <p>Last counsellor alert: {wa?.last_lead ?? "—"}</p>
              <p>Last student college list: {wa?.last_student ?? "—"}{!wa?.student_template && " (needs TWILIO_STUDENT_TEMPLATE_SID)"}</p>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 rounded-2xl border bg-white">
        <Table data-testid="admin-leads-table">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Interest</TableHead><TableHead>Source</TableHead><TableHead>Alert email</TableHead><TableHead>Counsellor</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {leads.isLoading && <TableRow><TableCell colSpan={8} className="text-slate-500">Loading…</TableCell></TableRow>}
            {rows.map((l) => (
              <TableRow key={l.id} data-testid={`admin-lead-row-${l.id}`}>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">{new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900" data-testid={`admin-lead-name-${l.id}`}>{l.name}{l.role && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600" data-testid={`admin-lead-role-${l.id}`}>{l.role}</span>}</p>
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
                <TableCell><AlertEmailCell lead={l} onResend={() => resend.mutate(l.id)} busy={resend.isPending && resend.variables === l.id} /></TableCell>
                <TableCell>
                  <Select value={l.counsellor_id ?? "none"} onValueChange={(v: string) => assign.mutate({ id: l.id, cid: v === "none" ? null : v })}>
                    <SelectTrigger size="sm" className={cn("w-40", !l.counsellor_id && "text-slate-400")} data-testid={`admin-lead-assign-${l.id}`}><SelectValue>{(v) => (v === "none" ? "Unassigned" : byId.get(v as string)?.name ?? "Removed")}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" data-testid="admin-lead-assign-option-none">Unassigned</SelectItem>
                      {(counsellors.data ?? []).filter((c) => c.active || c.id === l.counsellor_id).map((c) => <SelectItem key={c.id} value={c.id} data-testid={`admin-lead-assign-option-${c.id}`}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={(v: string) => upd.mutate({ id: l.id, s: v as LeadStatus })}>
                    <SelectTrigger size="sm" className={cn("w-36 border-0 font-medium", STATUS_CLS[l.status])} data-testid={`admin-lead-status-${l.id}`}><SelectValue>{(v) => v as string}</SelectValue></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} data-testid={`admin-lead-status-option-${s.toLowerCase()}`}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <a href={`https://wa.me/91${l.phone}?text=${encodeURIComponent(`Hi ${l.name.split(" ")[0]}, this is Digital Shiksha regarding your admission enquiry. When is a good time to call you?`)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp student" title="WhatsApp student" data-testid={`admin-lead-whatsapp-${l.id}`} className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "text-[#128C7E]")}><MessageCircle className="size-4" /></a>
                  <a href={`https://wa.me/${l.counsellor_id && byId.get(l.counsellor_id) ? `91${byId.get(l.counsellor_id)!.phone}` : COUNSELLOR_WA}?text=${encodeURIComponent(leadSummary(l))}`} target="_blank" rel="noreferrer" aria-label="Forward to counsellor on WhatsApp" title="Forward to counsellor" data-testid={`admin-lead-forward-${l.id}`} className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "text-[#128C7E]")}><Send className="size-4" /></a>
                <Button size="icon-sm" variant="ghost" aria-label="Delete lead" data-testid={`admin-lead-delete-${l.id}`} onClick={() => { if (window.confirm(`Delete lead from ${l.name}?`)) del.mutate(l.id); }} className="text-red-600"><Trash2 className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!leads.isLoading && !rows.length && <TableRow><TableCell colSpan={8} className="py-8 text-center text-slate-500">No enquiries yet.</TableCell></TableRow>}
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
      <Seo title="Admin | Digital Shiksha" description="Digital Shiksha admin" noindex />
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
          {/* Plain download link: same-origin GET carries the admin cookie; the file comes from /api/admin/export. */}
          <a href="/api/admin/export" download data-testid="admin-export-db-link" className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-sidebar-accent hover:text-white transition-colors lg:mt-6">
            <Download className="size-4" /> Download database
          </a>
          <button type="button" onClick={() => endSession("/admin/login")} data-testid="admin-logout-button" className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-sidebar-accent hover:text-white transition-colors">
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
          <a href="/" target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-blue hover:text-brand-leaf" data-testid="admin-view-site-link">View website ↗</a>
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
          {tab === "leads" && <LeadsPanel whatsappOn={stats.data?.whatsapp_alerts} wa={stats.data?.whatsapp} />}
          {tab === "counsellors" && <CounsellorsPanel />}
          {tab === "seo" && <SeoPagesPanel />}
          {tab === "redirects" && <RedirectsPanel />}
          {tab === "pages" && <PageManager />}
          {tab === "landing" && <LandingManager />}
          {tab === "seo-fix" && <SeoDashboard />}
          {tab === "predictor" && <PredictorReportPanel />}
          {tab === "cutoffs" && <CutoffUploadPanel />}
          {tab === "whatsapp" && <WhatsAppPanel />}
          {tab === "colleges" && <ContentManager {...RESOURCES.colleges} />}
          {tab === "courses" && <ContentManager {...RESOURCES.courses} />}
          {tab === "exams" && <ContentManager {...RESOURCES.exams} />}
          {tab === "articles" && <ContentManager {...RESOURCES.articles} />}
        </div>
      </main>
    </div>
  );
}
