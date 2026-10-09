import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Plus, X } from "lucide-react";
import { PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import type { College } from "@/lib/types";
import { feeRange } from "@/lib/site";
import { MAX_COMPARE, useSite } from "@/lib/site-context";

const ROWS: [string, (c: College) => string][] = [
  ["Location", (c) => `${c.city}, ${c.state}`],
  ["Ownership", (c) => c.type],
  ["Established", (c) => (c.established ? String(c.established) : "—")],
  ["NIRF Rank", (c) => (c.nirf_rank ? `#${c.nirf_rank}` : "—")],
  ["Rating", (c) => `${c.rating.toFixed(1)} / 5`],
  ["Fees (1st year)", (c) => feeRange(c.fees_min, c.fees_max)],
  ["Average package", (c) => (c.avg_package ? `₹${c.avg_package} LPA` : "—")],
  ["Highest package", (c) => (c.highest_package ? `₹${c.highest_package} LPA` : "—")],
  ["Placement rate", (c) => (c.placement_rate ? `${c.placement_rate}%` : "—")],
  ["Exams accepted", (c) => c.exams_accepted.join(", ")],
  ["Streams", (c) => c.streams.join(", ")],
  ["Approvals", (c) => c.approvals.join(", ")],
  ["Top recruiters", (c) => c.top_recruiters.slice(0, 5).join(", ")],
];

export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const { compare, toggleCompare, openEnquiry, setCompareList } = useSite();
  const { data, isLoading } = useQuery({ queryKey: ["colleges", "all"], queryFn: () => apiGet<College[]>("/colleges") });

  // URL ?c= wins on first load (shareable links), then the URL mirrors the shortlist.
  useEffect(() => {
    const fromUrl = (sp.get("c") ?? "").split(",").filter(Boolean);
    if (fromUrl.length) setCompareList(fromUrl.slice(0, MAX_COMPARE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setSp(compare.length ? { c: compare.join(",") } : {}, { replace: true }); }, [compare, setSp]);

  const selected = compare.map((s) => data?.find((c) => c.slug === s)).filter((c): c is College => !!c);
  const options = (data ?? []).filter((c) => !compare.includes(c.slug));

  return (
    <div data-testid="compare-page">
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Compare Colleges" }]} title="Compare colleges side-by-side" subtitle="Pick up to 3 colleges and compare rankings, fees, placements and admission criteria." testid="compare-header" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {compare.length < MAX_COMPARE && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
            <Plus className="size-5 text-brand-red" />
            <span className="text-sm font-semibold">Add a college</span>
            <Select value="" onValueChange={(v: string) => v && toggleCompare(v)}>
              <SelectTrigger className="w-full bg-white sm:w-96" data-testid="compare-add-select"><SelectValue>{() => <span className="text-slate-400">{isLoading ? "Loading…" : "Select college to compare"}</span>}</SelectValue></SelectTrigger>
              <SelectContent>
                {options.map((c) => <SelectItem key={c.slug} value={c.slug} data-testid={`compare-add-option-${c.slug}`}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {selected.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed bg-white p-12 text-center" data-testid="compare-empty">
            <p className="text-lg font-semibold">No colleges selected yet</p>
            <p className="mt-1 text-sm text-slate-500">Use the selector above or tick “Compare” on any college card.</p>
            <Link to="/colleges" className="mt-4 inline-block font-semibold text-brand-red" data-testid="compare-browse-link">Browse colleges →</Link>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border bg-white" data-testid="compare-table">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-48 p-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">College</th>
                  {selected.map((c) => (
                    <th key={c.slug} className="p-4 text-left align-top" data-testid={`compare-col-${c.slug}`}>
                      <div className="relative">
                        <img src={c.image} alt="" className="h-24 w-full rounded-lg object-cover" />
                        <button type="button" aria-label="Remove" onClick={() => toggleCompare(c.slug)} data-testid={`compare-remove-${c.slug}`} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-slate-700 shadow hover:text-brand-red"><X className="size-4" /></button>
                      </div>
                      <Link to={`/colleges/${c.slug}`} className="mt-3 block font-semibold text-slate-900 hover:text-brand-red">{c.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, fn], i) => (
                  <tr key={label} className={i % 2 ? "bg-slate-50/60" : ""}>
                    <td className="p-4 font-medium text-slate-500">{label}</td>
                    {selected.map((c) => <td key={c.slug} className="p-4 text-slate-800">{fn(c)}</td>)}
                  </tr>
                ))}
                <tr>
                  <td className="p-4" />
                  {selected.map((c) => (
                    <td key={c.slug} className="p-4"><Button data-testid={`compare-apply-${c.slug}`} onClick={() => openEnquiry({ college: c.name, source: "compare", title: `Apply to ${c.short_name}` })} className="w-full bg-brand-red text-white hover:bg-red-700">Apply Now</Button></td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
