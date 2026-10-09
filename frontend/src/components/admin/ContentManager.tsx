import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import { slugify } from "@/lib/site";
import SeoEditor, { type SeoForm } from "@/components/admin/SeoEditor";
import { useSeoPages } from "@/components/Seo";
import { defaultSeo, EMPTY_SEO } from "@/lib/seo";
import type { SeoMeta } from "@/lib/types";

const toSeoForm = (s?: SeoMeta): SeoForm => { const v = { ...EMPTY_SEO, ...s }; return { ...v, keywords: v.keywords.join(", ") }; };
const fromSeoForm = (f: SeoForm): SeoMeta => ({
  meta_title: f.meta_title.trim(), meta_description: f.meta_description.trim(), canonical_url: f.canonical_url.trim(), og_image: f.og_image.trim(), noindex: f.noindex,
  keywords: f.keywords.split(",").map((x) => x.trim()).filter(Boolean),
});

export type FieldType = "text" | "number" | "textarea" | "list" | "json" | "bool";
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

interface Props {
  resource: "colleges" | "courses" | "exams" | "articles";
  title: string;
  fields: FieldSpec[];
  columns: { key: string; label: string }[];
  publicPath: string;
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

export default function ContentManager({ resource, title, fields, columns, publicPath }: Props) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null | undefined>(undefined); // undefined = closed, null = new
  const [form, setForm] = useState<FormState>({});
  const [seo, setSeo] = useState<SeoForm>(toSeoForm());
  const seoPages = useSeoPages();
  const [confirmDel, setConfirmDel] = useState<Row | null>(null);

  const list = useQuery({ queryKey: [resource, "admin"], queryFn: () => apiGet<Row[]>(`/${resource}${resource === "colleges" ? "?limit=500" : ""}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: [resource] }); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); qc.invalidateQueries({ queryKey: ["meta"] }); };

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (editing ? apiPut<Row>(`/admin/${resource}/${editing.id}`, body) : apiPost<Row>(`/admin/${resource}`, body)),
    onSuccess: () => { toast.success(editing ? "Saved changes" : "Created"); setEditing(undefined); invalidate(); },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 409 ? "That slug is already used" : e instanceof ApiError && e.status === 422 ? "Some fields are invalid — check numbers and JSON" : "Save failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/${resource}/${id}`),
    onSuccess: () => { toast.success("Deleted"); setConfirmDel(null); invalidate(); },
    onError: () => toast.error("Delete failed"),
  });

  const open = (row: Row | null) => { setForm(toForm(fields, row ?? undefined)); setSeo(toSeoForm(row?.seo as SeoMeta | undefined)); setEditing(row); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const s of fields) if (s.required && !String(form[s.key] ?? "").trim()) return toast.error(`${s.label} is required`);
    let body: Record<string, unknown>;
    try { body = toPayload(fields, form); } catch { return toast.error("Invalid JSON in one of the fields"); }
    save.mutate({ ...body, seo: fromSeoForm(seo) });
  };

  const rows = useMemo(() => (list.data ?? []).filter((r) => !q || JSON.stringify([r.name, r.title, r.slug]).toLowerCase().includes(q.toLowerCase())), [list.data, q]);

  return (
    <div data-testid={`admin-${resource}-manager`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{title} <span className="text-sm font-normal text-slate-500">({list.data?.length ?? 0})</span></h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-2.5">
            <Search className="size-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-48 bg-transparent text-sm outline-none" data-testid={`admin-${resource}-search-input`} />
          </div>
          <Button onClick={() => open(null)} data-testid={`admin-${resource}-add-button`} className="bg-brand-red text-white hover:bg-red-700"><Plus className="size-4" /> Add new</Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-white">
        <Table data-testid={`admin-${resource}-table`}>
          <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}<TableHead className="w-28 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={columns.length + 1} className="text-slate-500">Loading…</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`admin-${resource}-row-${r.slug}`}>
                {columns.map((c, i) => (
                  <TableCell key={c.key} className={i === 0 ? "max-w-xs truncate font-medium" : "text-slate-600"}>
                    {i === 0 ? <a href={`${publicPath}/${r.slug}`} target="_blank" rel="noreferrer" className="hover:text-brand-red">{String(r[c.key] ?? "")}</a> : Array.isArray(r[c.key]) ? (r[c.key] as string[]).join(", ") : String(r[c.key] ?? "—")}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" data-testid={`admin-${resource}-edit-${r.slug}`} onClick={() => open(r)}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete" data-testid={`admin-${resource}-delete-${r.slug}`} onClick={() => setConfirmDel(r)} className="text-red-600 hover:text-red-700"><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!list.isLoading && !rows.length && <TableRow><TableCell colSpan={columns.length + 1} className="text-slate-500">No records.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== undefined} onOpenChange={(o) => { if (!o) setEditing(undefined); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid={`admin-${resource}-dialog`}>
          <DialogHeader><DialogTitle>{editing ? `Edit ${String(editing.name ?? editing.title ?? "")}` : `Add ${title.replace(/s$/, "")}`}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {fields.map((s) => {
              const id = `f-${resource}-${s.key}`;
              const tid = `admin-${resource}-field-${s.key.replace(/_/g, "-")}`;
              const val = form[s.key];
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
            <SeoEditor value={seo} onChange={setSeo} defaults={defaultSeo(resource, form, seoPages.data?.year ?? new Date().getFullYear())}
              path={`${publicPath}/${String(form.slug ?? "")}`} testid={`admin-${resource}-seo`} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)} data-testid={`admin-${resource}-cancel-button`}>Cancel</Button>
              <Button type="submit" disabled={save.isPending} data-testid={`admin-${resource}-save-button`} className="bg-brand-navy text-white hover:bg-brand-blue">{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
