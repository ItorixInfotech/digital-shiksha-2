import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost, ApiError } from "@/lib/api";
import type { Lead, LeadIn } from "@/lib/types";
import { COURSE_INTERESTS } from "@/lib/site";
import type { EnquiryPrefill } from "@/lib/site-context";

interface Props {
  prefill?: EnquiryPrefill;
  testid?: string;
  showMessage?: boolean;
  showBudget?: boolean;
  dark?: boolean;
  onDone?: () => void;
}

const empty = { name: "", phone: "", email: "", city: "", course_interest: "", budget: "", message: "" };

export default function EnquiryForm({ prefill, testid = "enquiry", showMessage = false, showBudget = false, dark = false, onDone }: Props) {
  const [f, setF] = useState({ ...empty, course_interest: prefill?.course_interest ?? "", message: prefill?.message ?? "" });
  const [done, setDone] = useState(false);
  const [waOptIn, setWaOptIn] = useState(true);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((cur) => ({ ...cur, [k]: e.target.value }));

  const m = useMutation({
    mutationFn: (body: LeadIn) => apiPost<Lead>("/enquiries", body),
    onSuccess: () => {
      setDone(true);
      setF({ ...empty });
      toast.success("Thank you! Our counsellor will call you shortly.");
      onDone?.();
    },
    onError: (err) => {
      const msg = err instanceof ApiError && err.status === 422 ? "Please check your name and 10-digit mobile number." : "Could not submit. Please call +91 8149 68 9468.";
      toast.error(msg);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (f.name.trim().length < 2) return toast.error("Please enter your full name");
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error("Please enter a valid 10-digit Indian mobile number");
    m.mutate({
      name: f.name.trim(),
      phone,
      email: f.email.trim() || null,
      city: f.city.trim(),
      course_interest: f.course_interest,
      college: prefill?.college ?? "",
      budget: f.budget.trim(),
      message: f.message.trim(),
      source: prefill?.source ?? "website",
      prediction: prefill?.prediction ?? null,
      whatsapp_opt_in: !!prefill?.prediction && waOptIn,
    });
  };

  const labelCls = dark ? "text-slate-200" : "text-slate-700";
  const inputCls = dark ? "bg-white/10 border-white/20 text-white placeholder:text-slate-400" : "bg-white";

  if (done) {
    return (
      <div data-testid={`${testid}-success`} className="flex flex-col items-start gap-3 py-4 animate-fade-up">
        <CheckCircle2 className="size-10 text-brand-green" />
        <p className={dark ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>Enquiry received!</p>
        <p className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
          A Digital Shiksha counsellor will call you within 24 hours. For urgent help call +91 8149 68 9468.
        </p>
        <Button variant="outline" size="sm" data-testid={`${testid}-again-button`} onClick={() => setDone(false)}>
          Submit another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3" data-testid={`${testid}-form`} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor={`${testid}-name`} className={labelCls}>Full name *</Label>
        <Input id={`${testid}-name`} data-testid={`${testid}-name-input`} className={inputCls} placeholder="Your name" value={f.name} onChange={set("name")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-phone`} className={labelCls}>Mobile number *</Label>
          <Input id={`${testid}-phone`} data-testid={`${testid}-phone-input`} className={inputCls} inputMode="numeric" placeholder="10-digit mobile" value={f.phone} onChange={set("phone")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-email`} className={labelCls}>Email</Label>
          <Input id={`${testid}-email`} type="email" data-testid={`${testid}-email-input`} className={inputCls} placeholder="you@example.com" value={f.email} onChange={set("email")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-city`} className={labelCls}>City</Label>
          <Input id={`${testid}-city`} data-testid={`${testid}-city-input`} className={inputCls} placeholder="e.g. Pune" value={f.city} onChange={set("city")} />
        </div>
        <div className="grid gap-1.5">
          <Label className={labelCls}>Interested course</Label>
          <Select value={f.course_interest} onValueChange={(v: string) => setF((c) => ({ ...c, course_interest: v }))}>
            <SelectTrigger data-testid={`${testid}-course-select`} className={`w-full ${inputCls}`}>
              <SelectValue>{(v) => (v ? (v as string) : <span className="text-slate-400">Select course</span>)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COURSE_INTERESTS.map((c) => (
                <SelectItem key={c} value={c} data-testid={`${testid}-course-option-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showBudget && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-budget`} className={labelCls}>Budget (per year)</Label>
          <Input id={`${testid}-budget`} data-testid={`${testid}-budget-input`} className={inputCls} placeholder="e.g. ₹2-3 Lakh" value={f.budget} onChange={set("budget")} />
        </div>
      )}
      {showMessage && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-message`} className={labelCls}>Message</Label>
          <Textarea id={`${testid}-message`} data-testid={`${testid}-message-input`} className={inputCls} rows={3} placeholder="Your score / percentile, preferred colleges, questions…" value={f.message} onChange={set("message")} />
        </div>
      )}
      {prefill?.prediction && (
        <label className={`flex items-start gap-2 text-sm ${dark ? "text-slate-200" : "text-slate-700"}`}>
          <Checkbox checked={waOptIn} onCheckedChange={(c) => setWaOptIn(Boolean(c))} data-testid={`${testid}-whatsapp-optin-checkbox`} className="mt-0.5" />
          Send my predicted college list to this number on WhatsApp
        </label>
      )}
      <Button type="submit" size="lg" disabled={m.isPending} data-testid={`${testid}-submit-button`} className="mt-1 h-11 bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">
        {m.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {m.isPending ? "Submitting…" : "Get Free Counselling"}
      </Button>
      <p className={dark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>By submitting you agree to receive a call/WhatsApp from Digital Shiksha.</p>
    </form>
  );
}
