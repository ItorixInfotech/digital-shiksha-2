import RichText from "@/components/RichText";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Building2, IndianRupee, MapPin, TrendingUp, Trophy } from "lucide-react";
import CollegeCard from "@/components/CollegeCard";
import EnquiryForm from "@/components/EnquiryForm";
import FaqSection from "@/components/FaqSection";
import ExamPredictorBox from "@/components/ExamPredictorBox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/Common";
import { NotFound } from "@/pages/Consultation";
import { Seo } from "@/components/Seo";
import { apiGet, ApiError } from "@/lib/api";
import { absUrl, breadcrumbLd, faqLd } from "@/lib/seo";
import { formatINR } from "@/lib/site";
import type { LandingLink, LandingPage } from "@/lib/types";

function Links({ title, links, testid }: { title: string; links: LandingLink[]; testid: string }) {
  if (!links.length) return null;
  return (
    <div data-testid={testid}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.slug} to={`/${l.slug}`} data-testid={`${testid}-${l.slug}`}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 hover:-translate-y-px hover:border-brand-red hover:text-brand-leaf transition-[transform,color,border-color]">
            {l.label} <span className="text-xs text-slate-400">({l.count})</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { landing = "" } = useParams();
  const q = useQuery({ queryKey: ["landing", landing], queryFn: () => apiGet<LandingPage>(`/landing/${landing}`), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });

  if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
  if (q.isLoading) return <div className="mx-auto max-w-7xl px-4 py-16"><div className="grid gap-5 md:grid-cols-2"><CardSkeleton count={4} /></div></div>;
  if (!q.data) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="This page is unavailable right now" body="Please try again shortly." /></div>;

  const p = q.data;
  const title = p.seo.meta_title || p.default_title;
  const description = p.seo.meta_description || p.default_description;
  const listLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: p.h1, numberOfItems: p.colleges.length,
    itemListElement: p.colleges.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: absUrl(`/colleges/${c.slug}`) })),
  };
  const stats = [
    { icon: Building2, label: "Colleges", value: String(p.stats.count), testid: "landing-stat-count" },
    { icon: IndianRupee, label: "Average fees / yr", value: formatINR(p.stats.avg_fees), testid: "landing-stat-avg-fees" },
    { icon: TrendingUp, label: "Average package", value: p.stats.avg_package ? `₹${p.stats.avg_package} LPA` : "—", testid: "landing-stat-avg-package" },
    { icon: Trophy, label: "Top package", value: p.stats.top_package ? `₹${p.stats.top_package} LPA` : "—", testid: "landing-stat-top-package" },
  ];

  return (
    <div data-testid="landing-page">
      <Seo title={title} description={description} keywords={p.seo.keywords.length ? p.seo.keywords : [p.label, `best ${p.label.toLowerCase()} ${p.year}`, `${p.stream} colleges ${p.city} fees`]}
        canonical={p.seo.canonical_url || `/${p.slug}`} image={p.seo.og_image || p.colleges[0]?.image} noindex={p.seo.noindex}
        jsonLd={[listLd, breadcrumbLd([["Home", "/"], ["Colleges", "/colleges"], [p.label, `/${p.slug}`]]), ...(p.faqs.length ? [faqLd(p.faqs)] : [])]} />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Colleges", to: "/colleges" }, { label: p.label }]} testid="landing-header"
        title={<span data-testid="landing-title">{p.h1}</span>}
        subtitle={<span className="flex items-center gap-1.5"><MapPin className="size-4" /> {p.city} · {p.stream} · Updated for {p.year} admissions</span>}>
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.3 }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md" data-testid={s.testid}>
              <s.icon className="size-4 text-brand-leaf-soft" />
              <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="space-y-8 lg:col-span-8">
          <section className="rounded-2xl border-l-4 border-brand-teal bg-white p-6 shadow-sm" data-testid="landing-intro">
            <RichText value={p.intro} testid="landing-intro-content" />
            {p.stats.exams.length > 0 && <p className="mt-4 text-sm text-slate-500">Popular entrance exams: <span className="font-medium text-slate-800">{p.stats.exams.join(" · ")}</span></p>}
          </section>

          {p.predictor_exam && <ExamPredictorBox examName={p.predictor_exam} city={p.city} testid="landing-predictor" />}

          {p.cutoff_table.length > 0 && (
            <section className="rounded-2xl border bg-white p-6 shadow-sm" data-testid="landing-cutoff-table">
              <h2 className="text-xl font-semibold">KCET cut-off for engineering colleges in {p.city}</h2>
              <p className="mt-1 text-sm text-slate-500">Official KEA 2025 Round I closing ranks, General Merit: Computer Science where offered, otherwise the most competitive branch. Lower rank = harder to get.</p>
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>College</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Closing rank (GM)</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {p.cutoff_table.map((r, i) => (
                      <TableRow key={`${r.college}-${r.branch}`} data-testid={`landing-cutoff-row-${i + 1}`}>
                        <TableCell className="text-slate-400">{i + 1}</TableCell>
                        <TableCell className="min-w-48 font-medium">{r.slug ? <Link to={`/colleges/${r.slug}`} className="hover:text-brand-leaf transition-colors" data-testid={`landing-cutoff-link-${r.slug}`}>{r.college}</Link> : r.college}</TableCell>
                        <TableCell className="min-w-40 text-slate-600">{r.branch}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{r.closing_rank.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-slate-400" data-testid="landing-cutoff-source">Source: {p.cutoff_source}</p>
            </section>
          )}

          <section data-testid="landing-colleges">
            <h2 className="text-xl font-semibold">{p.colleges.length} {p.label} — ranked</h2>
            <div className="mt-4 grid gap-5">
              {p.colleges.map((c, i) => (
                <div key={c.id} className="relative">
                  <span className="absolute -left-2 -top-2 z-10 grid size-7 place-items-center rounded-full bg-brand-red text-xs font-bold text-white shadow" data-testid={`landing-rank-${i + 1}`}>{i + 1}</span>
                  <CollegeCard c={c} layout="row" />
                </div>
              ))}
            </div>
          </section>

          <FaqSection faqs={p.faqs} title={`FAQs: ${p.label}`} testid="landing-faq" />

          <section className="grid gap-6 rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
            <Links title={`Other streams in ${p.city}`} links={p.same_city} testid="landing-links-city" />
            <Links title={`${p.stream === "Management" ? "MBA" : p.stream} colleges in other cities`} links={p.same_stream} testid="landing-links-stream" />
          </section>
        </div>
        <aside className="lg:col-span-4">
          <div className="sticky top-32 rounded-2xl border bg-white p-6 shadow-sm" data-testid="landing-lead-panel">
            <h2 className="text-lg font-semibold">Get free admission guidance</h2>
            <p className="mt-1 text-sm text-slate-500">Confused between {p.label.toLowerCase()}? Our counsellors will help you shortlist.</p>
            <div className="mt-4"><EnquiryForm testid="landing-lead" prefill={{ source: `landing-${p.slug}` }} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
