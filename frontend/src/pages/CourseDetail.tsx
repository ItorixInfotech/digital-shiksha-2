import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, GraduationCap, IndianRupee, Wallet } from "lucide-react";
import CollegeCard from "@/components/CollegeCard";
import EnquiryForm from "@/components/EnquiryForm";
import { EmptyState, PageHeader } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { College, Course, Exam } from "@/lib/types";
import { slugify } from "@/lib/site";

export default function CourseDetail() {
  const { slug = "" } = useParams();
  const { data: c, isLoading, isError } = useQuery({ queryKey: ["course", slug], queryFn: () => apiGet<Course>(`/courses/${slug}`) });
  const colleges = useQuery({ queryKey: ["colleges", "stream", c?.stream], queryFn: () => apiGet<College[]>(`/colleges?stream=${encodeURIComponent(c!.stream)}`), enabled: !!c });
  const exams = useQuery({ queryKey: ["exams", "all"], queryFn: () => apiGet<Exam[]>("/exams") });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-20"><div className="h-48 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (isError || !c) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="Course not found" testid="course-not-found" /><p className="mt-4 text-center"><Link to="/courses" className="font-semibold text-brand-red">All courses →</Link></p></div>;

  const examLink = (name: string) => exams.data?.find((e) => e.name === name)?.slug;
  const facts = [[Clock, "Duration", c.duration], [GraduationCap, "Level", c.level], [IndianRupee, "Average fees", c.avg_fees], [Wallet, "Average salary", c.avg_salary]] as const;

  return (
    <div data-testid="course-detail-page">
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Courses", to: "/courses" }, { label: c.name }]} title={<>{c.name}: <span className="text-red-400">{c.full_name}</span></>} subtitle={`${c.stream} • Admission 2026, fees, eligibility, entrance exams & career scope`} testid="course-header" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-6 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {facts.map(([Icon, l, v]) => <div key={l} className="rounded-xl border bg-white p-4"><p className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="size-3.5" /> {l}</p><p className="mt-1 text-sm font-semibold text-slate-900">{v}</p></div>)}
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-semibold">What is {c.name}?</h2>
            <p className="mt-3 leading-relaxed text-slate-600" data-testid="course-overview">{c.overview}</p>
            <h3 className="mt-6 font-semibold">Eligibility</h3>
            <p className="mt-1 text-slate-600">{c.eligibility}</p>
            <h3 className="mt-6 font-semibold">Entrance exams</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.entrance_exams.map((e) => { const s = examLink(e); return s ? <Link key={e} to={`/exams/${s}`} data-testid={`course-exam-${slugify(e)}`} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-brand-blue hover:bg-indigo-100 transition-colors">{e}</Link> : <span key={e} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{e}</span>; })}
            </div>
            <h3 className="mt-6 font-semibold">Popular specialisations</h3>
            <div className="mt-2 flex flex-wrap gap-2">{c.specializations.map((s) => <span key={s} className="rounded-lg border px-3 py-1 text-sm text-slate-700">{s}</span>)}</div>
            <h3 className="mt-6 font-semibold">Career options</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{c.careers.map((s) => <p key={s} className="flex items-center gap-2 text-slate-700"><Briefcase className="size-4 text-brand-teal" /> {s}</p>)}</div>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Top {c.stream} colleges offering {c.name}</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {(colleges.data ?? []).slice(0, 4).map((col) => <CollegeCard key={col.id} c={col} />)}
            </div>
            {colleges.data && !colleges.data.length && <p className="mt-3 text-sm text-slate-500">College list coming soon — ask our counsellors.</p>}
          </div>
        </div>
        <aside className="lg:col-span-4">
          <div className="sticky top-32 rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Need help choosing {c.name} college?</h3>
            <p className="mt-1 text-sm text-slate-500">Talk to a Digital Shiksha counsellor — free.</p>
            <div className="mt-4"><EnquiryForm testid="course-lead" prefill={{ course_interest: "", source: `course-${c.slug}` }} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
