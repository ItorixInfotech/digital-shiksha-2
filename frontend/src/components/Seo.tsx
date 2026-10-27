import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { SITE } from "@/lib/site";
import { absUrl, breadcrumbLd, clip, defaultSeo, DESC_MAX, entityLd, siteLd, TITLE_MAX, type SeoKind } from "@/lib/seo";
import type { PageOverride, SeoMeta, SeoPages, SiteSchema } from "@/lib/types";

export const useSeoPages = () => useQuery({ queryKey: ["seo", "pages"], queryFn: () => apiGet<SeoPages>("/seo/pages"), staleTime: 5 * 60_000 });
export const useSiteSchema = () => useQuery({ queryKey: ["site-schema"], queryFn: () => apiGet<SiteSchema>("/site-schema"), staleTime: 10 * 60_000 });
const SITE_TYPES = new Set(["Organization", "LocalBusiness"]);
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

const normPath = (p: string) => "/" + p.replace(/^\/+|\/+$/g, "");
/** Admin → Pages & Schema override for the current URL (null when none). */
export function usePageOverride() {
  const { pathname } = useLocation();
  const path = normPath(pathname);
  return useQuery({ queryKey: ["page-seo", path], queryFn: () => apiGet<PageOverride | null>(`/page-seo?path=${encodeURIComponent(path)}`), staleTime: 5 * 60_000 }).data ?? null;
}
/** The page's H1: admin override when set, else the page's own heading. */
export function useH1(fallback: string): string {
  return usePageOverride()?.h1 || fallback;
}
/** Automatic titles: drop the " | Digital Shiksha" suffix when it would push the title past 60 characters (Google cuts it). */
const fitTitle = (t: string) => {
  const suffix = ` | ${SITE.name}`;
  if (t.length <= TITLE_MAX) return t;
  const main = t.endsWith(suffix) ? t.slice(0, -suffix.length) : t;
  return main.length <= TITLE_MAX ? main : clip(main, TITLE_MAX);
};
const ldType = (o: object) => { const t = String((o as { "@type"?: unknown })["@type"] ?? ""); return t === "EducationalOrganization" ? "Organization" : t; }; // one org block, never two

/** Writes title, meta, Open Graph, canonical and JSON-LD into <head> (Google renders JS, so these are indexed).
 *  Any field set in Admin → Pages & Schema for this URL wins; custom schema blocks replace auto blocks of the same type. */
export function Seo(props: SeoProps) {
  const { pathname } = useLocation();
  const o = usePageOverride();
  const site = useSiteSchema().data;
  const custom: object[] = [];
  for (const b of o?.schemas ?? []) {
    if (!b.enabled) continue;
    try { custom.push(JSON.parse(b.json_text) as object); } catch { /* validated on save */ }
  }
  const noindex = Boolean(o?.noindex || props.noindex);
  // Site-wide Organization/LocalBusiness replace any page-level block of those types; a custom page block still wins over them.
  const siteBlocks = site && !noindex ? siteLd(site) : [];
  const auto = [...(siteBlocks.length ? (props.jsonLd ?? []).filter((x) => !SITE_TYPES.has(ldType(x))) : props.jsonLd ?? []), ...siteBlocks];
  const types = new Set(custom.map(ldType));
  const jsonLd = [...(o?.replace_auto_schema === false ? auto : auto.filter((x) => !types.has(ldType(x)))), ...custom];
  const title = o?.meta_title || fitTitle(props.title);
  const description = o?.meta_description || clip(props.description, DESC_MAX);
  const keywords = o?.keywords.length ? o.keywords : props.keywords ?? [];
  const canonical = o?.canonical_url || props.canonical;
  const image = o?.og_image || props.image;
  const type = props.type ?? "website";
  const ld = JSON.stringify(jsonLd);
  const kw = keywords.join(", ");
  useEffect(() => {
    const url = absUrl(canonical || normPath(pathname));
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
export function PageSeo({ page, jsonLd: given }: { page: string; jsonLd?: object[] }) {
  const { data } = useSeoPages();
  const p = data?.pages.find((x) => x.key === page);
  // Every main page carries BreadcrumbList schema; pages that pass their own JSON-LD keep it.
  const jsonLd = given ?? (p && p.path !== "/" ? [breadcrumbLd([["Home", "/"], [p.label, p.path]])] : undefined);
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
