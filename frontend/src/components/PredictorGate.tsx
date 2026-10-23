import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Loader2, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, ApiError } from "@/lib/api";
import type { Lead, LeadIn, LeadRole, PredictionContext } from "@/lib/types";
import { cn } from "@/lib/utils";

export const GATE_KEY = "ds_predictor_details_v1";
export const CONTACT_KEY = "ds_predictor_contact_v1"; // {name, phone} — prefills the payment step

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUnlocked: () => void;
  prediction: PredictionContext | null;
  examLabel: string;
}

/** Lead capture shown before the first prediction result. Saves an enquiry (source "predictor-gate"), then unlocks results for this browser. */
export default function PredictorGate({ open, onOpenChange, onUnlocked, prediction, examLabel }: Props) {
  const [f, setF] = useState({ name: "", phone: "", city: "", college: "" });
  const [role, setRole] = useState<LeadRole | null>(null);
  const [touched, setTouched] = useState(false);
  const phone = f.phone.replace(/\D/g, "").slice(-10);
  const errors = {
    name: f.name.trim().length < 2 ? "Please enter your full name" : "",
    phone: !/^[6-9]\d{9}$/.test(phone) ? "Enter a valid 10-digit mobile number" : "",
    city: f.city.trim().length < 2 ? "Please enter your city" : "",
    role: !role ? "Please choose Parent or Student" : "",
    college: f.college.trim().length < 2 ? "Tell us which college you're looking for" : "",
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = useMutation({
    mutationFn: () => apiPost<Lead>("/enquiries", {
      name: f.name.trim(), phone, email: null, city: f.city.trim(), course_interest: examLabel, college: f.college.trim(), budget: "",
      message: `College Predictor: ${role} — ${prediction ? `${prediction.exam} ${prediction.score} (${prediction.category})` : ""}`.trim(),
      source: "predictor-gate", prediction, whatsapp_opt_in: false, role,
    } satisfies LeadIn),
    onSuccess: () => {
      localStorage.setItem(GATE_KEY, "1");
      localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: f.name.trim(), phone }));
      toast.success("Thanks! Your details are saved.");
      onUnlocked();
    },
    onError: (e) => toast.error(e instanceof ApiError && e.status === 422 ? "Please check your details" : "Couldn't save — please try again"),
  });
  const submit = (e: React.FormEvent) => { e.preventDefault(); setTouched(true); if (valid) save.mutate(); };
  const err = (k: keyof typeof errors) => touched && errors[k] ? <p className="text-xs text-red-600" data-testid={`predictor-gate-${k}-error`}>{errors[k]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="predictor-gate-dialog">
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-green-50 text-brand-leaf"><Lock className="size-5" /></span>
          <DialogTitle>Your college list is ready</DialogTitle>
          <DialogDescription>Share a few details to see your predicted colleges. Our counsellor may call to help with your option form — free.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3.5" noValidate data-testid="predictor-gate-form">
          <div className="grid gap-1.5">
            <Label htmlFor="pg-name">Full Name</Label>
            <Input id="pg-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Aarav Patil" data-testid="predictor-gate-name-input" />
            {err("name")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-phone">Mobile No</Label>
            <div className="flex">
              <span className="grid place-items-center rounded-l-md border border-r-0 bg-slate-50 px-3 text-sm text-slate-500">+91</span>
              <Input id="pg-phone" inputMode="numeric" autoComplete="tel-national" maxLength={14} className="rounded-l-none" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="10-digit mobile" data-testid="predictor-gate-phone-input" />
            </div>
            {err("phone")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-city">City</Label>
            <Input id="pg-city" autoComplete="address-level2" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="e.g. Pune" data-testid="predictor-gate-city-input" />
            {err("city")}
          </div>
          <div className="grid gap-1.5">
            <Label>Are You</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Are you">
              {([["Student", GraduationCap], ["Parent", Users]] as const).map(([r, Icon]) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} data-testid={`predictor-gate-role-${r.toLowerCase()}`}
                  className={cn("flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-[background-color,border-color,color]",
                    role === r ? "border-brand-leaf bg-green-50 text-brand-leaf" : "border-slate-200 text-slate-700 hover:border-slate-300")}>
                  <Icon className="size-4" /> {r}
                </button>
              ))}
            </div>
            {err("role")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pg-college">Which College are you looking for?</Label>
            <Input id="pg-college" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} placeholder="e.g. COEP, PICT, any good college in Pune" data-testid="predictor-gate-college-input" />
            {err("college")}
          </div>
          <Button type="submit" disabled={save.isPending} className="mt-1 h-11 bg-brand-red text-white hover:bg-red-700" data-testid="predictor-gate-submit-button">
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Show my predicted colleges
          </Button>
          <p className="text-center text-[11px] text-slate-400">We never share your number. You'll only be asked once on this device.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
