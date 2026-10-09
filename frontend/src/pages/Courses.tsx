import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, IndianRupee } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { Course } from "@/lib/types";
import { STREAMS, slugify, streamDef } from "@/lib/site";
import { cn } from "@/lib/utils";

const LEVELS = ["", "UG", "PG", "Diploma", "Doctorate", "Certification"];

export default function Courses() {
  const [sp, setSp] = useSearchParams();
  const stream = sp.get("stream") ?? "";
  const level = sp.get("level") ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  const { data, isLoading, isError } = useQuery({ queryKey: ["courses", "all"], queryFn: () => apiGet<Course[]>("/courses") });
  const all = data ?? [];
  const filtered = all.filter((c) => (!stream || c.stream === stream) && (!level || c.level === level));
  const streams = STREAMS.map((s) => s.name).filter((s) => all.some((c) => c.stream === s));
  const groups = streams.filter((s) => filtered.some((c) => c.stream === s));

  return (
    <div data-testid="courses-page">
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Courses" }]} title="Courses in India 2026" subtitle="Explore UG, PG, Diploma and Doctorate courses across every stream — duration, fees, eligibility, entrance exams and career scope." testid="courses-header" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2" data-testid="courses-level-filter">
          {LEVELS.map((l) => (
            <button key={l || "all"} type="button" onClick={() => set("level", l)} data-testid={`courses-level-${l ? slugify(l) : "all"}`}
              className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors", level === l ? "border-brand-navy bg-brand-navy text-white" : "bg-white text-slate-700 hover:border-slate-400")}>{l || "All levels"}</button>
          ))}
        </div>
        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="courses-stream-filter">
          <button type="button" onClick={() => set("stream", "")} data-testid="courses-stream-all" className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors", !stream ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-white")}>All streams</button>
          {streams.map((s) => (
            <button key={s} type="button" onClick={() => set("stream", s)} data-testid={`courses-stream-${slugify(s)}`} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors", stream === s ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-white")}>{s}</button>
          ))}
        </div>

        {isLoading ? <p className="mt-10 text-slate-500">Loading courses…</p>
          : isError ? <div className="mt-10"><EmptyState title="Courses are unavailable right now" body="Please try again shortly." /></div>
          : !groups.length ? <div className="mt-10"><EmptyState title="No courses match" body="Try another level or stream." testid="courses-empty" /></div>
          : groups.map((g) => {
            const d = streamDef(g);
            return (
              <section key={g} className="mt-10" data-testid={`courses-group-${slugify(g)}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-lg ${d.tint}`}><d.icon className="size-5" /></span>
                  <h2 className="text-xl font-semibold text-slate-900">{g}</h2>
                  <Link to={`/colleges?stream=${encodeURIComponent(g)}`} className="ml-auto text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid={`courses-group-colleges-${slugify(g)}`}>{g} colleges →</Link>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.filter((c) => c.stream === g).map((c) => (
                    <Link key={c.id} to={`/courses/${c.slug}`} data-testid={`course-card-${c.slug}`} className="group flex flex-col rounded-2xl border bg-white p-5 hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{c.name}</p>
                          <p className="text-sm text-slate-500">{c.full_name}</p>
                        </div>
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-brand-blue">{c.level}</span>
                      </div>
                      <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><Clock className="size-4 text-slate-400" /> {c.duration}</p>
                        <p className="flex items-center gap-2"><IndianRupee className="size-4 text-slate-400" /> {c.avg_fees}</p>
                      </div>
                      <p className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brand-red">View details <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" /></p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
