import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSiteSchema } from "@/components/Seo";
import { apiPut, ApiError } from "@/lib/api";
import { siteLd } from "@/lib/seo";
import type { SiteSchema, SiteSchemaSaveOut } from "@/lib/types";

type TextKey = "name" | "legal_name" | "logo" | "phone" | "email" | "street_address" | "locality" | "region" | "postal_code" | "country" | "price_range"
  | "facebook" | "instagram" | "youtube" | "linkedin" | "twitter";

export default function SiteSchemaPanel() {
  const qc = useQueryClient();
  const saved = useSiteSchema();
  const [draft, setDraft] = useState<SiteSchema | null>(null);
  const [issues, setIssues] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
  const s = draft ?? saved.data;
  const save = useMutation({
    mutationFn: (body: SiteSchema) => apiPut<SiteSchemaSaveOut>("/admin/site-schema", body),
    onSuccess: (r) => { setDraft(null); setIssues({ errors: [], warnings: r.warnings }); qc.setQueryData(["site-schema"], r.site); toast.success("Published. Every page now carries these details."); },
    onError: (e) => {
      const d = e instanceof ApiError && e.body && typeof e.body === "object" ? (e.body as { detail?: unknown }).detail : null;
      if (d && typeof d === "object" && "errors" in d) { setIssues(d as { errors: string[]; warnings: string[] }); toast.error("Fix the errors below before publishing"); }
      else toast.error("Could not save. Check the fields and try again.");
    },
  });
  if (!s) return <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500" data-testid="site-schema-loading">Loading site details…</div>;
  const set = (patch: Partial<SiteSchema>) => setDraft({ ...s, ...patch });
  const text = (k: TextKey, label: string, placeholder = "", span = false) => (
    <div className={span ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"}>
      <Label htmlFor={`site-${k}`}>{label}</Label>
      <Input id={`site-${k}`} value={s[k]} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value })} data-testid={`site-schema-${k.replace(/_/g, "-")}`} />
    </div>
  );
  const num = (k: "latitude" | "longitude", label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`site-${k}`}>{label}</Label>
      <Input id={`site-${k}`} inputMode="decimal" value={s[k] ?? ""} onChange={(e) => { const v = e.target.value.trim(); set({ [k]: v === "" || Number.isNaN(Number(v)) ? null : Number(v) }); }} data-testid={`site-schema-${k}`} />
    </div>
  );
  const preview = JSON.stringify(siteLd(s), null, 2);

  return (
    <div className="grid gap-6 xl:grid-cols-12" data-testid="site-schema-panel">
      <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm xl:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Site-wide schema</h2>
            <p className="mt-1 text-sm text-slate-500">Set your business details once. They're added as Organization and LocalBusiness schema to every page Google can index. A page's own block in Page Manager still overrides them.</p>
          </div>
          <Button disabled={save.isPending || !draft} onClick={() => save.mutate(s)} className="bg-brand-navy text-white" data-testid="site-schema-save">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Validate & publish
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>Add Organization schema to every page</span><Checkbox checked={s.apply_organization} onCheckedChange={(v) => set({ apply_organization: Boolean(v) })} data-testid="site-schema-apply-organization" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>Add LocalBusiness schema to every page</span><Checkbox checked={s.apply_local_business} onCheckedChange={(v) => set({ apply_local_business: Boolean(v) })} data-testid="site-schema-apply-local-business" />
          </label>
        </div>

        <Group title="Business">
          {text("name", "Business name")}
          <div className="grid gap-1.5"><Label>Organization type</Label>
            <Select value={s.org_type} onValueChange={(v: string) => set({ org_type: v as SiteSchema["org_type"] })}>
              <SelectTrigger className="w-full" data-testid="site-schema-org-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="EducationalOrganization">EducationalOrganization</SelectItem><SelectItem value="Organization">Organization</SelectItem></SelectContent>
            </Select>
          </div>
          {text("legal_name", "Registered / legal name (optional)")}
          {text("price_range", "Price range (optional)", "e.g. Free – ₹₹")}
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="site-description">Short description</Label>
            <Textarea id="site-description" rows={2} maxLength={400} value={s.description} onChange={(e) => set({ description: e.target.value })} placeholder="Admission counselling for engineering, medical and management colleges in Pune & Mumbai." data-testid="site-schema-description" /></div>
          {text("logo", "Logo URL", "https://www.digitalshiksha.in/logo.png", true)}
        </Group>

        <Group title="Contact & address">
          {text("phone", "Phone", "+91-8149689468")}
          {text("email", "Email")}
          {text("street_address", "Street address", "Office no., building, road", true)}
          {text("locality", "City")}
          {text("region", "State")}
          {text("postal_code", "PIN code", "411001")}
          {text("country", "Country code", "IN")}
          {num("latitude", "Latitude (map pin)")}
          {num("longitude", "Longitude (map pin)")}
        </Group>

        <Group title="Opening hours">
          <div className="space-y-2 sm:col-span-2" data-testid="site-schema-hours">
            {s.opening_hours.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input value={h} onChange={(e) => set({ opening_hours: s.opening_hours.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Mo-Sa 10:00-19:00" data-testid={`site-schema-hours-${i}`} />
                <Button variant="ghost" size="icon" aria-label="Remove hours" onClick={() => set({ opening_hours: s.opening_hours.filter((_, j) => j !== i) })} data-testid={`site-schema-hours-remove-${i}`}><X className="size-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set({ opening_hours: [...s.opening_hours, "Su 10:00-14:00"] })} data-testid="site-schema-hours-add"><Plus className="size-4" /> Add hours</Button>
            <p className="text-xs text-slate-500">Days: Mo Tu We Th Fr Sa Su. Use a range like “Mo-Sa 10:00-19:00”, or a list like “Mo,We,Fr 09:00-13:00”.</p>
          </div>
        </Group>

        <Group title="Social links (shown to Google as sameAs)">
          {text("facebook", "Facebook page", "https://www.facebook.com/…", true)}
          {text("instagram", "Instagram page", "https://www.instagram.com/…", true)}
          {text("youtube", "YouTube channel", "https://www.youtube.com/@…")}
          {text("linkedin", "LinkedIn page", "https://www.linkedin.com/company/…")}
          {text("twitter", "X / Twitter", "https://x.com/…", true)}
        </Group>

        {(issues.errors.length > 0 || issues.warnings.length > 0) && (
          <div className="space-y-1 rounded-xl border p-3 text-sm" data-testid="site-schema-issues">
            {issues.errors.map((e) => <p key={e} className="flex gap-2 text-red-700"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {e}</p>)}
            {issues.warnings.map((w) => <p key={w} className="flex gap-2 text-amber-700"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}</p>)}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-slate-950 p-4 text-slate-100 shadow-sm xl:sticky xl:top-4 xl:col-span-5 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What every page will output</p>
        <pre className="mt-2 max-h-[70vh] overflow-auto text-[11px] leading-relaxed" data-testid="site-schema-preview">{preview === "[]" ? "// Both schema types are switched off" : preview}</pre>
        {saved.data?.updated_at && <p className="mt-2 text-[11px] text-slate-400" data-testid="site-schema-updated">Last published {new Date(saved.data.updated_at).toLocaleString("en-IN")}</p>}
      </section>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t pt-4">
      <legend className="pr-2 text-sm font-semibold text-slate-800">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
