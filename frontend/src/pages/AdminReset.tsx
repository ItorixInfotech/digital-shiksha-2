import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/Seo";
import { apiPost, ApiError } from "@/lib/api";
import { SITE } from "@/lib/site";
import type { ResetIn } from "@/lib/types";

/** /admin/reset?token=… — opened from the reset email sent to the owner inbox. */
export default function AdminReset() {
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const nav = useNavigate();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const strong = p1.length >= 10 && /[A-Za-z]/.test(p1) && /\d/.test(p1);
  const reset = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/auth/reset", { token, password: p1 } satisfies ResetIn),
    onSuccess: () => { toast.success("Password changed. Please sign in with your new password."); setTimeout(() => nav("/admin/login", { replace: true }), 1200); },
    onError: (e) => {
      const d = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : undefined;
      toast.error(typeof d === "string" ? d : "Could not change the password");
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) return toast.error("Use at least 10 characters with letters and numbers");
    if (p1 !== p2) return toast.error("The two passwords don't match");
    reset.mutate();
  };
  return (
    <div className="grid min-h-screen place-items-center bg-brand-ink px-4" data-testid="admin-reset-page">
      <Seo title="Reset admin password | Digital Shiksha" description="Digital Shiksha admin" noindex />
      <Toaster richColors />
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl animate-fade-up">
        <img src={SITE.logo} alt="Digital Shiksha" className="h-14 w-auto" />
        <h1 className="mt-6 flex items-center gap-2 text-xl font-semibold"><KeyRound className="size-5 text-brand-leaf" /> Set a new admin password</h1>
        {!token ? (
          <p className="mt-3 text-sm text-slate-600" data-testid="admin-reset-missing-token">This link is incomplete. Request a new one from the <Link to="/admin/login" className="font-semibold text-brand-blue">admin login</Link> page.</p>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="rp1">New password</Label><Input id="rp1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} data-testid="admin-reset-password-input" />
              <p className="text-xs text-slate-500">At least 10 characters, with letters and numbers.</p></div>
            <div className="grid gap-1.5"><Label htmlFor="rp2">Confirm new password</Label><Input id="rp2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} data-testid="admin-reset-confirm-input" /></div>
            <Button type="submit" disabled={reset.isPending || reset.isSuccess} className="h-10 bg-brand-red text-white hover:bg-red-700" data-testid="admin-reset-submit-button">
              {reset.isPending && <Loader2 className="size-4 animate-spin" />} Save new password
            </Button>
          </div>
        )}
        <Link to="/admin/login" className="mt-6 block text-center text-sm text-slate-500 hover:text-brand-leaf" data-testid="admin-reset-back-link">← Back to login</Link>
      </form>
    </div>
  );
}
