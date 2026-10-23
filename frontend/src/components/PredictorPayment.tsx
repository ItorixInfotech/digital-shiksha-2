import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTACT_KEY } from "@/components/PredictorGate";
import { apiPost, ApiError } from "@/lib/api";
import type { PredictorIn, UnlockIn, UnlockOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOKENS_KEY = "ds_predictor_unlocks_v1";
const tokenKey = (exam: string, score: number) => `${exam}|${score}`;
const readTokens = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}"); } catch { return {}; } };
export const getUnlockToken = (exam: string, score: number) => readTokens()[tokenKey(exam, score)] ?? "";
export const setUnlockToken = (exam: string, score: number, token: string) => {
  const t = readTokens();
  if (token) t[tokenKey(exam, score)] = token; else delete t[tokenKey(exam, score)];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
};
const savedContact = (): { name: string; phone: string } => { try { return JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "{}"); } catch { return { name: "", phone: "" }; } };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid: (token: string) => void;
  prediction: PredictorIn;
  fee: number;
  paymentLink: string;
  autoCheck: boolean; // false = payment ID from the receipt is required
}
export const PENDING_KEY = "ds_predictor_pending_v1"; // prediction query to restore when Razorpay redirects back

/** Paid MHT CET step: pay on the Razorpay page, then we confirm the payment with Razorpay and unlock this exam + score. */
export default function PredictorPayment({ open, onOpenChange, onPaid, prediction, fee, paymentLink, autoCheck }: Props) {
  const contact = savedContact();
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState("");
  const mail = email.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail);
  const [paymentId, setPaymentId] = useState(() => new URLSearchParams(window.location.search).get("razorpay_payment_id") ?? "");
  const mobile = phone.replace(/\D/g, "").slice(-10);
  const pid = paymentId.trim();
  const phoneOk = /^[6-9]\d{9}$/.test(mobile);
  const pidOk = (!autoCheck && !pid) ? false : !pid || /^pay_[A-Za-z0-9]{6,30}$/.test(pid);

  const verify = useMutation({
    mutationFn: () => apiPost<UnlockOut>("/predictor/unlock", { prediction, name: contact.name ?? "", phone: mobile, email: mail, payment_id: pid } satisfies UnlockIn),
    onSuccess: (r) => {
      setUnlockToken(r.exam, r.score, r.token);
      toast.success(`Payment confirmed! Your receipt and full college list PDF are on their way to ${mail}.`);
      onPaid(r.token);
    },
    onError: (e) => {
      const detail = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : undefined;
      toast.error(typeof detail === "string" ? detail : "Please check your mobile number and payment ID");
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOk) return toast.error("Enter the 10-digit mobile number you paid with");
    if (!emailOk) return toast.error("Enter a valid email — we'll send your receipt and college list PDF there");
    if (!pidOk) return toast.error(pid ? "Payment ID looks like pay_XXXXXXXXXXXX" : "Enter the payment ID (pay_…) from your Razorpay receipt");
    verify.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="predictor-payment-dialog">
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-green-50 text-brand-leaf"><CreditCard className="size-5" /></span>
          <DialogTitle>Unlock your MHT CET college list</DialogTitle>
          <DialogDescription>
            Pay <span className="font-semibold text-slate-900" data-testid="predictor-payment-fee">₹{fee.toLocaleString("en-IN")}</span> once for percentile <span className="font-semibold text-slate-900">{prediction.score}</span>. You'll see every predicted college here and get a receipt with the full list PDF by email.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-4 text-sm">
          <li className="grid gap-2">
            <p className="font-medium"><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-brand-navy text-[11px] text-white">1</span>Pay securely on Razorpay</p>
            <a href={paymentLink} target="_blank" rel="noreferrer" data-testid="predictor-payment-link" onClick={() => localStorage.setItem(PENDING_KEY, window.location.search)}
              className={cn(buttonVariants(), "h-11 bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]")}>
              Pay ₹{fee.toLocaleString("en-IN")} <ExternalLink className="size-4" />
            </a>
            <p className="text-xs text-slate-500">Opens in a new tab. Use the same mobile number below.</p>
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
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pp-email">Email for receipt &amp; PDF</Label>
                <Input id="pp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="predictor-payment-email-input" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pp-id">Razorpay payment ID {autoCheck && <span className="font-normal text-slate-400">(optional)</span>}</Label>
                <Input id="pp-id" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="pay_XXXXXXXXXXXX — from your receipt" data-testid="predictor-payment-id-input" />
                <p className="text-[11px] text-slate-500">Shown on the Razorpay success screen and in the receipt SMS / email.</p>
              </div>
              <Button type="submit" disabled={verify.isPending} className="h-11 bg-brand-leaf text-white hover:bg-brand-leaf/90" data-testid="predictor-payment-verify-button">
                {verify.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} I've paid — show my colleges
              </Button>
            </form>
          </li>
        </ol>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400"><MessageCircle className="mt-0.5 size-3.5 shrink-0" /> One payment unlocks one percentile. Changing your percentile needs a new payment. Category, branch and location filters stay free.</p>
      </DialogContent>
    </Dialog>
  );
}
