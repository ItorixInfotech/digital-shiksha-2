import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Building, CalendarDays, Clock, Globe, Monitor } from "lucide-react";
import CollegeCard from "@/components/CollegeCard";
import EnquiryForm from "@/components/EnquiryForm";
import { EmptyState, PageHeader } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { College, Exam } from "@/lib/types";
import { EntitySeo } from "@/components/Seo";

export default function ExamDetail() {
  const { slug = "" } = useParams();
  const { data: e, isLoading, isError } = useQuery({ queryKey: ["exam", slug], queryFn: () => apiGet<Exam>(`/exams/${slug}`) });
  const colleges = useQuery({ queryKey: ["colleges", "all"], queryFn: () => apiGet<College[]>("/colleges") });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-20"><div className="h-48 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (isError || !e) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="Exam not found" testid="exam-not-found" /><p className="mt-4 text-center"><Link to="/exams" className="font-semibold text-brand-red">All exams →</Link></p></div>;

  const accepting = (colleges.data ?? []).filter((c) => c.exams_accepted.includes(e.name)).slice(0, 4);
  const facts = [[CalendarDays, "Exam date", e.exam_date], [Clock, "Application deadline", e.application_deadline], [Monitor, "Mode", e.mode], [Building, "Conducted by", e.conducting_body]] as const;

  return (
    <div data-testid="exam-detail-page">
      <EntitySeo kind="exams" item={e} />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Exams", to: "/exams" }, { label: e.name }]} title={`${e.name} 2026`} subtitle={`${e.full_name} — dates, eligibility, syllabus & accepting colleges`} testid="exam-header" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-6 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {facts.map(([Icon, l, v]) => <div key={l} className="rounded-xl border bg-white p-4"><p className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="size-3.5" /> {l}</p><p className="mt-1 text-sm font-semibold text-slate-900">{v}</p></div>)}
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-semibold">About {e.name}</h2>
            <p className="mt-3 leading-relaxed text-slate-600" data-testid="exam-overview">{e.overview}</p>
            <h3 className="mt-6 font-semibold">Eligibility</h3>
            <p className="mt-1 text-slate-600">{e.eligibility}</p>
            <h3 className="mt-6 font-semibold">Syllabus / sections</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{e.syllabus.map((s) => <li key={s} className="flex items-center gap-2 text-slate-700"><BookMarked className="size-4 text-brand-teal" /> {s}</li>)}</ul>
            {e.website && <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Globe className="size-4" /> Official website: <span className="font-medium text-brand-blue">{e.website}</span></p>}
          </div>
          {accepting.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold">Colleges accepting {e.name}</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">{accepting.map((c) => <CollegeCard key={c.id} c={c} />)}</div>
            </div>
          )}
        </div>
        <aside className="lg:col-span-4">
          <div className="sticky top-32 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Got your {e.name} score?</h3>
            <p className="mt-1 text-sm text-slate-500">Get a college predictor & counselling plan from our experts.</p>
            <div className="mt-4"><EnquiryForm testid="exam-lead" prefill={{ source: `exam-${e.slug}` }} showMessage /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
