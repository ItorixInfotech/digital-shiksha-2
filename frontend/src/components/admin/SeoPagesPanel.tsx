import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileCode2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeoEditor, { type SeoForm } from "@/components/admin/SeoEditor";
import { useSeoPages } from "@/components/Seo";
import { apiPut } from "@/lib/api";
import type { PageSeo, SeoPages, SeoPagesIn } from "@/lib/types";
import { cn } from "@/lib/utils";

const toForm = (p: PageSeo): SeoForm => ({ meta_title: p.meta_title, meta_description: p.meta_description, keywords: "", canonical_url: "", og_image: p.og_image, noindex: p.noindex });

export default function SeoPagesPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useSeoPages();
  const [sel, setSel] = useState("home");
  const [drafts, setDrafts] = useState<Record<string, SeoForm>>({});
  const save = useMutation({
    mutationFn: (body: SeoPagesIn) => apiPut<SeoPages>("/admin/seo/pages", body),
    onSuccess: (d) => { qc.setQueryData(["seo", "pages"], d); setDrafts({}); toast.success("Page SEO saved"); },
    onError: () => toast.error("Could not save — check field lengths"),
  });

  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;
  const page = data.pages.find((p) => p.key === sel) ?? data.pages[0];
  const form = drafts[page.key] ?? toForm(page);
  const dirty = Object.keys(drafts).length > 0;
  const submit = () => save.mutate({
    pages: data.pages.map((p) => {
      const f = drafts[p.key] ?? toForm(p);
      return { key: p.key, meta_title: f.meta_title.trim(), meta_description: f.meta_description.trim(), og_image: f.og_image.trim(), noindex: f.noindex };
    }),
  });

  return (
    <div data-testid="admin-seo-pages-panel">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">SEO → Pages</h2>
          <p className="mt-1 text-sm text-slate-500">Meta title, description and share image for the main website pages. College, course, exam and article SEO is edited inside each record.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:text-brand-red" data-testid="admin-seo-sitemap-link"><FileCode2 className="size-4" /> sitemap.xml <ExternalLink className="size-3" /></a>
          <a href="/robots.txt" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:text-brand-red" data-testid="admin-seo-robots-link">robots.txt <ExternalLink className="size-3" /></a>
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-white p-2 lg:flex-col">
          {data.pages.map((p) => (
            <button key={p.key} type="button" onClick={() => setSel(p.key)} data-testid={`admin-seo-page-${p.key}`}
              className={cn("flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors", p.key === page.key ? "bg-brand-navy text-white" : "text-slate-700 hover:bg-slate-100")}>
              <span>{p.label}</span>
              {(p.meta_title || p.meta_description || drafts[p.key]) && <span className={cn("size-1.5 rounded-full", drafts[p.key] ? "bg-amber-400" : "bg-green-500")} />}
            </button>
          ))}
        </nav>
        <div className="grid gap-4">
          <SeoEditor key={page.key} value={form} onChange={(v) => setDrafts((d) => ({ ...d, [page.key]: v }))} defaults={{ title: page.default_title, description: page.default_description }} path={page.path} testid="admin-seo-page-editor" advanced={false} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!dirty || save.isPending} className="bg-brand-red text-white hover:bg-red-700" data-testid="admin-seo-pages-save-button">
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Save page SEO
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
