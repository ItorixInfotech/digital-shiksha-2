import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, UserRound } from "lucide-react";
import EnquiryForm from "@/components/EnquiryForm";
import { EmptyState, PageHeader } from "@/components/Common";
import { apiGet } from "@/lib/api";
import type { Article } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EntitySeo, PageSeo } from "@/components/Seo";

const CATS = ["", "Admission", "Exam", "College", "Career"];
const fmt = (d: string) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export function News() {
  const [sp, setSp] = useSearchParams();
  const cat = sp.get("category") ?? "";
  const { data, isLoading, isError } = useQuery({ queryKey: ["articles", ""], queryFn: () => apiGet<Article[]>("/articles") });
  const list = (data ?? []).filter((a) => !cat || a.category === cat);
  const [lead, ...rest] = list;

  return (
    <div data-testid="news-page">
      <PageSeo page="news" />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "News" }]} title="Education News & Articles" subtitle="Admission alerts, exam updates, cutoff analysis and career guidance from Digital Shiksha experts." testid="news-header" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => <button key={c || "all"} type="button" onClick={() => setSp(c ? { category: c } : {}, { replace: true })} data-testid={`news-category-${c ? c.toLowerCase() : "all"}`} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-colors", cat === c ? "border-brand-navy bg-brand-navy text-white" : "bg-white text-slate-700 hover:border-slate-400")}>{c || "All"}</button>)}
        </div>
        {isLoading ? <p className="mt-8 text-slate-500">Loading articles…</p>
          : isError ? <div className="mt-8"><EmptyState title="News is unavailable right now" /></div>
          : !lead ? <div className="mt-8"><EmptyState title="No articles in this category yet" testid="news-empty" /></div>
          : (
            <>
              <Link to={`/news/${lead.slug}`} data-testid={`news-article-${lead.slug}`} className="group mt-8 grid overflow-hidden rounded-2xl border bg-white lg:grid-cols-2">
                <img src={lead.image} alt="" className="h-64 w-full object-cover lg:h-full" />
                <div className="p-6 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-red">{lead.category}</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 group-hover:text-brand-red transition-colors sm:text-3xl">{lead.title}</h2>
                  <p className="mt-3 text-slate-600">{lead.excerpt}</p>
                  <p className="mt-5 text-sm text-slate-500">{lead.author} • {fmt(lead.published_at)}</p>
                </div>
              </Link>
              <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <Link key={a.id} to={`/news/${a.slug}`} data-testid={`news-article-${a.slug}`} className="group overflow-hidden rounded-2xl border bg-white hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow]">
                    <img src={a.image} alt="" loading="lazy" className="h-44 w-full object-cover" />
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-red">{a.category}</p>
                      <h3 className="mt-2 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-red transition-colors">{a.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{a.excerpt}</p>
                      <p className="mt-3 text-xs text-slate-400">{fmt(a.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  );
}

export function ArticleDetail() {
  const { slug = "" } = useParams();
  const { data: a, isLoading, isError } = useQuery({ queryKey: ["article", slug], queryFn: () => apiGet<Article>(`/articles/${slug}`) });
  const all = useQuery({ queryKey: ["articles", ""], queryFn: () => apiGet<Article[]>("/articles") });

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-20"><div className="h-48 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (isError || !a) return <div className="mx-auto max-w-3xl px-4 py-20"><EmptyState title="Article not found" testid="article-not-found" /><p className="mt-4 text-center"><Link to="/news" className="font-semibold text-brand-red">All news →</Link></p></div>;
  const related = (all.data ?? []).filter((x) => x.slug !== a.slug).slice(0, 3);

  return (
    <div data-testid="article-page">
      <EntitySeo kind="articles" item={a} />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "News", to: "/news" }, { label: a.category }]} title={a.title} testid="article-header">
        <div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-300">
          <span className="flex items-center gap-1.5"><UserRound className="size-4" /> {a.author}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> {fmt(a.published_at)}</span>
        </div>
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <article className="lg:col-span-8">
          {a.image && <img src={a.image} alt="" className="h-72 w-full rounded-2xl object-cover sm:h-96" />}
          <p className="mt-8 text-lg font-medium leading-relaxed text-slate-800">{a.excerpt}</p>
          <div className="mt-6 space-y-5 text-[17px] leading-[1.75] text-slate-700" data-testid="article-content">
            {a.content.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{a.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">#{t}</span>)}</div>
        </article>
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Free expert counselling</h3>
            <p className="mt-1 text-sm text-slate-500">Have questions about this update? Ask us.</p>
            <div className="mt-4"><EnquiryForm testid="article-lead" prefill={{ source: `article-${a.slug}` }} /></div>
          </div>
          {related.length > 0 && (
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="font-semibold">Related articles</h3>
              <ul className="mt-3 space-y-3">{related.map((r) => <li key={r.id}><Link to={`/news/${r.slug}`} data-testid={`related-article-${r.slug}`} className="text-sm font-medium text-slate-700 hover:text-brand-red transition-colors">{r.title}</Link></li>)}</ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
