import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { RazorpayStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shows whether the saved Razorpay keys reach the account that owns the predictor payment pages. */
export default function RazorpayStatusCard() {
  const q = useQuery({ queryKey: ["admin", "razorpay-status"], queryFn: () => apiGet<RazorpayStatus>("/admin/razorpay-status"), staleTime: 60_000 });
  const s = q.data;
  const ok = !!s && s.api_ok && s.mode === "live" && s.pages_missing.length === 0;
  const problems: string[] = [];
  if (s) {
    if (!s.configured) problems.push("Razorpay keys are not saved.");
    else if (s.error) problems.push(s.error + ".");
    else {
      if (s.mode !== "live") problems.push(`These are ${s.mode === "test" ? "Test-mode" : "unrecognised"} keys — real student payments are only visible with Live keys (rzp_live_…).`);
      if (s.pages_missing.length) problems.push(`This Razorpay account does not own the payment page for: ${s.pages_missing.join(", ")}. Use keys from the account that created these pages.`);
    }
  }
  return (
    <div className={cn("rounded-2xl border p-5", ok ? "border-green-200 bg-green-50/60" : s ? "border-amber-200 bg-amber-50/60" : "bg-white")} data-testid="admin-razorpay-status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {q.isLoading ? <Loader2 className="size-5 animate-spin text-slate-400" /> : ok ? <CheckCircle2 className="size-5 text-green-700" /> : <AlertTriangle className="size-5 text-amber-600" />}
          <p className="font-semibold text-slate-900" data-testid="admin-razorpay-status-title">
            {q.isLoading ? "Checking Razorpay connection…" : q.isError ? "Could not check Razorpay" : ok ? "Razorpay connected — payments can be confirmed" : "Razorpay needs attention"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching} data-testid="admin-razorpay-status-refresh">
          <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} /> Check again
        </Button>
      </div>
      {s && (
        <>
          {problems.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900" data-testid="admin-razorpay-status-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          {s.api_ok && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5" data-testid="admin-razorpay-status-stats">
              {([
                ["Mode", s.mode === "live" ? "Live" : s.mode === "test" ? "Test" : "Unknown"],
                ["Payment pages found", `${s.pages_found.length} of ${s.pages_found.length + s.pages_missing.length}`],
                ["Payments (48 h)", String(s.payments_48h)],
                ["At predictor prices", String(s.fee_payments_48h)],
                ["Last payment", s.last_payment_at ? new Date(s.last_payment_at * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-200"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 font-semibold text-slate-900">{v}</dd></div>
              ))}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
