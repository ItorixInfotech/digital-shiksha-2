import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BadgeCheck, CalendarDays, ChevronDown, Compass, FileCheck2, Headphones, MapPin, Phone, Target } from "lucide-react";
import GlobalSearch from "@/components/GlobalSearch";
import CollegeCard from "@/components/CollegeCard";
import EnquiryForm from "@/components/EnquiryForm";
import { CardSkeleton, EmptyState, SectionTitle } from "@/components/Common";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import type { Article, College, Course, Exam, Meta } from "@/lib/types";
import { SITE, STATS, STREAMS, slugify } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { PageSeo } from "@/components/Seo";
import { organizationLd } from "@/lib/seo";

const HERO_IMG = "https://images.unsplash.com/photo-1687709348710-05314eea5476?crop=entropy&cs=srgb&fm=jpg&q=80&w=1600";
const QUICK = [["College Predictor", "/predictor"], ["B.Tech", "/courses/btech"], ["MBA", "/courses/mba"], ["MBBS", "/courses/mbbs"], ["BBA", "/courses/bba"], ["BA LLB", "/courses/ba-llb"], ["MHT CET", "/exams/mht-cet"], ["NEET UG", "/exams/neet-ug"]];
const TOP_TABS = ["Engineering", "Management", "Medical", "Law", "Design"];
const CITIES = ["Pune", "Mumbai", "New Delhi", "Bengaluru", "Chennai", "Ahmedabad", "Vellore", "Pilani"];
const FAQ = [
  ["What does an admission consultant do?", "An admission consultant guides students on college selection, eligibility, cutoffs, fees, and the complete admission process — from entrance exam registration to final seat reporting."],
  ["Do you provide admission support in Pune and Mumbai?", "Yes. Digital Shiksha offers admission consultancy across Pune & Mumbai for Engineering, MBA, Medical, Law, Pharmacy and all UG & PG courses — and guides students for colleges across India."],
  ["Is your counselling legal and transparent?", "Absolutely. We follow official guidelines and provide only legitimate, document-based guidance through CAP, MCC and institute-level processes."],
  ["When should I contact an admission consultant?", "Ideally before counselling rounds begin, but even late applicants benefit from expert guidance on spot rounds and institute-level seats."],
];

