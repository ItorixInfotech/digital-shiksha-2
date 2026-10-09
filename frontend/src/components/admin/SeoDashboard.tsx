import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ContentManager from "@/components/admin/ContentManager";
import LandingManager, { landingScore } from "@/components/admin/LandingManager";
import SeoBadge from "@/components/admin/SeoBadge";
import { RESOURCES } from "@/components/admin/resources";
import { useSeoPages } from "@/components/Seo";
import { apiGet } from "@/lib/api";
import { entityScore, FIX_EFFORT, fixEffort, SHORT_FIX, type SeoKind, type SeoScore } from "@/lib/seo";
import type { LandingSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = SeoKind | "landing";
type Level = SeoScore["level"];
type Row = { id: string; slug: string; name?: string; title?: string } & Record<string, unknown>;
interface Item { kind: Kind; slug: string; name: string; url: string; score: SeoScore; effort: number }

const KINDS: { key: Kind; label: string }[] = [
  { key: "colleges", label: "Colleges" }, { key: "courses", label: "Courses" }, { key: "exams", label: "Exams" },
  { key: "articles", label: "Articles" }, { key: "landing", label: "City pages" },
];
const LEVEL_CLS: Record<Level, string> = { green: "text-green-700 bg-green-50", amber: "text-amber-800 bg-amber-50", red: "text-red-700 bg-red-50" };
const fetchRows = (k: SeoKind) => apiGet<Row[]>(`/${k}${k === "colleges" ? "?limit=500" : ""}`);

export default function SeoDashboard() {
  const year = useSeoPages().data?.year ?? new Date().getFullYear();
  // Same query keys as the content tabs, so a save anywhere refreshes this list.
  const colleges = useQuery({ queryKey: ["colleges", "admin"], queryFn: () => fetchRows("colleges") });
  const courses = useQuery({ queryKey: ["courses", "admin"], queryFn: () => fetchRows("courses") });
  const exams = useQuery({ queryKey: ["exams", "admin"], queryFn: () => fetchRows("exams") });
  const articles = useQuery({ queryKey: ["articles", "admin"], queryFn: () => fetchRows("articles") });
  const landing = useQuery({ queryKey: ["landing", "list"], queryFn: () => apiGet<LandingSummary[]>("/landing") });
  const [kind, setKind] = useState<Kind | "all">("all");
  const [level, setLevel] = useState<Level | "todo">("todo");
  const [fixing, setFixing] = useState<{ kind: Kind; slug: string } | null>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const add = (k: SeoKind, rows?: Row[]) => rows?.forEach((r) => {
      const score = entityScore(k, r, year);
      out.push({ kind: k, slug: r.slug, name: String(r.name ?? r.title ?? r.slug), url: `${RESOURCES[k].publicPath}/${r.slug}`, score, effort: fixEffort(score) });
    });
    add("colleges", colleges.data); add("courses", courses.data); add("exams", exams.data); add("articles", articles.data);
    landing.data?.forEach((l) => { const score = landingScore(l); out.push({ kind: "landing", slug: l.slug, name: l.label, url: `/${l.slug}`, score, effort: fixEffort(score) }); });
    return out;
  }, [colleges.data, courses.data, exams.data, articles.data, landing.data, year]);

  const loading = [colleges, courses, exams, articles, landing].some((q) => q.isLoading);
  const summary = KINDS.map((k) => {
    const of = items.filter((i) => i.kind === k.key);
    return { ...k, total: of.length, green: of.filter((i) => i.score.level === "green").length, amber: of.filter((i) => i.score.level === "amber").length, red: of.filter((i) => i.score.level === "red").length };
  });
  const rows = items
    .filter((i) => (kind === "all" || i.kind === kind) && (level === "todo" ? i.score.level !== "green" : i.score.level === level))
    .sort((a, b) => a.effort - b.effort || b.score.score - a.score.score || a.name.localeCompare(b.name));
  const todo = items.filter((i) => i.score.level !== "green").length;

  return (
    <div data-testid="admin-seo-dashboard">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Wrench className="size-5 text-brand-red" /> SEO fix list</h2>
          <p className="mt-1 text-sm text-slate-500">Every red and amber page in one place, quickest fixes first. <span className="font-semibold text-slate-800" data-testid="admin-seo-todo-count">{todo}</span> page(s) need attention.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {summary.map((s) => (
          <button key={s.key} type="button" onClick={() => setKind(kind === s.key ? "all" : s.key)} data-testid={`admin-seo-summary-${s.key}`}
            className={cn("rounded-2xl border bg-white p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow,border-color]", kind === s.key ? "border-brand-navy ring-2 ring-brand-navy/15" : "border-slate-200")}>
            <p className="text-xs font-medium text-slate-500">{s.label} <span className="text-slate-400">({s.total})</span></p>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
              {(["green", "amber", "red"] as const).map((l) => s.total > 0 && <span key={l} style={{ width: `${(s[l] / s.total) * 100}%` }} className={cn("transition-[width] duration-500", l === "green" ? "bg-green-500" : l === "amber" ? "bg-amber-400" : "bg-red-500")} />)}
            </div>
            <div className="mt-2 flex gap-3 text-xs font-semibold">
              <span className="text-green-700" data-testid={`admin-seo-summary-${s.key}-green`}>{s.green} ●</span>
              <span className="text-amber-700" data-testid={`admin-seo-summary-${s.key}-amber`}>{s.amber} ●</span>
              <span className="text-red-600" data-testid={`admin-seo-summary-${s.key}-red`}>{s.red} ●</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-white p-0.5" role="group" aria-label="Type">
          {[{ key: "all" as const, label: "All types" }, ...KINDS].map((k) => (
            <button key={k.key} type="button" onClick={() => setKind(k.key)} data-testid={`admin-seo-filter-type-${k.key}`}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", kind === k.key ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-slate-100")}>{k.label}</button>
          ))}
        </div>
        <div className="flex rounded-lg border bg-white p-0.5" role="group" aria-label="Colour">
          {([["todo", "Red + amber"], ["red", "Red"], ["amber", "Amber"], ["green", "Green"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setLevel(k)} data-testid={`admin-seo-filter-level-${k}`}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", level === k ? "bg-brand-red text-white" : "text-slate-600 hover:bg-slate-100")}>{label}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500" data-testid="admin-seo-row-count">{rows.length} shown</span>
      </div>

      <div className="mt-3 rounded-2xl border bg-white">
        <Table data-testid="admin-seo-fix-table">
          <TableHeader><TableRow><TableHead>Page</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>What to fix</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="text-slate-500">Calculating scores…</TableCell></TableRow>}
            {!loading && rows.map((i) => {
              const tid = `admin-seo-fix-row-${i.kind}-${i.slug}`;
              return (
                <TableRow key={`${i.kind}-${i.slug}`} data-testid={tid}>
                  <TableCell className="max-w-xs whitespace-normal">
                    <a href={i.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium hover:text-brand-red">{i.name} <ExternalLink className="size-3 text-slate-400" /></a>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{KINDS.find((k) => k.key === i.kind)?.label}</TableCell>
                  <TableCell><SeoBadge score={i.score} testid={`${tid}-score`} /></TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1.5">
                      {i.score.checks.filter((c) => !c.ok).sort((a, b) => FIX_EFFORT[a.id] - FIX_EFFORT[b.id]).map((c) => (
                        <span key={c.id} title={c.fix} className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", FIX_EFFORT[c.id] <= 1 ? "bg-teal-50 text-teal-800" : FIX_EFFORT[c.id] <= 2 ? "bg-sky-50 text-sky-800" : "bg-slate-100 text-slate-700")} data-testid={`${tid}-chip-${c.id}`}>
                          {SHORT_FIX[c.id]}{FIX_EFFORT[c.id] <= 1 && " · quick"}
                        </span>
                      ))}
                      {i.score.checks.every((c) => c.ok) && <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", LEVEL_CLS.green)}>All checks pass</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setFixing({ kind: i.kind, slug: i.slug })} className="bg-brand-red text-white hover:bg-red-700" data-testid={`${tid}-fix-button`}>Fix</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && !rows.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500" data-testid="admin-seo-empty">Nothing to fix here — every page in this filter is green.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {fixing && (fixing.kind === "landing"
        ? <LandingManager key={fixing.slug} editSlug={fixing.slug} onClose={() => setFixing(null)} />
        : <ContentManager key={`${fixing.kind}-${fixing.slug}`} {...RESOURCES[fixing.kind]} editSlug={fixing.slug} onClose={() => setFixing(null)} />)}
    </div>
  );
}
