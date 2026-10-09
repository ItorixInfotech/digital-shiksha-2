import { SITE } from "@/lib/site";
import type { FaqItem, SeoMeta } from "@/lib/types";

export type SeoKind = "colleges" | "courses" | "exams" | "articles";
export const EMPTY_SEO: SeoMeta = { meta_title: "", meta_description: "", keywords: [], canonical_url: "", og_image: "", noindex: false };
export const TITLE_MAX = 60;
export const DESC_MAX = 160;
export const PATH: Record<SeoKind, string> = { colleges: "/colleges", courses: "/courses", exams: "/exams", articles: "/news" };
const SECTION: Record<SeoKind, string> = { colleges: "Colleges", courses: "Courses", exams: "Exams", articles: "News" };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : str(v).split(",")).map((x) => x.trim()).filter(Boolean);
export const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const firstSentence = (s: string) => str(s).split(/(?<=\.)\s/)[0] ?? "";

/** Auto-generated title/description used whenever the admin leaves the SEO field empty. Accepts API rows or admin form state. */
export function defaultSeo(kind: SeoKind, raw: object, year: number): { title: string; description: string; keywords: string[] } {
  const r = raw as Record<string, unknown>;
  if (kind === "colleges") {
    const name = str(r.name), short = str(r.short_name) || name, city = str(r.city);
    const exams = list(r.exams_accepted).slice(0, 3).join(", ");
    const parts = [`${name}${city ? `, ${city}` : ""}: courses & fees${exams ? `, ${exams} cutoff` : ""}`,
      Number(r.avg_package) ? `placements (avg ₹${str(r.avg_package)} LPA)` : "placements",
      Number(r.nirf_rank) ? `NIRF rank ${str(r.nirf_rank)}` : "", `admission ${year}`].filter(Boolean);
    return {
      title: `${short}${city && !short.includes(city) ? ` ${city}` : ""}: Fees, Cutoff, Placements ${year} | ${SITE.name}`,
      description: clip(`${parts.join(", ")}. Free counselling: ${SITE.phone}.`, DESC_MAX),
      keywords: [`${short} fees`, `${short} cutoff ${year}`, `${short} placements`, `${short} admission`, city && `colleges in ${city}`].filter(Boolean) as string[],
    };
  }
  if (kind === "courses") {
    const name = str(r.name), full = str(r.full_name);
    return {
      title: `${name}${full && full !== name ? ` (${full})` : ""}: Fees, Eligibility, Colleges ${year} | ${SITE.name}`,
      description: clip(firstSentence(str(r.overview)) || `${full || name} course details — duration ${str(r.duration) || "-"}, fees ${str(r.avg_fees) || "-"}, eligibility, entrance exams, top colleges and career scope in India.`, DESC_MAX),
      keywords: [`${name} course`, `${name} fees`, `${name} eligibility`, `${name} colleges`, `${name} admission ${year}`],
    };
  }
  if (kind === "exams") {
    const name = str(r.name), full = str(r.full_name);
    return {
      title: `${name} ${year}: Exam Date, Eligibility, Syllabus, Cutoff | ${SITE.name}`,
      description: clip(`${full || name} ${year}${str(r.exam_date) ? ` on ${str(r.exam_date)}` : ""} — application dates, eligibility, syllabus, pattern, cutoff and colleges accepting ${name}.`, DESC_MAX),
      keywords: [`${name} ${year}`, `${name} exam date`, `${name} syllabus`, `${name} eligibility`, `${name} cutoff`],
    };
  }
  return {
    title: `${clip(str(r.title), 48)} | ${SITE.name}`,
    description: clip(str(r.excerpt) || firstSentence(str(r.content)), DESC_MAX),
    keywords: list(r.tags),
  };
}

