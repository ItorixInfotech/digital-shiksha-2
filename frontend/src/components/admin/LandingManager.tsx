import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SeoEditor, { type SeoForm } from "@/components/admin/SeoEditor";
import SeoBadge from "@/components/admin/SeoBadge";
import FaqEditor, { cleanFaqs } from "@/components/admin/FaqEditor";
import { apiGet, apiPut } from "@/lib/api";
import { EMPTY_SEO, seoScore } from "@/lib/seo";
import type { FaqItem, LandingOverrideIn, LandingSummary, SeoMeta } from "@/lib/types";

const toSeoForm = (s?: SeoMeta): SeoForm => { const v = { ...EMPTY_SEO, ...s }; return { ...v, keywords: v.keywords.join(", ") }; };

export const landingScore = (l: LandingSummary) => {
  const o = l.override;
  return seoScore({
    title: o?.seo.meta_title || l.default_title, description: o?.seo.meta_description || l.default_description,
    // Auto intro (300+ chars), auto FAQs and the top college's photo fill in whatever the admin leaves empty.
    keywords: o?.seo.keywords.length ? o.seo.keywords : [l.label], hasImage: true, bodyLength: o?.intro ? o.intro.length : 300, faqCount: o?.faqs.length || 5, noindex: !!o?.seo.noindex,
  });
};

export default function LandingManager({ editSlug, onClose }: { editSlug?: string; onClose?: () => void } = {}) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["landing", "list"], queryFn: () => apiGet<LandingSummary[]>("/landing") });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<LandingSummary | null>(null);
  const [intro, setIntro] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [seo, setSeo] = useState<SeoForm>(toSeoForm());

  const save = useMutation({
    mutationFn: (body: LandingOverrideIn) => apiPut<LandingSummary>(`/admin/landing/${editing!.slug}`, body),
    onSuccess: () => { toast.success("City page saved"); close(); qc.invalidateQueries({ queryKey: ["landing"] }); },
    onError: () => toast.error("Save failed — check field lengths"),
  });
  const open = (l: LandingSummary) => { setEditing(l); setIntro(l.override?.intro ?? ""); setFaqs(l.override?.faqs ?? []); setSeo(toSeoForm(l.override?.seo)); };
  const submit = () => save.mutate({
    intro: intro.trim(), faqs: cleanFaqs(faqs),
    seo: { meta_title: seo.meta_title.trim(), meta_description: seo.meta_description.trim(), canonical_url: seo.canonical_url.trim(), og_image: seo.og_image.trim(), noindex: seo.noindex, keywords: seo.keywords.split(",").map((x) => x.trim()).filter(Boolean) },
  });
  const close = () => { setEditing(null); onClose?.(); };
  const target = editSlug ? list.data?.find((l) => l.slug === editSlug) : undefined;
  useEffect(() => { if (target) open(target); }, [target?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => (list.data ?? []).filter((l) => !q || l.label.toLowerCase().includes(q.toLowerCase())), [list.data, q]);

  const dialog = (
    <Dialog open={!!editing} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="admin-landing-dialog">
        <DialogHeader><DialogTitle>Edit “{editing?.label}”</DialogTitle></DialogHeader>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="landing-intro">Intro paragraph</Label>
              <Textarea id="landing-intro" rows={5} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Leave empty to use the auto-generated intro (with live fees, placements and exams). Separate paragraphs with a blank line." data-testid="admin-landing-intro-input" />
            </div>
            <FaqEditor value={faqs} onChange={setFaqs} testid="admin-landing-faqs" hint="Leave empty to use 5–6 auto FAQs built from the college data" />
            <SeoEditor value={seo} onChange={setSeo} defaults={{ title: editing.default_title, description: editing.default_description, keywords: [editing.label] }} path={`/${editing.slug}`} testid="admin-landing-seo" />
            <DialogFooter className="sm:col-span-2">
              <Button variant="outline" onClick={close} data-testid="admin-landing-cancel-button">Cancel</Button>
              <Button onClick={submit} disabled={save.isPending} className="bg-brand-navy text-white hover:bg-brand-blue" data-testid="admin-landing-save-button">{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
  if (editSlug) return dialog;

  return (
    <div data-testid="admin-landing-manager">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">City pages <span className="text-sm font-normal text-slate-500">({list.data?.length ?? 0})</span></h2>
          <p className="mt-1 text-sm text-slate-500">Auto-created for every stream × city that has colleges. Edit intro, FAQs and SEO — empty fields use smart defaults.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border bg-white px-2.5">
          <Search className="size-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className="h-9 w-48 bg-transparent text-sm outline-none" data-testid="admin-landing-search-input" />
        </div>
      </div>
      <div className="mt-4 rounded-2xl border bg-white">
        <Table data-testid="admin-landing-table">
          <TableHeader><TableRow><TableHead>Page</TableHead><TableHead>Colleges</TableHead><TableHead>Status</TableHead><TableHead>SEO</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={5} className="text-slate-500">Loading…</TableCell></TableRow>}
            {rows.map((l) => (
              <TableRow key={l.slug} data-testid={`admin-landing-row-${l.slug}`}>
                <TableCell><a href={`/${l.slug}`} target="_blank" rel="noreferrer" className="font-medium hover:text-brand-red">{l.label}</a><p className="text-xs text-slate-400">/{l.slug}</p></TableCell>
                <TableCell className="text-slate-600">{l.count}</TableCell>
                <TableCell className="text-xs">{l.customised ? <span className="rounded-md bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">Customised</span> : <span className="text-slate-400">Auto</span>}</TableCell>
                <TableCell><SeoBadge score={landingScore(l)} testid={`admin-landing-seo-score-${l.slug}`} /></TableCell>
                <TableCell><Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => open(l)} data-testid={`admin-landing-edit-${l.slug}`}><Pencil className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dialog}
    </div>
  );
}
