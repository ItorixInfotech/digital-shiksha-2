import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import { CANONICAL_ORIGIN, DESC_MAX, TITLE_MAX } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SiteSchemaPanel from "@/components/admin/SiteSchemaPanel";
import TitleFixer from "@/components/admin/TitleFixer";
import type { PageOverride, PageOverrideIn, PageOverrideSaveOut, SchemaBlock, SchemaValidateOut, SitePage } from "@/lib/types";

const KINDS: [string, string][] = [["all", "All pages"], ["static", "Main pages"], ["landing", "City pages"], ["colleges", "Colleges"], ["courses", "Courses"], ["exams", "Exams"], ["articles", "News"], ["custom", "Other URLs"]];
const SCHEMA_TYPES = ["Organization", "LocalBusiness", "EducationalOrganization", "CollegeOrUniversity", "WebPage", "WebSite", "Article", "NewsArticle", "BreadcrumbList", "FAQPage", "Course", "Event", "HowTo", "Product"];

/** Starter JSON-LD for each type, pre-filled with Digital Shiksha details where known. */
function template(type: string, path: string, title: string): string {
  const url = `${CANONICAL_ORIGIN}${path === "/" ? "" : path}`;
  const base = { "@context": "https://schema.org", "@type": type };
  const t: Record<string, object> = {
    Organization: { name: SITE.name, url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/logo.png`, telephone: "+91 8149 68 9468", sameAs: [] },
    EducationalOrganization: { name: SITE.name, url: CANONICAL_ORIGIN, logo: `${CANONICAL_ORIGIN}/logo.png` },
    LocalBusiness: { name: SITE.name, url: CANONICAL_ORIGIN, telephone: "+91 8149 68 9468", image: `${CANONICAL_ORIGIN}/logo.png`,
      address: { "@type": "PostalAddress", streetAddress: "", addressLocality: "Pune", addressRegion: "Maharashtra", postalCode: "", addressCountry: "IN" },
      openingHours: "Mo-Sa 10:00-19:00", geo: { "@type": "GeoCoordinates", latitude: 18.5204, longitude: 73.8567 } },
    WebPage: { name: title, url, description: "" },
    WebSite: { name: SITE.name, url: CANONICAL_ORIGIN },
    Article: { headline: title, datePublished: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: SITE.name }, image: `${CANONICAL_ORIGIN}/logo.png` },
    NewsArticle: { headline: title, datePublished: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: SITE.name }, image: `${CANONICAL_ORIGIN}/logo.png` },
    BreadcrumbList: { itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: CANONICAL_ORIGIN }, { "@type": "ListItem", position: 2, name: title, item: url }] },
    FAQPage: { mainEntity: [{ "@type": "Question", name: "Question?", acceptedAnswer: { "@type": "Answer", text: "Answer." } }] },
    CollegeOrUniversity: { name: title, url, address: { "@type": "PostalAddress", addressLocality: "", addressCountry: "IN" } },
    Course: { name: title, description: "", provider: { "@type": "Organization", name: "", sameAs: "" } },
    Event: { name: title, startDate: "", location: { "@type": "Place", name: "", address: "" } },
    HowTo: { name: title, step: [{ "@type": "HowToStep", text: "" }] },
    Product: { name: title },
  };
  return JSON.stringify({ ...base, ...(t[type] ?? {}) }, null, 2);
}

const EMPTY = (path: string): PageOverrideIn => ({ path, h1: "", meta_title: "", meta_description: "", keywords: [], canonical_url: "", og_image: "", noindex: false, schemas: [], replace_auto_schema: true });

export default function PageManager() {
  const [view, setView] = useState("pages");
  return (
    <Tabs value={view} onValueChange={(v) => setView(String(v))} className="gap-4" data-testid="page-manager-tabs">
      <TabsList className="flex-wrap">
        <TabsTrigger value="pages" data-testid="page-manager-tab-pages">Pages</TabsTrigger>
        <TabsTrigger value="fixer" data-testid="page-manager-tab-fixer">Bulk title fixer</TabsTrigger>
        <TabsTrigger value="site" data-testid="page-manager-tab-site">Site-wide schema</TabsTrigger>
      </TabsList>
      <TabsContent value="pages"><PageList /></TabsContent>
      <TabsContent value="fixer"><TitleFixer /></TabsContent>
      <TabsContent value="site"><SiteSchemaPanel /></TabsContent>
    </Tabs>
  );
}

function PageList() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const pages = useQuery({ queryKey: ["admin", "page-seo", "pages"], queryFn: () => apiGet<SitePage[]>("/admin/page-seo/pages") });
  const list = useMemo(() => (pages.data ?? []).filter((p) => (kind === "all" || p.kind === kind) && (!q || `${p.label} ${p.path}`.toLowerCase().includes(q.toLowerCase()))), [pages.data, kind, q]);
  const current = pages.data?.find((p) => p.path === path);
  const [custom, setCustom] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-12" data-testid="admin-page-manager">
      <section className="rounded-2xl border bg-white p-4 shadow-sm lg:col-span-4">
        <h2 className="text-lg font-semibold">All website pages</h2>
        <p className="mt-1 text-xs text-slate-500">{pages.data?.length ?? 0} pages · {pages.data?.filter((p) => p.has_override).length ?? 0} customised. Pick one to edit its H1, meta tags, canonical and schema.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input placeholder="Search pages…" value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2" data-testid="page-manager-search" />
          <Select value={kind} onValueChange={(v: string) => setKind(v)}>
            <SelectTrigger className="col-span-2 w-full" data-testid="page-manager-kind"><SelectValue>{(v) => KINDS.find(([k]) => k === v)?.[1]}</SelectValue></SelectTrigger>
            <SelectContent>{KINDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto pr-1">
          {pages.isLoading && <p className="p-2 text-sm text-slate-500">Loading pages…</p>}
          {list.slice(0, 300).map((p) => (
            <button key={p.path} type="button" onClick={() => setPath(p.path)} data-testid={`page-manager-item-${p.path.replace(/[^a-z0-9]+/gi, "-")}`}
              className={cn("block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50", path === p.path && "bg-slate-100 ring-1 ring-slate-200")}>
              <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className="truncate">{p.label}</span>
                {p.has_override && <span className="shrink-0 rounded bg-brand-leaf/10 px-1.5 text-[10px] font-semibold text-brand-leaf">custom</span>}
              </span>
              <span className="block truncate text-xs text-slate-400">{p.path}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2 border-t pt-3">
          <Input placeholder="/any-other-url" value={custom} onChange={(e) => setCustom(e.target.value)} data-testid="page-manager-custom-path" />
          <Button variant="outline" onClick={() => custom.startsWith("/") ? setPath(custom.trim()) : toast.error('Path must start with "/"')} data-testid="page-manager-custom-open"><Plus className="size-4" /> Open</Button>
        </div>
      </section>
      <section className="lg:col-span-8">
        {path ? <PageEditor key={path} path={path} page={current} /> : (
          <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500" data-testid="page-manager-empty">
            Choose a page on the left to manage its SEO and schema markup.
          </div>
        )}
      </section>
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("text-xs tabular-nums", n > max ? "text-red-600" : n === 0 ? "text-slate-400" : "text-emerald-600")}>{n}/{max}</span>;
}

function PageEditor({ path, page }: { path: string; page?: SitePage }) {
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ["admin", "page-seo", path], queryFn: () => apiGet<PageOverride | null>(`/admin/page-seo?path=${encodeURIComponent(path)}`) });
  const [draft, setDraft] = useState<PageOverrideIn | null>(null);
  const f: PageOverrideIn = draft ?? existing.data ?? EMPTY(path);
  const set = (patch: Partial<PageOverrideIn>) => setDraft({ ...f, ...patch });
  const [issues, setIssues] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
  const [checks, setChecks] = useState<Record<number, SchemaValidateOut>>({});
  const label = page?.label ?? path;

  const done = () => { qc.invalidateQueries({ queryKey: ["admin", "page-seo"] }); qc.invalidateQueries({ queryKey: ["page-seo"] }); };
  const save = useMutation({
    mutationFn: (body: PageOverrideIn) => apiPut<PageOverrideSaveOut>("/admin/page-seo", body),
    onSuccess: (r) => { setDraft(r.page); setIssues({ errors: [], warnings: r.warnings }); toast.success("Published. The live page now uses these settings."); done(); },
    onError: (e) => {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" ? (e.body as { detail?: unknown }).detail : null;
      if (d && typeof d === "object" && "errors" in d) { setIssues(d as { errors: string[]; warnings: string[] }); toast.error("Fix the errors below before publishing"); }
      else toast.error("Could not save. Check the fields and try again.");
    },
  });
  const reset = useMutation({ mutationFn: () => apiDelete(`/admin/page-seo?path=${encodeURIComponent(path)}`), onSuccess: () => { setDraft(EMPTY(path)); setChecks({}); toast.success("Custom settings removed. The page uses its defaults again."); done(); } });
  const validate = async (i: number, b: SchemaBlock) => {
    try {
      const r = await apiPost<SchemaValidateOut>("/admin/schema/validate", { type: b.type, json_text: b.json_text });
      setChecks((c) => ({ ...c, [i]: r }));
      if (r.valid && r.formatted) setBlock(i, { json_text: r.formatted });
      r.valid ? toast.success(`${b.type} schema is valid`) : toast.error(`${b.type} schema has ${r.errors.length} error(s)`);
    } catch { toast.error("Could not validate right now"); }
  };
  const setBlock = (i: number, patch: Partial<SchemaBlock>) => set({ schemas: f.schemas.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const shownTitle = f.meta_title || page?.default_title || label;
  const pub = `${CANONICAL_ORIGIN}${path === "/" ? "" : path}`;

  return (
    <div className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm" data-testid="page-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold" data-testid="page-editor-title">{label}</h2>
          <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-leaf hover:underline">{path} <ExternalLink className="size-3" /></a>
        </div>
        <div className="flex gap-2">
          {existing.data && <Button variant="outline" size="sm" onClick={() => { if (window.confirm("Remove all custom SEO settings for this page?")) reset.mutate(); }} data-testid="page-editor-reset"><Trash2 className="size-4" /> Reset to defaults</Button>}
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(f)} className="bg-brand-navy text-white" data-testid="page-editor-save">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Validate & publish
          </Button>
        </div>
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Leave a field empty to keep the page's automatic value. The page's own content heading is used when H1 is empty; there is always exactly one H1.</p>

      <div className="rounded-xl border p-4" data-testid="page-editor-serp-preview">
        <p className="text-xs text-slate-500">Google preview</p>
        <p className="mt-1 truncate text-xs text-emerald-700">{pub}</p>
        <p className="truncate text-lg text-[#1a0dab]">{shownTitle}</p>
        <p className="line-clamp-2 text-sm text-slate-600">{f.meta_description || "Automatic description from the page content."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2"><Label>H1 heading (main page heading)</Label>
          <Input value={f.h1} maxLength={120} onChange={(e) => set({ h1: e.target.value })} placeholder={label} data-testid="page-editor-h1" /></div>
        <div className="grid gap-1.5 sm:col-span-2"><div className="flex justify-between"><Label>Meta title</Label><Counter n={f.meta_title.length} max={TITLE_MAX} /></div>
          <Input value={f.meta_title} maxLength={70} onChange={(e) => set({ meta_title: e.target.value })} placeholder={page?.default_title || "Automatic"} data-testid="page-editor-meta-title" /></div>
        <div className="grid gap-1.5 sm:col-span-2"><div className="flex justify-between"><Label>Meta description</Label><Counter n={f.meta_description.length} max={DESC_MAX} /></div>
          <Textarea rows={3} maxLength={170} value={f.meta_description} onChange={(e) => set({ meta_description: e.target.value })} placeholder="Automatic" data-testid="page-editor-meta-description" /></div>
        <div className="grid gap-1.5"><Label>Focus keywords (comma separated)</Label>
          <Input value={f.keywords.join(", ")} onChange={(e) => set({ keywords: e.target.value.split(",").map((k) => k.trimStart()) })} data-testid="page-editor-keywords" /></div>
        <div className="grid gap-1.5"><Label>Canonical URL</Label>
          <Input value={f.canonical_url} onChange={(e) => set({ canonical_url: e.target.value })} placeholder={pub} data-testid="page-editor-canonical" /></div>
        <div className="grid gap-1.5"><Label>Share image URL (Open Graph)</Label>
          <Input value={f.og_image} onChange={(e) => set({ og_image: e.target.value })} placeholder="https://… or /logo.png" data-testid="page-editor-og-image" /></div>
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          <span>Hide from Google (noindex)</span><Checkbox checked={f.noindex} onCheckedChange={(v) => set({ noindex: Boolean(v) })} data-testid="page-editor-noindex" />
        </label>
      </div>

      <div className="space-y-3 border-t pt-4" data-testid="page-editor-schemas">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Schema markup (JSON-LD)</h3>
            <p className="text-xs text-slate-500">The page already outputs automatic schema (site-wide Organization + LocalBusiness from the Site-wide schema tab, plus BreadcrumbList, FAQPage, Article). A custom block replaces the automatic one of the same type, so nothing is duplicated.</p>
          </div>
          <Select value="" onValueChange={(t: string) => set({ schemas: [...f.schemas, { type: t, json_text: template(t, path, label), enabled: true }] })}>
            <SelectTrigger size="sm" className="w-48" data-testid="page-editor-add-schema"><SelectValue>{() => "+ Add schema block"}</SelectValue></SelectTrigger>
            <SelectContent>{SCHEMA_TYPES.map((t) => <SelectItem key={t} value={t} data-testid={`page-editor-add-schema-${t.toLowerCase()}`}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {f.schemas.map((b, i) => {
          const c = checks[i];
          return (
            <div key={i} className="space-y-2 rounded-xl border p-3" data-testid={`page-editor-schema-${i}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">{b.type}</span>
                <label className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={b.enabled} onCheckedChange={(v) => setBlock(i, { enabled: Boolean(v) })} /> Enabled</label>
                <div className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => validate(i, b)} data-testid={`page-editor-schema-validate-${i}`}><ShieldCheck className="size-4" /> Validate</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => set({ schemas: f.schemas.filter((_, j) => j !== i) })} data-testid={`page-editor-schema-remove-${i}`}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <Textarea rows={10} value={b.json_text} onChange={(e) => { setBlock(i, { json_text: e.target.value }); setChecks((x) => { const y = { ...x }; delete y[i]; return y; }); }}
                className="font-mono text-xs" spellCheck={false} data-testid={`page-editor-schema-json-${i}`} />
              {c && (
                <div className={cn("rounded-lg p-2 text-xs", c.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")} data-testid={`page-editor-schema-result-${i}`}>
                  {c.valid ? "✓ Valid schema" : c.errors.map((e) => <p key={e}>✗ {e}</p>)}
                  {c.warnings.map((w) => <p key={w} className="text-amber-700">⚠ {w}</p>)}
                </div>
              )}
            </div>
          );
        })}
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <Checkbox checked={f.replace_auto_schema} onCheckedChange={(v) => set({ replace_auto_schema: Boolean(v) })} data-testid="page-editor-replace-auto" />
          Custom blocks replace automatic blocks of the same type (recommended)
        </label>
      </div>

      {(issues.errors.length > 0 || issues.warnings.length > 0) && (
        <div className="space-y-1 rounded-xl border p-3 text-sm" data-testid="page-editor-issues">
          {issues.errors.map((e) => <p key={e} className="flex gap-2 text-red-700"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {e}</p>)}
          {issues.warnings.map((w) => <p key={w} className="flex gap-2 text-amber-700"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}</p>)}
        </div>
      )}
    </div>
  );
}
