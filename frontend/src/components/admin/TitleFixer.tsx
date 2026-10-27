import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, RotateCcw, Save, Scissors, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPut } from "@/lib/api";
import { DESC_MAX, TITLE_MAX } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { BulkSeoItem, BulkSeoOut, TitleAuditRow, TitleIssue } from "@/lib/types";

const ISSUES: [TitleIssue, string][] = [
  ["title_long", "Title too long"], ["title_missing", "Title missing"], ["title_short", "Title too short"], ["title_duplicate", "Duplicate title"],
  ["desc_long", "Description too long"], ["desc_missing", "Description missing"], ["desc_short", "Description too short"],
];
const ISSUE_LABEL = Object.fromEntries(ISSUES) as Record<TitleIssue, string>;
const KINDS: [string, string][] = [["all", "All page types"], ["static", "Main pages"], ["landing", "City pages"], ["colleges", "Colleges"], ["courses", "Courses"], ["exams", "Exams"], ["articles", "News"]];
const PAGE = 50;

/** Cut at a word boundary without "…" so the result reads as a finished sentence. */
const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n + 1).replace(/\s+\S*$/, "").replace(/[\s,:;–—-]+$/, ""));
const shortTitle = (t: string) => cut(t.replace(` | ${SITE.name}`, "").trim(), TITLE_MAX);
const shortDesc = (d: string) => {
  if (d.length <= DESC_MAX) return d;
  const sentence = d.slice(0, DESC_MAX).match(/^.*[.!?](?=\s|$)/)?.[0];
  return sentence && sentence.length >= 70 ? sentence : `${cut(d, DESC_MAX - 1)}.`;
};
const liveIssues = (t: string, d: string, dupes: Set<string>, original: string): TitleIssue[] => {
  const out: TitleIssue[] = [];
  if (!t) out.push("title_missing"); else if (t.length > TITLE_MAX) out.push("title_long"); else if (t.length < 30) out.push("title_short");
  if (!d) out.push("desc_missing"); else if (d.length > DESC_MAX) out.push("desc_long"); else if (d.length < 70) out.push("desc_short");
  if (t && t === original && dupes.has(t.toLowerCase())) out.push("title_duplicate");
  return out;
};

type Draft = { t?: string; d?: string };

