import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { SITE } from "@/lib/site";
import { absUrl, defaultSeo, entityLd, type SeoKind } from "@/lib/seo";
import type { SeoMeta, SeoPages } from "@/lib/types";

export const useSeoPages = () => useQuery({ queryKey: ["seo", "pages"], queryFn: () => apiGet<SeoPages>("/seo/pages"), staleTime: 5 * 60_000 });
const fallbackYear = () => new Date().getFullYear(); // only until /seo/pages (server date) has loaded

interface SeoProps {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  jsonLd?: object[];
}

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!value) { el?.remove(); return; }
  if (!el) { el = create(); el.dataset.seo = "1"; document.head.appendChild(el); }
  el.setAttribute(attr, value);
}
const meta = (key: "name" | "property", k: string, v: string) =>
  upsert(`meta[${key}="${k}"]`, () => { const m = document.createElement("meta"); m.setAttribute(key, k); return m; }, "content", v);

/** Writes title, meta, Open Graph, canonical and JSON-LD into <head> (Google renders JS, so these are indexed). */
export function Seo({ title, description, keywords = [], canonical, image, noindex, type = "website", jsonLd = [] }: SeoProps) {
  const { pathname } = useLocation();
  const ld = JSON.stringify(jsonLd);
  const kw = keywords.join(", ");
  useEffect(() => {
    const url = absUrl(canonical || pathname);
    const img = absUrl(image || SITE.logo);
    document.title = title;
    meta("name", "description", description);
    meta("name", "keywords", kw);
    meta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    meta("property", "og:site_name", SITE.name);
    meta("property", "og:type", type);
    meta("property", "og:title", title);
    meta("property", "og:description", description);
    meta("property", "og:url", url);
    meta("property", "og:image", img);
    meta("property", "og:locale", "en_IN");
    meta("name", "twitter:card", "summary_large_image");
    meta("name", "twitter:title", title);
    meta("name", "twitter:description", description);
    meta("name", "twitter:image", img);
    upsert('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l; }, "href", noindex ? "" : url);
    document.head.querySelectorAll('script[data-seo-ld]').forEach((s) => s.remove());
    for (const obj of JSON.parse(ld) as object[]) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.seoLd = "1";
      s.textContent = JSON.stringify(obj);
      document.head.appendChild(s);
    }
  }, [title, description, kw, canonical, image, noindex, type, ld, pathname]);
  return null;
}

/** Static pages (Home, Colleges list, …): admin overrides from SEO → Pages, else server defaults. */
export function PageSeo({ page, jsonLd }: { page: string; jsonLd?: object[] }) {
  const { data } = useSeoPages();
  const p = data?.pages.find((x) => x.key === page);
  if (!p) return <Seo title={`${SITE.name} | Colleges, Courses, Exams & Admission Counselling`} description="India's trusted admission consultant in Pune & Mumbai." jsonLd={jsonLd} />;
  return <Seo title={p.meta_title || p.default_title} description={p.meta_description || p.default_description} image={p.og_image} noindex={p.noindex} canonical={p.path} jsonLd={jsonLd} />;
}

/** Detail pages: per-record SEO overrides, else auto-generated defaults + schema.org JSON-LD. */
export function EntitySeo({ kind, item }: { kind: SeoKind; item: object & { seo?: SeoMeta; slug: string; image?: string } }) {
  const { data } = useSeoPages();
  const d = defaultSeo(kind, item, data?.year ?? fallbackYear());
  const s = item.seo;
  const description = s?.meta_description || d.description;
  return (
    <Seo title={s?.meta_title || d.title} description={description} keywords={s?.keywords.length ? s.keywords : d.keywords}
      canonical={s?.canonical_url || undefined} image={s?.og_image || item.image} noindex={s?.noindex}
      type={kind === "articles" ? "article" : "website"} jsonLd={entityLd(kind, item, description)} />
  );
}
