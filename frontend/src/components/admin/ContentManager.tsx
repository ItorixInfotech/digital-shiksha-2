import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CloudCheck, History, Pencil, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "@/components/admin/ImageUploadField";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import { slugify } from "@/lib/site";
import SeoEditor, { type SeoForm } from "@/components/admin/SeoEditor";
import { useSeoPages } from "@/components/Seo";
import SeoBadge from "@/components/admin/SeoBadge";
import FaqEditor, { cleanFaqs } from "@/components/admin/FaqEditor";
import { defaultSeo, EMPTY_SEO, entityScore } from "@/lib/seo";
import type { FaqItem, SeoMeta } from "@/lib/types";
import { clearDraft, draftIds, draftKey, loadDraft, saveDraft, timeAgo, type Draft } from "@/lib/drafts";

const toSeoForm = (s?: SeoMeta): SeoForm => { const v = { ...EMPTY_SEO, ...s }; return { ...v, keywords: v.keywords.join(", ") }; };
const fromSeoForm = (f: SeoForm): SeoMeta => ({
  meta_title: f.meta_title.trim(), meta_description: f.meta_description.trim(), canonical_url: f.canonical_url.trim(), og_image: f.og_image.trim(), noindex: f.noindex,
  keywords: f.keywords.split(",").map((x) => x.trim()).filter(Boolean),
});

export type FieldType = "text" | "number" | "textarea" | "richtext" | "list" | "json" | "bool" | "image";
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  full?: boolean;
  hint?: string;
}

type Row = { id: string; slug: string } & Record<string, unknown>;
type FormState = Record<string, string | boolean>;
type DraftData = { form: FormState; seo: SeoForm; faqs: FaqItem[] };

interface Props {
  resource: "colleges" | "courses" | "exams" | "articles";
  title: string;
  fields: FieldSpec[];
  columns: { key: string; label: string }[];
  publicPath: string;
  faqs?: boolean;
  /** Render only the edit dialog for this slug (used by the SEO fix list); onClose fires after save or cancel. */
  editSlug?: string;
  onClose?: () => void;
}

function toForm(fields: FieldSpec[], row?: Row): FormState {
  const f: FormState = {};
  for (const s of fields) {
    const v = row?.[s.key];
    if (s.type === "bool") f[s.key] = Boolean(v);
    else if (s.type === "list") f[s.key] = Array.isArray(v) ? v.join(", ") : "";
    else if (s.type === "json") f[s.key] = JSON.stringify(v ?? [], null, 2);
    else f[s.key] = v === null || v === undefined ? "" : String(v);
  }
  return f;
}

function toPayload(fields: FieldSpec[], f: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of fields) {
    const v = f[s.key];
    if (s.type === "bool") out[s.key] = Boolean(v);
    else if (s.type === "list") out[s.key] = String(v).split(",").map((x) => x.trim()).filter(Boolean);
    else if (s.type === "json") out[s.key] = JSON.parse(String(v) || "[]");
    else if (s.type === "number") out[s.key] = String(v).trim() === "" ? null : Number(v);
    else out[s.key] = String(v);
  }
  return out;
}