export default function TitleFixer() {
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["admin", "page-seo", "audit"], queryFn: () => apiGet<TitleAuditRow[]>("/admin/page-seo/audit") });
  const [issue, setIssue] = useState<"problems" | TitleIssue>("problems");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const rows = useMemo(() => audit.data ?? [], [audit.data]);
  const dupes = useMemo(() => {
    const c = new Map<string, number>();
    rows.forEach((r) => c.set(r.title.toLowerCase(), (c.get(r.title.toLowerCase()) ?? 0) + 1));
    return new Set([...c].filter(([, n]) => n > 1).map(([t]) => t));
  }, [rows]);
  const counts = useMemo(() => Object.fromEntries(ISSUES.map(([k]) => [k, rows.filter((r) => r.issues.includes(k)).length])) as Record<TitleIssue, number>, [rows]);
  const problems = rows.filter((r) => r.issues.length).length;
  // Filter on the server's issues so a row being fixed stays on screen until saved.
  const list = useMemo(() => rows.filter((r) => (issue === "problems" ? r.issues.length > 0 : r.issues.includes(issue)) && (kind === "all" || r.kind === kind)
    && (!q || `${r.label} ${r.path} ${r.title}`.toLowerCase().includes(q.toLowerCase()))), [rows, issue, kind, q]);
  const changed = Object.keys(drafts).length;

  const val = (r: TitleAuditRow) => ({ t: drafts[r.path]?.t ?? r.title, d: drafts[r.path]?.d ?? r.description });
  const edit = (r: TitleAuditRow, patch: Draft) => setDrafts((x) => {
    const next = { ...x[r.path], ...patch };
    if ((next.t ?? r.title) === r.title && (next.d ?? r.description) === r.description) { const y = { ...x }; delete y[r.path]; return y; }
    return { ...x, [r.path]: next };
  });
  const autoFix = (r: TitleAuditRow): Draft => {
    const { t, d } = val(r);
    return { t: t.length > TITLE_MAX ? shortTitle(t) : t, d: d.length > DESC_MAX ? shortDesc(d) : d };
  };
  const fixAll = () => {
    const targets = list.filter((r) => { const { t, d } = val(r); return t.length > TITLE_MAX || d.length > DESC_MAX; });
    if (!targets.length) { toast.info("Nothing to shorten in this list. Missing or short ones need your words."); return; }
    targets.forEach((r) => edit(r, autoFix(r)));
    toast.success(`Shortened ${targets.length} page(s). Review them, then press Save.`);
  };

  const save = useMutation({
    mutationFn: () => {
      const items: BulkSeoItem[] = Object.entries(drafts).map(([path, dr]) => {
        const r = rows.find((x) => x.path === path)!;
        return { path, meta_title: dr.t !== undefined ? dr.t.trim() : r.title_custom, meta_description: dr.d !== undefined ? dr.d.trim() : r.description_custom };
      });
      return apiPut<BulkSeoOut>("/admin/page-seo/bulk", { items });
    },
    onSuccess: (r) => {
      setDrafts({});
      toast.success(`Saved ${r.saved} page(s). The live pages use the new titles now.`);
      qc.invalidateQueries({ queryKey: ["admin", "page-seo"] });
      qc.invalidateQueries({ queryKey: ["page-seo"] });
    },
    onError: () => toast.error("Could not save. Titles can be at most 70 and descriptions 170 characters."),
  });
  const resetRow = (r: TitleAuditRow) => {
    if (!window.confirm("Go back to the automatic title and description for this page?")) return;
    apiPut<BulkSeoOut>("/admin/page-seo/bulk", { items: [{ path: r.path, meta_title: "", meta_description: "" }] })
      .then(() => { toast.success("Back to automatic"); setDrafts((x) => { const y = { ...x }; delete y[r.path]; return y; }); qc.invalidateQueries({ queryKey: ["admin", "page-seo"] }); qc.invalidateQueries({ queryKey: ["page-seo"] }); })
      .catch(() => toast.error("Could not reset"));
  };

  return (
    <div className="space-y-4" data-testid="title-fixer">
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Bulk title fixer</h2>
            <p className="mt-1 text-sm text-slate-500" data-testid="title-fixer-summary">
              {audit.isLoading ? "Checking every page…" : <><b className="text-slate-800">{problems}</b> of {rows.length} pages need attention. Google shows about {TITLE_MAX} title and {DESC_MAX} description characters.</>}
            </p>
          </div>
          <Button variant="outline" onClick={fixAll} disabled={!list.length} data-testid="title-fixer-auto-shorten"><Wand2 className="size-4" /> Shorten all long ones in this list</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="title-fixer-issue-chips">
          <Chip active={issue === "problems"} onClick={() => { setIssue("problems"); setShown(PAGE); }} testid="title-fixer-chip-problems">All problems · {problems}</Chip>
          {ISSUES.map(([k, l]) => <Chip key={k} active={issue === k} onClick={() => { setIssue(k); setShown(PAGE); }} testid={`title-fixer-chip-${k}`} tone={k.endsWith("long") || k.endsWith("missing") ? "red" : "amber"}>{l} · {counts[k] ?? 0}</Chip>)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_200px]">
          <Input placeholder="Search by page name, address or title…" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} data-testid="title-fixer-search" />
          <Select value={kind} onValueChange={(v: string) => { setKind(v); setShown(PAGE); }}>
            <SelectTrigger className="w-full" data-testid="title-fixer-kind"><SelectValue>{(v) => KINDS.find(([k]) => k === v)?.[1]}</SelectValue></SelectTrigger>
            <SelectContent>{KINDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      {!audit.isLoading && list.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500" data-testid="title-fixer-empty">No pages match. Everything in this list is within Google's limits.</div>
      )}
      <div className="space-y-3">
        {list.slice(0, shown).map((r) => {
          const { t, d } = val(r);
          const now = liveIssues(t, d, dupes, r.title);
          const dirty = Boolean(drafts[r.path]);
          const id = r.path.replace(/[^a-z0-9]+/gi, "-");
          return (
            <article key={r.path} className={cn("rounded-2xl border bg-white p-4 shadow-sm transition-shadow", dirty && "ring-2 ring-brand-leaf/40")} data-testid={`title-fixer-row-${id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate font-medium text-slate-800">{r.label}</span>
                <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">{KINDS.find(([k]) => k === r.kind)?.[1] ?? r.kind}</span>
                <a href={r.path} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-brand-leaf hover:underline">{r.path} <ExternalLink className="size-3" /></a>
                <div className="ml-auto flex flex-wrap gap-1" data-testid={`title-fixer-row-issues-${id}`}>
                  {now.length === 0 ? <span className="rounded bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">Looks good</span>
                    : now.map((i) => <span key={i} className={cn("rounded px-1.5 text-[11px] font-medium", i.endsWith("long") || i.endsWith("missing") ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{ISSUE_LABEL[i]}</span>)}
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-1">
                  <div className="flex items-center justify-between text-xs text-slate-500"><span>Meta title {r.title_custom ? "(custom)" : "(automatic)"}</span><Count n={t.length} max={TITLE_MAX} /></div>
                  <Input value={t} maxLength={70} onChange={(e) => edit(r, { t: e.target.value })} data-testid={`title-fixer-title-${id}`} />
                </div>
                <div className="grid gap-1">
                  <div className="flex items-center justify-between text-xs text-slate-500"><span>Meta description {r.description_custom ? "(custom)" : "(automatic)"}</span><Count n={d.length} max={DESC_MAX} /></div>
                  <Textarea rows={2} value={d} onChange={(e) => edit(r, { d: e.target.value.slice(0, 170) })} data-testid={`title-fixer-description-${id}`} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(t.length > TITLE_MAX || d.length > DESC_MAX) && <Button size="sm" variant="outline" onClick={() => edit(r, autoFix(r))} data-testid={`title-fixer-shorten-${id}`}><Scissors className="size-4" /> Shorten</Button>}
                {dirty && <Button size="sm" variant="ghost" onClick={() => setDrafts((x) => { const y = { ...x }; delete y[r.path]; return y; })} data-testid={`title-fixer-undo-${id}`}>Undo</Button>}
                {(r.title_custom || r.description_custom) && <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => resetRow(r)} data-testid={`title-fixer-reset-${id}`}><RotateCcw className="size-4" /> Use automatic</Button>}
              </div>
            </article>
          );
        })}
      </div>
      {list.length > shown && <div className="text-center"><Button variant="outline" onClick={() => setShown((n) => n + PAGE)} data-testid="title-fixer-load-more">Show more ({list.length - shown} left)</Button></div>}

      <div className={cn("sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-white/90 p-3 shadow-lg backdrop-blur transition-[opacity,transform] duration-200",
        changed ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")} data-testid="title-fixer-savebar">
        <span className="text-sm text-slate-700" data-testid="title-fixer-changed-count">{changed} page(s) changed</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDrafts({})} data-testid="title-fixer-discard">Discard</Button>
          <Button className="bg-brand-navy text-white" disabled={!changed || save.isPending} onClick={() => save.mutate()} data-testid="title-fixer-save">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save all changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function Count({ n, max }: { n: number; max: number }) {
  return <span className={cn("tabular-nums", n > max ? "font-semibold text-red-600" : n === 0 ? "text-slate-400" : "text-emerald-600")}>{n}/{max}</span>;
}

function Chip({ active, onClick, children, testid, tone = "slate" }: { active: boolean; onClick: () => void; children: React.ReactNode; testid: string; tone?: "slate" | "red" | "amber" }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-brand-navy bg-brand-navy text-white"
        : tone === "red" ? "border-red-200 text-red-700 hover:bg-red-50" : tone === "amber" ? "border-amber-200 text-amber-800 hover:bg-amber-50" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
      {children}
    </button>
  );
}
