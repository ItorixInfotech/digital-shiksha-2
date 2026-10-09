import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import type { Counsellor, CounsellorIn, CounsellorSettings, CounsellorSettingsIn, CounsellorWithStats, ReminderRun } from "@/lib/types";
import { cn } from "@/lib/utils";

const errDetail = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
    ? (typeof (e.body as { detail: unknown }).detail === "string" ? String((e.body as { detail: string }).detail) : "Please check the details") : fallback;

const EMPTY = { name: "", phone: "", email: "" };

export default function CounsellorsPanel() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "counsellors"], queryFn: () => apiGet<CounsellorWithStats[]>("/admin/counsellors") });
  const settings = useQuery({ queryKey: ["admin", "counsellor-settings"], queryFn: () => apiGet<CounsellorSettings>("/admin/counsellor-settings") });
  const [form, setForm] = useState(EMPTY);
  const [sid, setSid] = useState<string | null>(null);
  const [run, setRun] = useState<ReminderRun | null>(null);
  const inval = () => { qc.invalidateQueries({ queryKey: ["admin", "counsellors"] }); qc.invalidateQueries({ queryKey: ["admin", "leads"] }); };

  const add = useMutation({
    mutationFn: () => apiPost<Counsellor>("/admin/counsellors", { name: form.name.trim(), phone: form.phone.replace(/\D/g, "").slice(-10), email: form.email.trim() || null, active: true } satisfies CounsellorIn),
    onSuccess: () => { toast.success("Counsellor added"); setForm(EMPTY); inval(); },
    onError: (e) => toast.error(errDetail(e, "Could not add counsellor")),
  });
  const toggle = useMutation({
    mutationFn: (c: CounsellorWithStats) => apiPut<Counsellor>(`/admin/counsellors/${c.id}`, { name: c.name, phone: c.phone, email: c.email, active: !c.active } satisfies CounsellorIn),
    onSuccess: () => inval(),
    onError: () => toast.error("Update failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/counsellors/${id}`),
    onSuccess: () => { toast.success("Counsellor removed — their leads are now unassigned"); inval(); },
  });
  const save = useMutation({
    mutationFn: (body: CounsellorSettingsIn) => apiPut<CounsellorSettings>("/admin/counsellor-settings", body),
    onSuccess: (d) => { qc.setQueryData(["admin", "counsellor-settings"], d); setSid(null); toast.success("Settings saved"); },
    onError: (e) => toast.error(errDetail(e, "Could not save settings")),
  });
  const remind = useMutation({
    mutationFn: () => apiPost<ReminderRun>("/admin/reminders/send", {}),
    onSuccess: (d) => {
      setRun(d);
      toast.success(d.queued ? `Reminders queued for ${d.recipients.length} recipient(s)` : "No New leads — nothing to send");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin", "counsellor-settings"] }), 4000);
    },
    onError: () => toast.error("Could not send reminders"),
  });

  const s = settings.data;
  const sidValue = sid ?? s?.reminder_template_sid ?? "";
  const phoneOk = /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, "").slice(-10));

  return (
    <div className="space-y-6" data-testid="admin-counsellors-panel">
      <div>
        <h2 className="text-xl font-semibold">Counsellors</h2>
        <p className="mt-1 text-sm text-slate-500">New enquiries are sent on WhatsApp + email to the assigned counsellor. Unassigned leads go to {s?.fallback_numbers.join(", ") || "the main admin number"}.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-white p-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); add.mutate(); }} data-testid="admin-counsellor-form">
            <div className="grid gap-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Kulkarni" data-testid="admin-counsellor-name-input" /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-phone">WhatsApp mobile</Label><Input id="c-phone" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" data-testid="admin-counsellor-phone-input" /></div>
            <div className="grid gap-1.5"><Label htmlFor="c-email">Email (optional)</Label><Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@digitalshiksha.in" data-testid="admin-counsellor-email-input" /></div>
            <Button type="submit" disabled={add.isPending || form.name.trim().length < 2 || !phoneOk} className="bg-brand-red text-white hover:bg-red-700" data-testid="admin-counsellor-add-button">
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
            </Button>
          </form>

          <Table className="mt-5" data-testid="admin-counsellors-table">
            <TableHeader><TableRow><TableHead>Counsellor</TableHead><TableHead>Leads</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.isLoading && <TableRow><TableCell colSpan={4} className="text-slate-500">Loading…</TableCell></TableRow>}
              {(list.data ?? []).map((c) => (
                <TableRow key={c.id} data-testid={`admin-counsellor-row-${c.id}`} className={cn(!c.active && "opacity-60")}>
                  <TableCell>
                    <p className="flex items-center gap-2 font-medium text-slate-900" data-testid={`admin-counsellor-name-${c.id}`}><UserRound className="size-4 text-brand-blue" />{c.name}</p>
                    <p className="text-xs text-slate-500">+91 {c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`admin-counsellor-leads-${c.id}`}><span className="font-semibold">{c.total_leads}</span> <span className="text-xs text-red-600">({c.new_leads} new)</span></TableCell>
                  <TableCell><Checkbox checked={c.active} onCheckedChange={() => toggle.mutate(c)} aria-label="Active" data-testid={`admin-counsellor-active-${c.id}`} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" className="text-red-600" aria-label="Remove counsellor" data-testid={`admin-counsellor-delete-${c.id}`} onClick={() => { if (window.confirm(`Remove ${c.name}? Their leads become unassigned.`)) del.mutate(c.id); }}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!list.isLoading && !list.data?.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">No counsellors yet — add your team above.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-5" data-testid="admin-counsellor-settings">
            <h3 className="font-semibold">Assignment & reminders</h3>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <Checkbox checked={!!s?.auto_assign} disabled={!s || save.isPending} onCheckedChange={(v) => save.mutate({ auto_assign: Boolean(v), reminder_template_sid: s?.reminder_template_sid ?? "" })} data-testid="admin-auto-assign-checkbox" className="mt-0.5" />
              <span><span className="font-medium text-slate-900">Auto-assign new leads (round-robin)</span><br /><span className="text-slate-500">Each new enquiry goes to the next active counsellor in turn. You can still reassign from the Leads tab.</span></span>
            </label>
            <div className="mt-5 grid gap-1.5">
              <Label htmlFor="c-sid">Reminder WhatsApp template SID (optional)</Label>
              <div className="flex gap-2">
                <Input id="c-sid" className="font-mono" placeholder="HX…" value={sidValue} onChange={(e) => setSid(e.target.value)} data-testid="admin-reminder-sid-input" />
                <Button variant="outline" disabled={sid === null || save.isPending} onClick={() => save.mutate({ auto_assign: !!s?.auto_assign, reminder_template_sid: sidValue.trim() })} data-testid="admin-reminder-sid-save-button">Save</Button>
              </div>
              <p className="text-xs text-slate-500">Variables: {"{{1}}"} counsellor first name, {"{{2}}"} number of leads, {"{{3}}"} lead list. Without an approved template, WhatsApp only delivers inside a 24-hour chat window.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-brand-ink p-5 text-white" data-testid="admin-reminders-card">
            <h3 className="flex items-center gap-2 font-semibold"><BellRing className="size-4 text-red-300" /> Morning follow-up reminders</h3>
            <p className="mt-1 text-sm text-slate-300">Every day at <strong className="text-white">8:00 AM IST</strong> each counsellor gets a WhatsApp (and email) listing their leads still in “New”.</p>
            <p className="mt-3 text-xs text-slate-300" data-testid="admin-last-reminder">Last run: {s?.last_reminder ?? "—"}</p>
            <Button onClick={() => remind.mutate()} disabled={remind.isPending} className="mt-4 bg-brand-red text-white hover:bg-red-700" data-testid="admin-send-reminders-button">
              {remind.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />} Send reminders now
            </Button>
            {run && (
              <ul className="mt-4 space-y-1 text-sm animate-fade-up" data-testid="admin-reminder-result">
                {!run.queued && <li className="text-slate-300">No leads in “New” status.</li>}
                {run.recipients.map((r) => <li key={r.name + r.to} className="flex justify-between gap-3 rounded-lg bg-white/10 px-3 py-1.5"><span>{r.name} <span className="text-xs text-slate-400">{r.to}</span></span><span className="font-semibold">{r.leads}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