export const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
export const absUrl = (u: string) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${origin()}${u.startsWith("/") ? "" : "/"}${u}`);

export function breadcrumbLd(items: [string, string][]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absUrl(path) })),
  };
}

const publisher = () => ({ "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absUrl(SITE.logo) } });

export function organizationLd() {
  return {
    "@context": "https://schema.org", "@type": "EducationalOrganization", name: SITE.name, url: origin(), logo: absUrl(SITE.logo),
    telephone: "+918149689468", email: SITE.email, sameAs: [SITE.facebook, SITE.instagram],
    address: { "@type": "PostalAddress", streetAddress: "Saudamini Commercial Complex, C1-203, Paud Road, Bhusari Colony, Kothrud", addressLocality: "Pune", addressRegion: "Maharashtra", postalCode: "411038", addressCountry: "IN" },
  };
}

/** Page schema + breadcrumbs for a detail page. */
export function entityLd(kind: SeoKind, raw: object, description: string): object[] {
  const r = raw as Record<string, unknown>;
  const title = str(r.name) || str(r.title);
  const path = `${PATH[kind]}/${str(r.slug)}`;
  const crumbs = breadcrumbLd([["Home", "/"], [SECTION[kind], PATH[kind]], [title, path]]);
  let main: object | null = null;
  if (kind === "colleges") {
    main = {
      "@context": "https://schema.org", "@type": "CollegeOrUniversity", name: title, alternateName: str(r.short_name) || undefined, url: absUrl(path),
      image: str(r.image) || undefined, description, foundingDate: str(r.established) || undefined,
      address: { "@type": "PostalAddress", addressLocality: str(r.city), addressRegion: str(r.state), addressCountry: "IN" },
    };
  } else if (kind === "courses") {
    main = { "@context": "https://schema.org", "@type": "Course", name: str(r.full_name) || title, description, url: absUrl(path), provider: publisher(),
      educationalLevel: str(r.level) || undefined, timeRequired: str(r.duration) || undefined };
  } else if (kind === "articles") {
    const date = str(r.published_at);
    main = { "@context": "https://schema.org", "@type": "NewsArticle", headline: clip(title, 110), description, image: str(r.image) ? [str(r.image)] : undefined,
      datePublished: date || undefined, dateModified: date || undefined, author: { "@type": "Organization", name: str(r.author) || SITE.name }, publisher: publisher(),
      mainEntityOfPage: absUrl(path), keywords: list(r.tags).join(", ") || undefined };
  }
  const faqs = (r.faqs as FaqItem[] | undefined) ?? [];
  return [...(main ? [main] : []), crumbs, ...(faqs.length ? [faqLd(faqs)] : [])];
}

export function faqLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export type SeoCheckId = "title" | "description" | "keyword" | "image" | "content" | "faqs" | "index";
export interface SeoCheck { id: SeoCheckId; label: string; ok: boolean; fix: string }
export interface SeoScore { score: number; passed: number; level: "green" | "amber" | "red"; checks: SeoCheck[] }
export interface SeoScoreInput {
  title: string;
  description: string;
  keywords: string[];
  hasImage: boolean;
  bodyLength: number;
  faqCount: number | null; // null = FAQs not applicable (courses, articles)
  noindex: boolean;
}

/** Red/amber/green on-page SEO score from the effective (override or auto) values. */
export function seoScore(i: SeoScoreInput): SeoScore {
  const kw = (i.keywords[0] ?? "").toLowerCase();
  const checks: SeoCheck[] = [
    { id: "title", label: `Title length ${i.title.length} (30–${TITLE_MAX})`, ok: i.title.length >= 30 && i.title.length <= TITLE_MAX, fix: `Title is ${i.title.length} chars — keep it 30–${TITLE_MAX}` },
    { id: "description", label: `Description length ${i.description.length} (70–${DESC_MAX})`, ok: i.description.length >= 70 && i.description.length <= DESC_MAX, fix: `Description is ${i.description.length} chars — keep it 70–${DESC_MAX}` },
    { id: "keyword", label: `Focus keyword “${i.keywords[0] ?? ""}” used`, ok: !!kw && `${i.title} ${i.description}`.toLowerCase().includes(kw), fix: kw ? `Use the focus keyword “${i.keywords[0]}” in the title or description` : "Add a focus keyword" },
    { id: "image", label: "Social share image set", ok: i.hasImage, fix: "Add an OG / cover image" },
    { id: "content", label: "Content has 300+ characters", ok: i.bodyLength >= 300, fix: `Content is ${i.bodyLength} chars — write at least 300` },
    ...(i.faqCount === null ? [] : [{ id: "faqs" as const, label: `${i.faqCount} FAQ(s) added`, ok: i.faqCount > 0, fix: "Add FAQs for Google FAQ rich results" }]),
    { id: "index", label: "Indexable by Google", ok: !i.noindex, fix: "Page is set to noindex — Google won't show it" },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, passed, checks, level: score >= 80 ? "green" : score >= 50 ? "amber" : "red" };
}

/** Score for an admin content row (API record or form state). */
export function entityScore(kind: SeoKind, raw: object, year: number): SeoScore {
  const r = raw as Record<string, unknown>;
  const s = { ...EMPTY_SEO, ...(r.seo as Partial<SeoMeta> | undefined) };
  const d = defaultSeo(kind, r, year);
  return seoScore({
    title: s.meta_title || d.title, description: s.meta_description || d.description, keywords: s.keywords,
    hasImage: !!(s.og_image || str(r.image)), bodyLength: str(kind === "articles" ? r.content : r.overview).length,
    faqCount: kind === "colleges" || kind === "exams" ? ((r.faqs as unknown[] | undefined) ?? []).length : null, noindex: s.noindex,
  });
}

/** Minutes-ish effort per failing check — used to sort the SEO fix list quickest-first. */
export const FIX_EFFORT: Record<SeoCheckId, number> = { index: 1, keyword: 1, title: 2, description: 2, image: 2, faqs: 3, content: 4 };
export const SHORT_FIX: Record<SeoCheckId, string> = { index: "Remove noindex", keyword: "Focus keyword", title: "Title length", description: "Description length", image: "Share image", faqs: "Add FAQs", content: "300+ chars content" };
export const fixEffort = (s: SeoScore) => s.checks.filter((c) => !c.ok).reduce((n, c) => n + FIX_EFFORT[c.id], 0);
