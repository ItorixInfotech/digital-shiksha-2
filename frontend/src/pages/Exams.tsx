import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Monitor } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { Exam } from "@/lib/types";
import { slugify } from "@/lib/site";
import { cn } from "@/lib/utils";
import { PageSeo } from "@/components/Seo";
import { breadcrumbLd } from "@/lib/seo";

const LEVELS = ["", "National", "State", "University"];

export default function Exams() {
  const [sp, setSp] = useSearchParams();
  const stream = sp.get("stream") ?? "";
  const level = sp.get("level") ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const { data, isLoading, isError } = useQuery({ queryKey: ["exams", "all"], queryFn: () => apiGet<Exam[]>("/exams") });
  const all = data ?? [];
  const streams = [...new Set(all.map((e) => e.stream))];
  const list = all.filter((e) => (!stream || e.stream === stream) && (!level || e.level === level));

  return (
    <div data-testid="exams-page">
      <PageSeo page="exams" jsonLd={[breadcrumbLd([["Home", "/"], ["Exams", "/exams"]])]} />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Exams" }]} title="Entrance Exams in India 2026" subtitle="National, state and university-level entrance exams — dates, eligibility, syllabus and application deadlines." testid="exams-header" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((l) => (
            <button key={l || "all"} type="button" onClick={() => set("level", l)} data-testid={`exams-level-${l ? slugify(l) : "all"}`} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors", level === l ? "border-brand-navy bg-brand-navy text-white" : "bg-white text-slate-700 hover:border-slate-400")}>{l || "All exams"}</button>
          ))}
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => set("stream", "")} data-testid="exams-stream-all" className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors", !stream ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-white")}>All streams</button>
          {streams.map((s) => <button key={s} type="button" onClick={() => set("stream", s)} data-testid={`exams-stream-${slugify(s)}`} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors", stream === s ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-white")}>{s}</button>)}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {isLoading ? <p className="text-slate-500">Loading exams…</p>
            : isError ? <EmptyState title="Exams are unavailable right now" />
            : !list.length ? <EmptyState title="No exams match" testid="exams-empty" />
            : list.map((e) => (
              <Link key={e.id} to={`/exams/${e.slug}`} data-testid={`exam-card-${e.slug}`} className="group flex gap-4 rounded-2xl border bg-white p-5 hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow]">
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand-navy text-center text-[11px] font-bold leading-tight text-white">{e.name.split(" ")[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{e.name}</p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{e.level}</span>
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-red">{e.stream}</span>
                  </div>
                  <p className="truncate text-sm text-slate-500">{e.full_name}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Exam: {e.exam_date}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> Apply by: {e.application_deadline}</span>
                    <span className="flex items-center gap-1"><Monitor className="size-3.5" /> {e.mode}</span>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
