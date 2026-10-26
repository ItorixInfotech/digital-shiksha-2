import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, CreditCard, Download, Loader2, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, ApiError } from "@/lib/api";
import { readContact, setPending } from "@/lib/predictor-storage";
import type { PredictorIn, UnlockIn, UnlockOut } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid: () => void; // the unlock is stored server-side in an httpOnly cookie
  prediction: PredictorIn;
  fee: number;
  paymentLink: string;
  autoCheck: boolean; // false = Razorpay keys missing, payment can't be found automatically
  metric: string; // "percentile" | "score" | "rank" — wording only
  /** Back from the Razorpay page: "poll" = Razorpay redirected after paying (keep checking ~40s), "once" = Back button (one quiet check). */
  autoConfirm?: "poll" | "once";
}

const unitWord = (metric: string) => (metric === "rank" ? "rank" : metric === "score" ? "score" : "percentile");

const download = (url: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/** Paid MHT CET step: pay on the Razorpay page, then we find the payment with Razorpay (by mobile) and unlock this exam + score. */
export default function PredictorPayment({ open, onOpenChange, onPaid, prediction, fee, paymentLink, autoCheck, metric, autoConfirm }: Props) {
  const [contact] = useState(readContact);
  const [phone, setPhone] = useState(contact.phone);
  // If Razorpay redirects back with ?razorpay_payment_id=…, use it silently (no field to fill).
  const [redirectId] = useState(() => new URLSearchParams(window.location.search).get("razorpay_payment_id") ?? "");
  const mobile = phone.replace(/\D/g, "").slice(-10);
  const phoneOk = /^[6-9]\d{9}$/.test(mobile);
  const [paid, setPaid] = useState<UnlockOut | null>(null);

  const unlock = () => apiPost<UnlockOut>("/predictor/unlock", {
    prediction, name: contact.name, phone: mobile, payment_id: /^pay_[A-Za-z0-9]{6,30}$/.test(redirectId) ? redirectId : "",
  } satisfies UnlockIn);
  const confirmed = (r: UnlockOut) => {
    setPaid(r);
    if (r.pdf_url) download(r.pdf_url);
    toast.success(r.email ? `Payment confirmed! Your PDF is downloading and has been emailed to ${r.email}.` : "Payment confirmed! Your PDF is downloading.");
  };
  const verify = useMutation({
    mutationFn: unlock,
    onSuccess: confirmed,
    onError: (e) => {
      const detail = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : undefined;
      toast.error(typeof detail === "string" ? detail : "We couldn't confirm your payment yet — please try again in a minute");
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOk) return toast.error("Enter the 10-digit mobile number you paid with");
    verify.mutate();
  };
  // Returning from Razorpay: confirm without any tap. Razorpay can take a few seconds to record the payment, so poll.
  const [checking, setChecking] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!open || !autoConfirm || !autoCheck || !phoneOk || started.current) return;
    started.current = true; // once per return from Razorpay; keeps running even if props settle meanwhile
    const tries = autoConfirm === "poll" ? 10 : 1;
    void (async () => {
      setChecking(true);
      for (let i = 0; i < tries && alive.current; i++) {
        try {
          const r = await unlock();
          if (alive.current) confirmed(r);
          break;
        } catch {
          if (i < tries - 1) await new Promise((res) => setTimeout(res, 4000));
          else if (autoConfirm === "poll" && alive.current) toast("We're still waiting for Razorpay to confirm your payment", { description: "Tap \"I've paid\" in a minute — you won't be charged again." });
        }
      }
      if (alive.current) setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unlock/confirmed are stable enough for a one-shot run
  }, [open, autoConfirm, autoCheck, phoneOk]);

  const close = (o: boolean) => { if (!o && paid) onPaid(); onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="predictor-payment-dialog">
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-green-50 text-brand-leaf">{paid ? <CheckCircle2 className="size-5" /> : <CreditCard className="size-5" />}</span>
          <DialogTitle>{paid ? "Payment confirmed" : `Unlock your ${prediction.exam} college list`}</DialogTitle>
          <DialogDescription>
            {paid ? <>Thank you! Your full college list for {unitWord(metric)} <span className="font-semibold text-slate-900">{paid.score}</span> is ready.</>
              : <>Pay <span className="font-semibold text-slate-900" data-testid="predictor-payment-fee">₹{fee.toLocaleString("en-IN")}</span> once for {unitWord(metric)} <span className="font-semibold text-slate-900">{prediction.score}</span>. You'll get the full college list PDF here and by email.</>}
          </DialogDescription>
        </DialogHeader>

        {checking && !paid ? (
          <div className="grid place-items-center gap-3 py-8 text-center text-sm animate-fade-up" data-testid="predictor-payment-checking">
            <Loader2 className="size-8 animate-spin text-brand-leaf" />
            <p className="font-semibold text-slate-900">Confirming your payment with Razorpay…</p>
            <p className="text-xs text-slate-500">This takes a few seconds. Please don't close this page.</p>
          </div>
        ) : paid ? (
          <div className="grid gap-4 text-sm animate-fade-up" data-testid="predictor-payment-confirmation">
            <div className="grid gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-green-800"><ShieldCheck className="size-4" /> ₹{paid.amount.toLocaleString("en-IN")} received · <span className="font-mono text-xs" data-testid="predictor-payment-confirmed-id">{paid.payment_id}</span></p>
              <p className="flex items-center gap-2 text-slate-700"><Mail className="size-4 text-slate-500" /> <span data-testid="predictor-payment-confirmed-email">{paid.email || "No email on the payment"}</span></p>
              <p className="flex items-center gap-2 text-slate-700"><Phone className="size-4 text-slate-500" /> <span data-testid="predictor-payment-confirmed-phone">{paid.phone || `+91 ${mobile}`}</span></p>
              <p className="text-xs text-slate-500">Details from your Razorpay payment. {paid.email && "Your receipt and college list PDF have been emailed here."}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a href={paid.pdf_url} download data-testid="predictor-payment-pdf-download"
                className={cn(buttonVariants({ variant: "outline" }), "h-11")}><Download className="size-4" /> Download PDF</a>
              <Button onClick={() => close(false)} className="h-11 bg-brand-leaf text-white hover:bg-brand-leaf/90" data-testid="predictor-payment-view-results-button">View my colleges</Button>
            </div>
          </div>
        ) : (
          <ol className="grid gap-4 text-sm">
            <li className="grid gap-2">
              <p className="font-medium"><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-brand-navy text-[11px] text-white">1</span>Pay securely on Razorpay</p>
              <a href={paymentLink} target="_blank" rel="noreferrer" data-testid="predictor-payment-link" onClick={() => setPending(window.location.search)}
                className={cn(buttonVariants(), "h-11 bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]")}>
                Pay ₹{fee.toLocaleString("en-IN")} <ExternalLink className="size-4" />
              </a>
              <p className="text-xs text-slate-500">Opens in a new tab. Use the same mobile number below when paying.</p>
            </li>
            <li>
              <form onSubmit={submit} className="grid gap-3" noValidate data-testid="predictor-payment-form">
                <p className="font-medium"><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-brand-navy text-[11px] text-white">2</span>After paying, confirm here</p>
                <div className="grid gap-1.5">
                  <Label htmlFor="pp-phone">Mobile number used to pay</Label>
                  <div className="flex">
                    <span className="grid place-items-center rounded-l-md border border-r-0 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
                    <Input id="pp-phone" inputMode="numeric" maxLength={14} className="rounded-l-none" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" data-testid="predictor-payment-phone-input" />
                  </div>
                  <p className="text-[11px] text-slate-500">We find your payment on Razorpay and fetch your email and mobile automatically.</p>
                </div>
                {!autoCheck && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800" data-testid="predictor-payment-unavailable">Automatic payment check is being set up — please call +91 8149 68 9468 after paying.</p>}
                <Button type="submit" disabled={verify.isPending} className="h-11 bg-brand-leaf text-white hover:bg-brand-leaf/90" data-testid="predictor-payment-verify-button">
                  {verify.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} I've paid — show my colleges
                </Button>
              </form>
            </li>
          </ol>
        )}
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400"><MessageCircle className="mt-0.5 size-3.5 shrink-0" /> One payment unlocks one {unitWord(metric)}. Changing your {unitWord(metric)} needs a new payment. Category, branch and location filters stay free.</p>
      </DialogContent>
    </Dialog>
  );
}
