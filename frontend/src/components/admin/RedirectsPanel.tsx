import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import type { Redirect, RedirectIn } from "@/lib/types";

const EMPTY: RedirectIn = { from_path: "", to_path: "", include_subpages: true };

const errDetail = (e: unknown) => {
  if (!(e instanceof ApiError) || !e.body || typeof e.body !== "object" || !("detail" in e.body)) return "Could not save redirect";
  const d = (e.body as { detail: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) return String((d[0] as { msg: string }).msg).replace(/^Value error, /, "");
  return "Please check the addresses";
};

/** Strip the site's own domain so pasting a full old URL works. */
const toPath = (v: string) => v.trim().replace(/^https?:\/\/(www\.)?digitalshiksha\.in/i, "") || "";

export default function RedirectsPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "redirects"], queryFn: () => apiGet<Redirect[]>("/admin/redirects") });
  const [form, setForm] = useState<RedirectIn>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const done = (msg: string) => {
    toast.success(msg);
    setForm(EMPTY); setEditId(null);
    qc.invalidateQueries({ queryKey: ["admin", "redirects"] });
    qc.invalidateQueries({ queryKey: ["redirects"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body: RedirectIn = { ...form, from_path: toPath(form.from_path), to_path: toPath(form.to_path) };
      return editId ? apiPut<Redirect>(`/admin/redirects/${editId}`, body) : apiPost<Redirect>("/admin/redirects", body);
    },
    onSuccess: () => done(editId ? "Redirect updated" : "Redirect added"),
    onError: (e) => toast.error(errDetail(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/redirects/${id}`),
    onSuccess: () => done("Redirect removed"),
    onError: () => toast.error("Could not remove redirect"),
  });

  return (
    <div className="space-y-6" data-testid="redirects-panel">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Redirects</h2>
        <p className="mt-1 text-sm text-slate-500">Send visitors (and Google) from old website addresses to the right page on this site.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="rounded-2xl border bg-white p-5 shadow-sm" data-testid="redirect-form">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="redirect-from">Old address</Label>
            <Input id="redirect-from" value={form.from_path} onChange={(e) => setForm({ ...form, from_path: e.target.value })} placeholder="/blog or /mba-admission.php" required data-testid="redirect-from-input" />
          </div>
          <ArrowRight className="mx-auto mb-2.5 hidden size-5 text-slate-400 md:block" />
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to">New address</Label>
            <Input id="redirect-to" value={form.to_path} onChange={(e) => setForm({ ...form, to_path: e.target.value })} placeholder="/news or /courses/mba" required data-testid="redirect-to-input" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={form.include_subpages} onCheckedChange={(v) => setForm({ ...form, include_subpages: v === true })} data-testid="redirect-subpages-checkbox" />
            Also redirect pages under it (e.g. {form.from_path.trim() || "/blog"}/any-post)
          </label>
          <div className="flex gap-2">
            {editId && <Button type="button" variant="outline" onClick={() => { setEditId(null); setForm(EMPTY); }} data-testid="redirect-cancel-edit"><X className="size-4" /> Cancel</Button>}
            <Button type="submit" disabled={save.isPending} className="bg-brand-leaf text-white hover:bg-brand-leaf/90" data-testid="redirect-save-button">
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : editId ? <Pencil className="size-4" /> : <Plus className="size-4" />} {editId ? "Update redirect" : "Add redirect"}
            </Button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Old address</TableHead><TableHead>Goes to</TableHead><TableHead>Sub-pages</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={4} className="text-slate-500">Loading…</TableCell></TableRow>}
            {list.data && !list.data.length && <TableRow><TableCell colSpan={4} className="text-slate-500" data-testid="redirects-empty">No redirects yet — add your first old address above.</TableCell></TableRow>}
            {list.data?.map((r) => (
              <TableRow key={r.id} data-testid={`redirect-row-${r.id}`}>
                <TableCell className="font-mono text-sm" data-testid={`redirect-from-${r.id}`}>{r.from_path}</TableCell>
                <TableCell className="font-mono text-sm text-brand-leaf" data-testid={`redirect-to-${r.id}`}><a href={r.to_path} target="_blank" rel="noreferrer" className="hover:underline">{r.to_path}</a></TableCell>
                <TableCell className="text-sm text-slate-600">{r.include_subpages ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditId(r.id); setForm({ from_path: r.from_path, to_path: r.to_path, include_subpages: r.include_subpages }); }} data-testid={`redirect-edit-${r.id}`}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={del.isPending} onClick={() => { if (window.confirm(`Remove redirect ${r.from_path}?`)) del.mutate(r.id); }} data-testid={`redirect-delete-${r.id}`}><Trash2 className="size-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
