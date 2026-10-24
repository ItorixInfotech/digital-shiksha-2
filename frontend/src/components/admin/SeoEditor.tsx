import { Globe, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DESC_MAX, TITLE_MAX } from "@/lib/seo";
import { cn } from "@/lib/utils";

export interface SeoForm {
  meta_title: string;
  meta_description: string;
  keywords: string; // comma-separated while editing
  canonical_url: string;
  og_image: string;
  noindex: boolean;
}

interface Props {
  value: SeoForm;
  onChange: (v: SeoForm) => void;
  defaults: { title: string; description: string; keywords?: string[] };
  path: string;
  testid: string;
  advanced?: boolean; // keywords + canonical (entity pages)
}

function Counter({ n, max, min, testid }: { n: number; max: number; min: number; testid: string }) {
  const tone = n === 0 ? "text-slate-400" : n > max ? "text-red-600" : n < min ? "text-amber-600" : "text-green-700";
  return <span className={cn("text-xs font-medium tabular-nums transition-colors", tone)} data-testid={testid}>{n}/{max}{n > max ? " · too long" : n > 0 && n < min ? " · a bit short" : n > 0 ? " · good" : " · using auto"}</span>;
}

/** On-page SEO fields + live Google search preview. Empty fields fall back to the auto-generated defaults shown as placeholders. */
export default function SeoEditor({ value, onChange, defaults, path, testid, advanced = true }: Props) {
  const set = (k: keyof SeoForm, v: string | boolean) => onChange({ ...value, [k]: v });
  const title = value.meta_title || defaults.title;
  const desc = value.meta_description || defaults.description;
  const host = window.location.host;
  const crumbs = path.split("/").filter(Boolean).join(" › ");

  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-2" data-testid={testid}>
      <div className="flex items-center gap-2">
        <Search className="size-4 text-brand-blue" />
        <h3 className="text-sm font-semibold text-slate-900">On-page SEO</h3>
        <span className="text-xs text-slate-500">Leave blank to use the smart auto-generated value</span>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" data-testid={`${testid}-google-preview`}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Google preview</p>
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-slate-100"><Globe className="size-3.5 text-slate-500" /></span>
          <div className="leading-tight"><p className="text-sm text-slate-800">Digital Shiksha</p><p className="text-xs text-slate-500">{host}{crumbs ? ` › ${crumbs}` : ""}</p></div>
        </div>
        <p className="mt-1.5 line-clamp-1 text-[19px] leading-snug text-[#1a0dab]" data-testid={`${testid}-preview-title`}>{title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-[#4d5156]" data-testid={`${testid}-preview-description`}>{desc.length > DESC_MAX ? `${desc.slice(0, DESC_MAX - 1)}…` : desc}</p>
        {value.noindex && <p className="mt-2 text-xs font-semibold text-red-600">Hidden from Google (noindex)</p>}
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between"><Label htmlFor={`${testid}-title`}>Meta title</Label><Counter n={value.meta_title.length} max={TITLE_MAX} min={30} testid={`${testid}-title-count`} /></div>
        <Input id={`${testid}-title`} value={value.meta_title} placeholder={defaults.title} maxLength={120} onChange={(e) => set("meta_title", e.target.value)} data-testid={`${testid}-title-input`} />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between"><Label htmlFor={`${testid}-desc`}>Meta description</Label><Counter n={value.meta_description.length} max={DESC_MAX} min={70} testid={`${testid}-description-count`} /></div>
        <Textarea id={`${testid}-desc`} rows={3} value={value.meta_description} placeholder={defaults.description} maxLength={320} onChange={(e) => set("meta_description", e.target.value)} data-testid={`${testid}-description-input`} />
      </div>
      <div className={cn("grid gap-4", advanced && "sm:grid-cols-2")}>
        {advanced && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${testid}-kw`}>Focus keywords</Label>
            <Input id={`${testid}-kw`} value={value.keywords} placeholder={defaults.keywords?.slice(0, 3).join(", ")} onChange={(e) => set("keywords", e.target.value)} data-testid={`${testid}-keywords-input`} />
            <p className="text-xs text-slate-500">Comma-separated</p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${testid}-og`}>Social share image (OG) URL</Label>
          <Input id={`${testid}-og`} value={value.og_image} placeholder="https://… (1200×630 recommended)" onChange={(e) => set("og_image", e.target.value)} data-testid={`${testid}-og-image-input`} />
        </div>
        {advanced && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`${testid}-canon`}>Canonical URL</Label>
            <Input id={`${testid}-canon`} value={value.canonical_url} placeholder={`${window.location.origin}${path}`} onChange={(e) => set("canonical_url", e.target.value)} data-testid={`${testid}-canonical-input`} />
            <p className="text-xs text-slate-500">Only set this if the same content lives at another URL.</p>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={value.noindex} onCheckedChange={(c) => set("noindex", Boolean(c))} data-testid={`${testid}-noindex-checkbox`} />
        Hide this page from Google (noindex) — also removes it from sitemap.xml
      </label>
    </div>
  );
}