export default function Home() {
  const { openEnquiry } = useSite();
  const [tab, setTab] = useState("Engineering");
  const [faq, setFaq] = useState(0);

  const meta = useQuery({ queryKey: ["meta"], queryFn: () => apiGet<Meta>("/meta") });
  const top = useQuery({ queryKey: ["colleges", "stream", tab], queryFn: () => apiGet<College[]>(`/colleges?stream=${encodeURIComponent(tab)}&limit=200`) });
  const courses = useQuery({ queryKey: ["courses", "all"], queryFn: () => apiGet<Course[]>("/courses") });
  const exams = useQuery({ queryKey: ["exams", "all"], queryFn: () => apiGet<Exam[]>("/exams") });
  const articles = useQuery({ queryKey: ["articles", ""], queryFn: () => apiGet<Article[]>("/articles") });

  const count = (s: string) => meta.data?.streams.find((x) => x.name === s)?.count;
  const popular = (courses.data ?? []).filter((c) => c.popular).slice(0, 12);
  const upcoming = ["jee-main", "neet-ug", "mht-cet", "cat", "clat", "cuet-ug"].map((s) => exams.data?.find((e) => e.slug === s)).filter((e): e is Exam => !!e);

  return (
    <div data-testid="home-page">
      <PageSeo page="home" jsonLd={[organizationLd(), { "@context": "https://schema.org", "@type": "WebSite", name: "Digital Shiksha", url: window.location.origin }]} />
      {/* HERO */}
      <section className="relative overflow-hidden bg-brand-ink text-white" data-testid="home-hero">
        <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-ink via-brand-ink/90 to-brand-ink/40" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-7 animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-300 ring-1 ring-white/15">
              <BadgeCheck className="size-4" /> Counselling • Admission • India-only
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your gateway to the <span className="text-red-400">best colleges</span> in India.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Explore {meta.data?.totals.colleges ?? "top"} colleges, {meta.data?.totals.courses ?? "40+"} courses and {meta.data?.totals.exams ?? "30+"} entrance exams — then let our Pune experts handle your admission end-to-end.
            </p>
            <div className="mt-8 max-w-2xl"><GlobalSearch size="lg" testid="hero-search" /></div>
            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK.map(([l, to]) => (
                <Link key={l} to={to} data-testid={`hero-quick-${slugify(l)}`} className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-slate-200 hover:bg-white/15 hover:text-white transition-colors">{l}</Link>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 lg:pl-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-300">Why students trust us</p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {STATS.map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/[0.06] p-4" data-testid={`hero-stat-${slugify(s.label)}`}>
                    <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <a href={SITE.phoneHref} data-testid="hero-call-button" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-brand-navy hover:bg-slate-100 transition-colors"><Phone className="size-4" /> Call Now</a>
                <button type="button" data-testid="hero-enquire-button" onClick={() => openEnquiry({ source: "hero" })} className="flex-1 rounded-lg bg-brand-red px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">Enquire Now</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STREAMS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="home-streams">
        <SectionTitle overline="Explore by stream" title="Top study streams in India" action={<Link to="/courses" className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid="home-all-courses-link">All courses <ArrowRight className="size-4" /></Link>} />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {STREAMS.slice(0, 18).map((s) => (
            <Link key={s.name} to={`/colleges?stream=${encodeURIComponent(s.name)}`} data-testid={`home-stream-${slugify(s.name)}`}
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md transition-[transform,box-shadow,border-color]">
              <span className={`grid size-10 place-items-center rounded-lg ${s.tint}`}><s.icon className="size-5" /></span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{s.name}</span>
                <span className="text-xs text-slate-500">{count(s.name) ? `${count(s.name)} colleges` : "Explore"}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* TOP COLLEGES */}
      <section className="border-y bg-white py-16" data-testid="home-top-colleges">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionTitle overline="Top ranked" title="Top colleges in India" action={<Link to={`/colleges?stream=${encodeURIComponent(tab)}`} className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid="home-view-all-colleges-link">View all {tab} colleges <ArrowRight className="size-4" /></Link>} />
          <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="mt-6">
            <TabsList className="no-scrollbar max-w-full overflow-x-auto">
              {TOP_TABS.map((t) => <TabsTrigger key={t} value={t} data-testid={`home-top-tab-${slugify(t)}`}>{t}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {top.isLoading ? <CardSkeleton count={3} /> : top.isError ? (
              <div className="md:col-span-2 lg:col-span-3"><EmptyState title="Colleges are loading slowly" body="Please refresh, or call us for instant guidance." /></div>
            ) : (top.data ?? []).slice(0, 6).map((c) => <CollegeCard key={c.id} c={c} />)}
          </div>
        </div>
      </section>

      {/* POPULAR COURSES + EXAMS */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-7" data-testid="home-popular-courses">
          <SectionTitle overline="Courses" title="Popular courses" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {popular.map((c) => (
              <Link key={c.id} to={`/courses/${c.slug}`} data-testid={`home-course-${c.slug}`} className="group flex items-center justify-between rounded-xl border bg-white p-4 hover:border-slate-300 hover:shadow-md transition-[box-shadow,border-color]">
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{c.name}</span>
                  <span className="block truncate text-xs text-slate-500">{c.duration} • {c.level} • {c.avg_fees}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-slate-400 group-hover:translate-x-0.5 group-hover:text-brand-red transition-[transform,color]" />
              </Link>
            ))}
            {courses.isLoading && <p className="text-sm text-slate-500">Loading courses…</p>}
          </div>
        </div>
        <div className="lg:col-span-5" data-testid="home-upcoming-exams">
          <SectionTitle overline="Entrance exams" title="Upcoming exams 2026" action={<Link to="/exams" className="text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid="home-all-exams-link">All exams</Link>} />
          <ul className="mt-6 divide-y rounded-2xl border bg-white">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link to={`/exams/${e.slug}`} data-testid={`home-exam-${e.slug}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-brand-red"><CalendarDays className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{e.name}</span>
                    <span className="block truncate text-xs text-slate-500">{e.conducting_body} • {e.mode}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-semibold text-brand-navy">{e.exam_date}</span>
                </Link>
              </li>
            ))}
            {exams.isLoading && <li className="p-4 text-sm text-slate-500">Loading exams…</li>}
          </ul>
        </div>
      </section>

      {/* CITIES */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8" data-testid="home-predictor-cta">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-navy to-brand-blue p-8 text-white sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand-teal/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-300">New • College Predictor 2026</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Got your MHT CET, JEE or NEET score?</h2>
              <p className="mt-2 max-w-xl text-slate-200">See which Pune & Mumbai colleges you can likely get — based on last year's closing cutoffs.</p>
            </div>
            <Link to="/predictor" data-testid="home-predictor-link" className="shrink-0 rounded-lg bg-brand-red px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">Predict my college →</Link>
          </div>
        </div>
      </section>

      {/* CITIES */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8" data-testid="home-cities">
        <SectionTitle overline="By location" title="Explore colleges by city" />
        <div className="mt-6 flex flex-wrap gap-3">
          {CITIES.map((c) => (
            <Link key={c} to={`/colleges?city=${encodeURIComponent(c)}`} data-testid={`home-city-${slugify(c)}`} className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-red hover:text-brand-red transition-colors">
              <MapPin className="size-4" /> {c}
            </Link>
          ))}
        </div>
      </section>

      {/* CONSULTATION */}
      <section className="bg-brand-navy text-white" data-testid="home-consultation">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-20">
          <div className="lg:col-span-6">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400">Digital Shiksha — top admission consultant</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Book your free consultation</h2>
            <p className="mt-4 max-w-lg text-slate-300">Looking for a trusted admission consultant in Pune or Mumbai? Our counsellors with 16+ years of experience help you pick the right course and college, and secure your seat.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                [Compass, "Career mapping", "Course-to-career guidance based on your aptitude."],
                [Target, "Cutoff analysis", "Realistic college shortlist from your score."],
                [FileCheck2, "Documentation", "CAP/MCC registration and document checks."],
                [Headphones, "End-to-end support", "From option form to seat reporting."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Compass;
                return (
                  <div key={t as string} className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-teal-300"><I className="size-5" /></span>
                    <div><p className="font-semibold">{t as string}</p><p className="text-sm text-slate-400">{d as string}</p></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p><span className="font-semibold text-white">Vision:</span> To streamline the admission process for students, saving their time, money and effort in finding a suitable college.</p>
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
              <h3 className="text-xl font-semibold">Talk to an expert counsellor</h3>
              <p className="mt-1 text-sm text-slate-500">We usually call back within a few hours.</p>
              <div className="mt-5"><EnquiryForm testid="home-consultation" prefill={{ source: "home-consultation" }} showMessage /></div>
            </div>
          </div>
        </div>
      </section>

      {/* NEWS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" data-testid="home-news">
        <SectionTitle overline="Latest updates" title="Admission news & articles" action={<Link to="/news" className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-red" data-testid="home-all-news-link">All news <ArrowRight className="size-4" /></Link>} />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {(articles.data ?? []).slice(0, 3).map((a) => (
            <Link key={a.id} to={`/news/${a.slug}`} data-testid={`home-article-${a.slug}`} className="group overflow-hidden rounded-2xl border bg-white hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow]">
              <img src={a.image} alt="" loading="lazy" className="h-44 w-full object-cover" />
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-red">{a.category}</p>
                <h3 className="mt-2 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{a.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{a.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-white" data-testid="home-faq">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-4"><SectionTitle overline="FAQ" title="Questions students ask us" /></div>
          <div className="divide-y rounded-2xl border lg:col-span-8">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button type="button" data-testid={`home-faq-toggle-${i}`} onClick={() => setFaq(faq === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold text-slate-900 hover:text-brand-red transition-colors">
                  {q} <ChevronDown className={`size-5 shrink-0 transition-transform ${faq === i ? "rotate-180" : ""}`} />
                </button>
                {faq === i && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 animate-fade-up">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
