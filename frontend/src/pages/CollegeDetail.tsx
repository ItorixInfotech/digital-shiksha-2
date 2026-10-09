import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Award, Building, CalendarDays, Check, GitCompareArrows, IndianRupee, MapPin, Phone, Star, TrendingUp, Trophy, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import EnquiryForm from "@/components/EnquiryForm";
import { EmptyState } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { College } from "@/lib/types";
import { SITE, feeRange } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { EntitySeo } from "@/components/Seo";

const TABS = ["Overview", "Courses & Fees", "Admission 2026", "Cutoff", "Placements", "Facilities"];

export default function CollegeDetail() {
  const { slug = "" } = useParams();
  const [tab, setTab] = useState(TABS[0]);
  const { openEnquiry, compare, toggleCompare } = useSite();
  const { data: c, isLoading, isError } = useQuery({ queryKey: ["college", slug], queryFn: () => apiGet<College>(`/colleges/${slug}`) });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-20"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (isError || !c) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="College not found" body="It may have been removed. Browse all colleges instead." testid="college-not-found" /><div className="mt-4 text-center"><Link to="/colleges" className="font-semibold text-brand-red">Browse colleges →</Link></div></div>;

  const inCompare = compare.includes(c.slug);
  const facts = [
    [Trophy, "NIRF Rank", c.nirf_rank ? `#${c.nirf_rank}` : "—"],
    [IndianRupee, "Fees (1st yr)", feeRange(c.fees_min, c.fees_max)],
    [TrendingUp, "Avg Package", c.avg_package ? `₹${c.avg_package} LPA` : "—"],
    [Award, "Highest Package", c.highest_package ? `₹${c.highest_package} LPA` : "—"],
    [Users, "Placement Rate", c.placement_rate ? `${c.placement_rate}%` : "—"],
    [Building, "Ownership", c.type],
  ] as const;

  return (
    <div data-testid="college-detail-page">
      <EntitySeo kind="colleges" item={c} />
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/80 to-brand-ink/30" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pt-24">
          <p className="text-xs text-slate-400"><Link to="/" className="hover:text-white">Home</Link> / <Link to="/colleges" className="hover:text-white">Colleges</Link> / <span className="text-slate-300">{c.short_name}</span></p>
          <div className="mt-4 flex flex-wrap gap-2">
            {c.approvals.map((a) => <span key={a} className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-white/15">{a} Approved</span>)}
            <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-300">{c.type}</span>
          </div>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" data-testid="college-name">{c.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
            <span className="flex items-center gap-1"><MapPin className="size-4" /> {c.city}, {c.state}</span>
            {c.established && <span className="flex items-center gap-1"><CalendarDays className="size-4" /> Estd. {c.established}</span>}
            <span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /> {c.rating.toFixed(1)} / 5</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button data-testid="college-apply-button" onClick={() => openEnquiry({ college: c.name, source: "college-detail", title: `Apply to ${c.short_name || c.name}` })} className="h-10 bg-brand-red px-5 text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">Apply Now</Button>
            <Button data-testid="college-compare-toggle" variant="outline" onClick={() => toggleCompare(c.slug)} className="h-10 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <GitCompareArrows className="size-4" /> {inCompare ? "Added to compare" : "Add to compare"}
            </Button>
            <a href={SITE.phoneHref} data-testid="college-call-link" className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"><Phone className="size-4" /> {SITE.phone}</a>
          </div>
        </div>
      </section>

      <div className="sticky top-[100px] z-20 border-b bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
            <TabsList variant="line" className="no-scrollbar h-12 max-w-full justify-start overflow-x-auto">
              {TABS.map((t) => <TabsTrigger key={t} value={t} data-testid={`college-tab-${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{t}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-6 lg:col-span-8" data-testid="college-tab-content">
          {tab === "Overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {facts.map(([Icon, l, v]) => (
                  <div key={l} className="rounded-xl border bg-white p-4">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="size-3.5" /> {l}</p>
                    <p className="mt-1 font-semibold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border bg-white p-6">
                <h2 className="text-xl font-semibold">About {c.short_name || c.name}</h2>
                <p className="mt-3 leading-relaxed text-slate-600" data-testid="college-overview">{c.overview}</p>
                <h3 className="mt-6 font-semibold">Streams offered</h3>
                <div className="mt-2 flex flex-wrap gap-2">{c.streams.map((s) => <Link key={s} to={`/colleges?stream=${encodeURIComponent(s)}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-red-50 hover:text-brand-red transition-colors">{s}</Link>)}</div>
                <h3 className="mt-6 font-semibold">Exams accepted</h3>
                <div className="mt-2 flex flex-wrap gap-2">{c.exams_accepted.map((e) => <span key={e} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-brand-blue">{e}</span>)}</div>
              </div>
            </>
          )}
          {tab === "Courses & Fees" && (
            <div className="rounded-2xl border bg-white p-2 sm:p-4">
              <h2 className="px-2 pt-2 text-xl font-semibold">{c.short_name} courses & fees 2026</h2>
              <Table className="mt-3" data-testid="college-courses-table">
                <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Duration</TableHead><TableHead>Fees</TableHead><TableHead className="hidden md:table-cell">Eligibility</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {c.courses.map((cr) => (
                    <TableRow key={cr.name}>
                      <TableCell className="font-medium">{cr.name}{cr.seats ? <span className="block text-xs text-slate-500">{cr.seats} seats</span> : null}</TableCell>
                      <TableCell>{cr.duration}</TableCell>
                      <TableCell className="whitespace-normal">{cr.fees}</TableCell>
                      <TableCell className="hidden whitespace-normal text-slate-600 md:table-cell">{cr.eligibility}</TableCell>
                      <TableCell><Button size="xs" variant="outline" data-testid={`college-course-enquire-${cr.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => openEnquiry({ college: c.name, course_interest: "", source: "college-course", title: `${cr.name} at ${c.short_name}` })}>Enquire</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!c.courses.length && <p className="p-4 text-sm text-slate-500">Course details coming soon — enquire for the latest fee structure.</p>}
            </div>
          )}
          {tab === "Admission 2026" && (
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-semibold">{c.short_name} admission process 2026</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{c.admission}</p>
              <ol className="mt-6 space-y-4">
                {["Appear for the accepted entrance exam: " + c.exams_accepted.join(", "), "Register for state / central counselling (CAP, MCC, JoSAA or institute process)", "Fill and lock college-branch choices", "Seat allotment, document verification & fee payment", "Report to the institute for commencement of classes"].map((s, i) => (
                  <li key={s} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-navy text-sm font-semibold text-white">{i + 1}</span><span className="pt-0.5 text-slate-700">{s}</span></li>
                ))}
              </ol>
            </div>
          )}
          {tab === "Cutoff" && (
            <div className="rounded-2xl border bg-white p-2 sm:p-4">
              <h2 className="px-2 pt-2 text-xl font-semibold">{c.short_name} cutoff (previous year)</h2>
              <Table className="mt-3" data-testid="college-cutoff-table">
                <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Course / Branch</TableHead><TableHead>Category</TableHead><TableHead>Closing cutoff</TableHead></TableRow></TableHeader>
                <TableBody>{c.cutoffs.map((r, i) => <TableRow key={i}><TableCell className="font-medium">{r.exam}</TableCell><TableCell>{r.branch}</TableCell><TableCell>{r.category || "General"}</TableCell><TableCell>{r.cutoff}</TableCell></TableRow>)}</TableBody>
              </Table>
              <p className="px-2 py-3 text-xs text-slate-500">Cutoffs are indicative. Get a personalised prediction from our counsellors.</p>
            </div>
          )}
          {tab === "Placements" && (
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-semibold">{c.short_name} placements</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-green-50 p-4"><p className="text-xs text-green-800">Average package</p><p className="text-2xl font-bold text-green-900">{c.avg_package ? `₹${c.avg_package} LPA` : "—"}</p></div>
                <div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs text-indigo-800">Highest package</p><p className="text-2xl font-bold text-indigo-900">{c.highest_package ? `₹${c.highest_package} LPA` : "—"}</p></div>
                <div className="rounded-xl bg-red-50 p-4"><p className="text-xs text-red-800">Placement rate</p><p className="text-2xl font-bold text-red-900">{c.placement_rate ? `${c.placement_rate}%` : "—"}</p></div>
              </div>
              <h3 className="mt-6 font-semibold">Top recruiters</h3>
              <div className="mt-2 flex flex-wrap gap-2">{c.top_recruiters.map((r) => <span key={r} className="rounded-lg border px-3 py-1.5 text-sm text-slate-700">{r}</span>)}</div>
            </div>
          )}
          {tab === "Facilities" && (
            <div className="rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-semibold">Campus facilities</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{c.facilities.map((f) => <p key={f} className="flex items-center gap-2 text-slate-700"><Check className="size-4 text-brand-green" /> {f}</p>)}</div>
            </div>
          )}
        </motion.div>

        <aside className="lg:col-span-4">
          <div className="sticky top-44 rounded-2xl border bg-white p-6 shadow-sm" data-testid="college-lead-panel">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-red">Free counselling</p>
            <h3 className="mt-1 text-lg font-semibold">Want admission in {c.short_name}?</h3>
            <p className="mt-1 text-sm text-slate-500">Get cutoff prediction, fee details & seat guidance.</p>
            <div className="mt-4"><EnquiryForm testid="college-lead" prefill={{ college: c.name, source: "college-sidebar" }} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
