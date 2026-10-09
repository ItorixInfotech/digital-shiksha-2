import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, MessageCircle, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import type { WaMessageStatus, WaTemplateInfo, WaTestKind, WaTestOut, WhatsAppPanel as Panel } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-green-50 text-green-800 ring-green-200" },
  pending: { label: "Pending WhatsApp review", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  received: { label: "Submitted — awaiting review", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 ring-red-200" },
  not_submitted: { label: "Not submitted for WhatsApp approval", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  not_found: { label: "Not found in Twilio", cls: "bg-red-50 text-red-700 ring-red-200" },
  unavailable: { label: "Can't check on Twilio trial", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  unknown: { label: "Unknown", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
};
const FINAL = ["delivered", "read", "failed", "undelivered"];
const errDetail = (e: unknown, fallback: string) =>
  e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : fallback;

function TemplateCard({ title, vars, info, testid }: { title: string; vars: string; info: WaTemplateInfo | null; testid: string }) {
  const st = info ? STATUS[info.status] ?? STATUS.unknown : null;
  return (
    <div className="rounded-2xl border bg-white p-5" data-testid={testid}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        {info ? (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", st?.cls)} data-testid={`${testid}-status`}>{st?.label}</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600" data-testid={`${testid}-status`}>No template set</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Variables: {vars}</p>
      {info && (
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="font-mono text-xs text-slate-500">{info.sid}{info.name ? ` • ${info.name}` : ""}</p>
          {info.body && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{info.body}</p>}
          {info.rejection_reason && <p className="text-red-700">Reason: {info.rejection_reason}</p>}
          {info.note && <p className="text-slate-600">{info.note}</p>}
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", info.in_use ? "text-green-700" : "text-slate-500")} data-testid={`${testid}-in-use`}>
            {info.in_use ? <CheckCircle2 className="size-3.5" /> : <Clock className="size-3.5" />}
            {info.in_use ? "In use for every new message" : "Not used yet — will switch on automatically once approved (re-checked every 10 min)"}
          </p>
          {info.checked_at && <p className="text-xs text-slate-400">Last checked {new Date(info.checked_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppPanel() {
  const qc = useQueryClient();
  const panel = useQuery({ queryKey: ["admin", "whatsapp"], queryFn: () => apiGet<Panel>("/admin/whatsapp") });
  const [sids, setSids] = useState<{ lead: string; student: string } | null>(null);
  const [lastTest, setLastTest] = useState<WaTestOut | null>(null);
  const p = panel.data;
  const form = sids ?? { lead: p?.lead?.sid ?? "", student: p?.student?.sid ?? "" };
  const setPanel = (d: Panel) => { qc.setQueryData(["admin", "whatsapp"], d); qc.invalidateQueries({ queryKey: ["admin", "stats"] }); };

  const recheck = useMutation({ mutationFn: () => apiPost<Panel>("/admin/whatsapp/check"), onSuccess: (d) => { setPanel(d); toast.success("Template status refreshed"); }, onError: () => toast.error("Check failed") });
  const save = useMutation({
    mutationFn: () => apiPut<Panel>("/admin/whatsapp/templates", { lead_sid: form.lead.trim(), student_sid: form.student.trim() }),
    onSuccess: (d) => { setPanel(d); setSids(null); toast.success("Templates saved & checked"); },
    onError: (e) => toast.error(errDetail(e, "Save failed")),
  });
  const test = useMutation({
    mutationFn: (kind: WaTestKind) => apiPost<WaTestOut>("/admin/whatsapp/test", { kind }),
    onSuccess: (r) => { setLastTest(r); if (r.ok) toast.success(`Sent to ${r.to} — tracking delivery…`); else toast.error("Twilio rejected the message"); },
    onError: (e) => toast.error(errDetail(e, "Test failed")),
  });
  const delivery = useQuery({
    queryKey: ["admin", "whatsapp", "msg", lastTest?.message_sid],
    queryFn: () => apiGet<WaMessageStatus>(`/admin/whatsapp/messages/${lastTest?.message_sid}`),
    enabled: !!lastTest?.message_sid,
    refetchInterval: (q) => (q.state.data && FINAL.includes(q.state.data.status) ? false : 2500),
  });

  if (panel.isLoading) return <p className="text-slate-500">Loading WhatsApp settings…</p>;
  if (panel.isError || !p) return <p className="text-slate-500" data-testid="admin-whatsapp-error">WhatsApp settings unavailable.</p>;

  const dStatus = delivery.data?.status;
  return (
    <div className="space-y-6" data-testid="admin-whatsapp-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">WhatsApp alerts</h2>
          <p className="text-sm text-slate-500">Twilio sender {p.sender || "—"} → counsellor {p.alert_to.join(", ") || "—"} • {p.configured ? "connected" : "not configured"}</p>
        </div>
        <Button variant="outline" onClick={() => recheck.mutate()} disabled={recheck.isPending} data-testid="admin-whatsapp-recheck-button">
          {recheck.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check approval now
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TemplateCard title="Counsellor lead alert" vars="{{1}} name, {{2}} mobile, {{3}} interest, {{4}} details" info={p.lead} testid="admin-whatsapp-lead-template" />
        <TemplateCard title="Student college list" vars="{{1}} first name, {{2}} exam & score, {{3}} top colleges, {{4}} results link" info={p.student} testid="admin-whatsapp-student-template" />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="admin-whatsapp-templates-form">
        <div className="grid gap-1.5">
          <Label htmlFor="wa-lead">Lead alert template SID</Label>
          <Input id="wa-lead" placeholder="HX…" value={form.lead} onChange={(e) => setSids({ ...form, lead: e.target.value })} className="font-mono" data-testid="admin-whatsapp-lead-sid-input" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wa-student">Student list template SID</Label>
          <Input id="wa-student" placeholder="HX…" value={form.student} onChange={(e) => setSids({ ...form, student: e.target.value })} className="font-mono" data-testid="admin-whatsapp-student-sid-input" />
        </div>
        <Button type="submit" disabled={save.isPending} data-testid="admin-whatsapp-save-button" className="bg-brand-navy text-white hover:bg-brand-blue">{save.isPending && <Loader2 className="size-4 animate-spin" />} Save & check</Button>
        <p className="text-xs text-slate-500 md:col-span-3">Copy the SID from Twilio Console → Messaging → Content Template Builder. Templates are only used once WhatsApp approves them; until then messages are sent as plain text (which Twilio rejects on trial accounts).</p>
      </form>

      <div className="rounded-2xl border bg-white p-5" data-testid="admin-whatsapp-test-section">
        <p className="font-semibold">Send test WhatsApp</p>
        <p className="mt-1 text-sm text-slate-500">Sends to the counsellor number {p.alert_to[0] ?? ""} and tracks delivery live.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {p.sample_available && (
            <Button onClick={() => test.mutate("sample")} disabled={test.isPending || !p.configured} data-testid="admin-whatsapp-test-sample-button" className="bg-[#25D366] text-white hover:bg-[#1ebe5a]">
              <MessageCircle className="size-4" /> Connection test (Twilio sample)
            </Button>
          )}
          <Button variant="outline" onClick={() => test.mutate("lead")} disabled={test.isPending || !p.configured} data-testid="admin-whatsapp-test-lead-button"><Send className="size-4" /> Test lead alert</Button>
          <Button variant="outline" onClick={() => test.mutate("student")} disabled={test.isPending || !p.configured} data-testid="admin-whatsapp-test-student-button"><Send className="size-4" /> Test student list</Button>
          {test.isPending && <Loader2 className="size-5 animate-spin self-center text-slate-400" />}
        </div>
        {lastTest && (
          <div className={cn("mt-4 rounded-xl p-4 text-sm", lastTest.ok ? (dStatus === "failed" || dStatus === "undelivered" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800") : "bg-red-50 text-red-800")} data-testid="admin-whatsapp-test-result">
            <p className="flex items-center gap-2 font-semibold">
              {lastTest.ok ? (FINAL.includes(dStatus ?? "") ? (dStatus === "delivered" || dStatus === "read" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />) : <Loader2 className="size-4 animate-spin" />) : <XCircle className="size-4" />}
              {lastTest.ok ? `Delivery status: ${dStatus ?? "queued"}` : "Not sent"}
            </p>
            <p className="mt-1">{lastTest.ok ? `Twilio message ${lastTest.message_sid}` : lastTest.detail}</p>
            {delivery.data?.error && <p className="mt-1">{delivery.data.error}</p>}
            <p className="mt-1 text-xs opacity-80">Template used: {lastTest.used_template}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">
        <p><span className="font-semibold text-slate-900">Last real lead alert:</span> {p.last_lead}</p>
        <p className="mt-1"><span className="font-semibold text-slate-900">Last student list:</span> {p.last_student}</p>
      </div>
    </div>
  );
}