export default function ContentManager({ resource, title, fields, columns, publicPath, faqs: withFaqs = false, editSlug, onClose }: Props) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null | undefined>(undefined); // undefined = closed, null = new
  const [form, setForm] = useState<FormState>({});
  const [seo, setSeo] = useState<SeoForm>(toSeoForm());
  const seoPages = useSeoPages();
  const year = seoPages.data?.year ?? new Date().getFullYear();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [confirmDel, setConfirmDel] = useState<Row | null>(null);
  // Draft autosave: unsaved edits are kept in this browser until saved or discarded.
  const [pendingDraft, setPendingDraft] = useState<Draft<DraftData> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [formVersion, setFormVersion] = useState(0); // bump to remount editors after restoring a draft
  const baseline = useRef("");
  const key = editing === undefined ? null : draftKey(resource, editing?.id ?? null);
  const snapshot = JSON.stringify({ form, seo, faqs });
  const dirty = key !== null && baseline.current !== "" && snapshot !== baseline.current;

  const list = useQuery({ queryKey: [resource, "admin"], queryFn: () => apiGet<Row[]>(`/${resource}${resource === "colleges" ? "?limit=500" : ""}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: [resource] }); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); qc.invalidateQueries({ queryKey: ["meta"] }); };

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (editing ? apiPut<Row>(`/admin/${resource}/${editing.id}`, body) : apiPost<Row>(`/admin/${resource}`, body)),
    onSuccess: () => { toast.success(editing ? "Saved changes" : "Created"); if (key) clearDraft(key); close(false); invalidate(); },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 409 ? "That slug is already used" : e instanceof ApiError && e.status === 422 ? "Some fields are invalid — check numbers and JSON" : "Save failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/${resource}/${id}`),
    onSuccess: (_d, id) => { clearDraft(draftKey(resource, id)); toast.success("Deleted"); setConfirmDel(null); invalidate(); },
    onError: () => toast.error("Delete failed"),
  });

  const open = (row: Row | null) => {
    const base: DraftData = { form: toForm(fields, row ?? undefined), seo: toSeoForm(row?.seo as SeoMeta | undefined), faqs: (row?.faqs as FaqItem[] | undefined) ?? [] };
    setForm(base.form); setSeo(base.seo); setFaqs(base.faqs); setEditing(row);
    baseline.current = JSON.stringify(base);
    const k = draftKey(resource, row?.id ?? null);
    const d = loadDraft<DraftData>(k);
    if (d && JSON.stringify(d.data) === baseline.current) clearDraft(k);
    setPendingDraft(d && JSON.stringify(d.data) !== baseline.current ? d : null);
    setDraftSavedAt(null);
  };
  const restoreDraft = () => {
    if (!pendingDraft) return;
    setForm(pendingDraft.data.form); setSeo(pendingDraft.data.seo); setFaqs(pendingDraft.data.faqs);
    setFormVersion((v) => v + 1); setPendingDraft(null);
    toast.success("Draft restored — remember to Save");
  };
  const discardDraft = () => { if (key) clearDraft(key); setPendingDraft(null); toast("Draft discarded"); };

  // Autosave ~1s after the last change (paused while the restore/discard choice is pending).
  useEffect(() => {
    if (!key || pendingDraft || !dirty) return;
    const t = window.setTimeout(() => setDraftSavedAt(saveDraft<DraftData>(key, JSON.parse(snapshot) as DraftData)), 1000);
    return () => window.clearTimeout(t);
  }, [key, snapshot, dirty, pendingDraft]);
  // Closing the tab: save immediately and ask the browser to confirm.
  useEffect(() => {
    if (!key || !dirty || pendingDraft) return;
    const onUnload = (e: BeforeUnloadEvent) => { saveDraft<DraftData>(key, JSON.parse(snapshot) as DraftData); e.preventDefault(); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [key, snapshot, dirty, pendingDraft]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const s of fields) if (s.required && !String(form[s.key] ?? "").trim()) return toast.error(`${s.label} is required`);
    let body: Record<string, unknown>;
    try { body = toPayload(fields, form); } catch { return toast.error("Invalid JSON in one of the fields"); }
    save.mutate({ ...body, seo: fromSeoForm(seo), ...(withFaqs ? { faqs: cleanFaqs(faqs) } : {}) });
  };

  const close = (keepDraft = true) => {
    if (keepDraft && key && dirty && !pendingDraft) { saveDraft<DraftData>(key, JSON.parse(snapshot) as DraftData); toast("Unsaved changes kept as a draft", { description: "Open this record again to restore them." }); }
    baseline.current = ""; setPendingDraft(null); setEditing(undefined); onClose?.();
  };
  const target = editSlug ? list.data?.find((r) => r.slug === editSlug) : undefined;
  // Open the record requested via editSlug once (adjusting state during render instead of an effect with stale deps).
  const [openedId, setOpenedId] = useState<string>();
  if (target && openedId !== target.id) { setOpenedId(target.id); open(target); }

  const drafts = editing === undefined ? draftIds(resource) : new Set<string>(); // re-read whenever the dialog closes
  const rows = useMemo(() => (list.data ?? []).filter((r) => !q || JSON.stringify([r.name, r.title, r.slug]).toLowerCase().includes(q.toLowerCase())), [list.data, q]);

  const dialog = (
    <Dialog open={editing !== undefined} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid={`admin-${resource}-dialog`}>
        <DialogHeader><DialogTitle>{editing ? `Edit ${String(editing.name ?? editing.title ?? "")}` : `Add ${title.replace(/s$/, "")}`}</DialogTitle></DialogHeader>
        {pendingDraft && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid={`admin-${resource}-draft-banner`}>
            <History className="size-4 shrink-0" />
            <span className="flex-1">You have unsaved changes from <strong>{timeAgo(pendingDraft.savedAt)}</strong>.</span>
            <Button type="button" size="sm" onClick={restoreDraft} className="bg-amber-600 text-white hover:bg-amber-700" data-testid={`admin-${resource}-draft-restore`}>Restore draft</Button>
            <Button type="button" size="sm" variant="ghost" onClick={discardDraft} data-testid={`admin-${resource}-draft-discard`}>Discard</Button>
          </div>
        )}
        <form key={formVersion} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {fields.map((s) => {
            const id = `f-${resource}-${s.key}`;
            const tid = `admin-${resource}-field-${s.key.replace(/_/g, "-")}`;
            const val = form[s.key];
            if (s.type === "richtext") return (
              <div key={s.key} className="grid gap-1.5 sm:col-span-2">
                <Label>{s.label}{s.required ? " *" : ""}</Label>
                <RichTextEditor value={String(val ?? "")} onChange={(v) => setForm((f) => ({ ...f, [s.key]: v }))} testid={tid} />
                {s.hint && <p className="text-xs text-slate-500">{s.hint}</p>}
              </div>
            );
            if (s.type === "image") return (
              <div key={s.key} className="grid gap-1.5 sm:col-span-2">
                <Label>{s.label}</Label>
                <ImageUploadField value={String(val ?? "")} onChange={(v) => setForm((f) => ({ ...f, [s.key]: v }))} testid={tid} />
                {s.hint && <p className="text-xs text-slate-500">{s.hint}</p>}
              </div>
            );
            if (s.type === "bool") return (
              <label key={s.key} className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={Boolean(val)} onCheckedChange={(c) => setForm((f) => ({ ...f, [s.key]: Boolean(c) }))} data-testid={tid} /> {s.label}</label>
            );
            const common = { id, value: String(val ?? ""), "data-testid": tid };
            const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              const v = e.target.value;
              setForm((f) => ({ ...f, [s.key]: v, ...(s.key === "name" || s.key === "title" ? (!editing && (!f.slug || f.slug === slugify(String(f[s.key] ?? ""))) ? { slug: slugify(v) } : {}) : {}) }));
            };
            return (
              <div key={s.key} className={`grid gap-1.5 ${s.full || s.type === "textarea" || s.type === "json" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={id}>{s.label}{s.required ? " *" : ""}</Label>
                {s.type === "textarea" || s.type === "json"
                  ? <Textarea {...common} onChange={onChange} rows={s.type === "json" ? 6 : 4} className={s.type === "json" ? "font-mono text-xs" : ""} />
                  : <Input {...common} onChange={onChange} type={s.type === "number" ? "number" : "text"} step="any" />}
                {(s.hint || s.type === "list") && <p className="text-xs text-slate-500">{s.hint ?? "Comma-separated"}</p>}
              </div>
            );
          })}
          {withFaqs && <FaqEditor value={faqs} onChange={setFaqs} testid={`admin-${resource}-faqs`} />}
          {editing !== undefined && (() => { const sc = entityScore(resource, { ...toPayload(fields.filter((f) => f.type !== "json"), form), seo: fromSeoForm(seo), faqs: cleanFaqs(faqs) }, year); return <div className="flex items-center gap-2 text-sm sm:col-span-2"><span className="font-medium">Live SEO score</span><SeoBadge score={sc} testid={`admin-${resource}-live-seo-score`} /></div>; })()}
          <SeoEditor value={seo} onChange={setSeo} defaults={defaultSeo(resource, form, year)}
            path={`${publicPath}/${String(form.slug ?? "")}`} testid={`admin-${resource}-seo`} />
          <DialogFooter className="items-center sm:col-span-2">
            {draftSavedAt && dirty && <span className="mr-auto flex items-center gap-1.5 text-xs text-slate-500" data-testid={`admin-${resource}-draft-status`}><CloudCheck className="size-3.5 text-brand-leaf" /> Draft saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            <Button type="button" variant="outline" onClick={() => close()} data-testid={`admin-${resource}-cancel-button`}>Cancel</Button>
            <Button type="submit" disabled={save.isPending} data-testid={`admin-${resource}-save-button`} className="bg-brand-navy text-white hover:bg-brand-blue">{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
  if (editSlug) return dialog;

  return (
    <div data-testid={`admin-${resource}-manager`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{title} <span className="text-sm font-normal text-slate-500">({list.data?.length ?? 0})</span></h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-2.5">
            <Search className="size-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-48 bg-transparent text-sm outline-none" data-testid={`admin-${resource}-search-input`} />
          </div>
          <Button onClick={() => open(null)} data-testid={`admin-${resource}-add-button`} className="bg-brand-red text-white hover:bg-red-700"><Plus className="size-4" /> {drafts.has("new") ? "Add new (draft)" : "Add new"}</Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-white">
        <Table data-testid={`admin-${resource}-table`}>
          <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}<TableHead>SEO</TableHead><TableHead className="w-28 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={columns.length + 2} className="text-slate-500">Loading…</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`admin-${resource}-row-${r.slug}`}>
                {columns.map((c, i) => (
                  <TableCell key={c.key} className={i === 0 ? "max-w-xs truncate font-medium" : "text-slate-600"}>
                    {i === 0 && drafts.has(r.id) && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800" title="Unsaved draft in this browser" data-testid={`admin-${resource}-draft-chip-${r.slug}`}>Draft</span>}
                    {i === 0 ? <a href={`${publicPath}/${r.slug}`} target="_blank" rel="noreferrer" className="hover:text-brand-leaf">{String(r[c.key] ?? "")}</a> : Array.isArray(r[c.key]) ? (r[c.key] as string[]).join(", ") : String(r[c.key] ?? "—")}
                  </TableCell>
                ))}
                <TableCell><SeoBadge score={entityScore(resource, r, year)} testid={`admin-${resource}-seo-score-${r.slug}`} /></TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" data-testid={`admin-${resource}-edit-${r.slug}`} onClick={() => open(r)}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete" data-testid={`admin-${resource}-delete-${r.slug}`} onClick={() => setConfirmDel(r)} className="text-red-600 hover:text-red-700"><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!list.isLoading && !rows.length && <TableRow><TableCell colSpan={columns.length + 2} className="text-slate-500">No records.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {dialog}

      <Dialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <DialogContent data-testid={`admin-${resource}-delete-dialog`}>
          <DialogHeader><DialogTitle>Delete “{String(confirmDel?.name ?? confirmDel?.title ?? "")}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">This removes it from the public website. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button variant="destructive" data-testid={`admin-${resource}-confirm-delete-button`} disabled={del.isPending} onClick={() => confirmDel && del.mutate(confirmDel.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
