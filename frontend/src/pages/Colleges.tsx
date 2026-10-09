import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X, Search } from "lucide-react";
import CollegeCard from "@/components/CollegeCard";
import { CardSkeleton, EmptyState, PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import type { College, FacetCount, Meta } from "@/lib/types";
import { slugify } from "@/lib/site";
import { cn } from "@/lib/utils";

const FEES = [["", "Any budget"], ["100000", "Under ₹1 Lakh"], ["300000", "Under ₹3 Lakh"], ["1000000", "Under ₹10 Lakh"]] as const;
const SORTS: Record<string, string> = { rank: "NIRF Rank", rating: "Rating", package: "Highest avg package", fees: "Lowest fees" };
const FILTER_KEYS = ["stream", "city", "state", "type", "max_fees", "q"] as const;

function FacetGroup({ title, param, items, value, onPick }: { title: string; param: string; items: FacetCount[]; value: string; onPick: (k: string, v: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 7);
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-2 grid gap-0.5">
        {shown.map((f) => {
          const active = value === f.name;
          return (
            <button key={f.name} type="button" data-testid={`filter-${param}-${slugify(f.name)}`} onClick={() => onPick(param, active ? "" : f.name)}
              className={cn("flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors", active ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-slate-50")}>
              <span>{f.name}</span><span className="text-xs text-slate-400">{f.count}</span>
            </button>
          );
        })}
      </div>
      {items.length > 7 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 px-2.5 text-xs font-semibold text-brand-blue" data-testid={`filter-${param}-toggle-more`}>{all ? "Show less" : `+${items.length - 7} more`}</button>
      )}
    </div>
  );
}

export default function Colleges() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const get = (k: string) => sp.get(k) ?? "";
  const sort = get("sort") || "rank";

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };
  const clear = () => { setQ(""); setSp(new URLSearchParams(), { replace: true }); };

  const qs = new URLSearchParams();
  FILTER_KEYS.forEach((k) => { if (get(k)) qs.set(k, get(k)); });
  qs.set("sort", sort);

  const meta = useQuery({ queryKey: ["meta"], queryFn: () => apiGet<Meta>("/meta") });
  const list = useQuery({ queryKey: ["colleges", "list", qs.toString()], queryFn: () => apiGet<College[]>(`/colleges?${qs.toString()}`) });
  const active = FILTER_KEYS.filter((k) => get(k));

  const filters = (
    <div className="space-y-6" data-testid="college-filters">
      <FacetGroup title="Stream" param="stream" items={meta.data?.streams ?? []} value={get("stream")} onPick={set} />
      <FacetGroup title="City" param="city" items={meta.data?.cities ?? []} value={get("city")} onPick={set} />
      <FacetGroup title="State" param="state" items={meta.data?.states ?? []} value={get("state")} onPick={set} />
      <FacetGroup title="Ownership" param="type" items={meta.data?.types ?? []} value={get("type")} onPick={set} />
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Fees (starting)</h4>
        <div className="mt-2 grid gap-0.5">
          {FEES.map(([v, l]) => (
            <button key={l} type="button" data-testid={`filter-fees-${v || "any"}`} onClick={() => set("max_fees", v)}
              className={cn("rounded-md px-2.5 py-1.5 text-left text-sm transition-colors", get("max_fees") === v ? "bg-red-50 font-semibold text-brand-red" : "text-slate-600 hover:bg-slate-50")}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const heading = get("stream") ? `Top ${get("stream")} Colleges${get("city") ? ` in ${get("city")}` : " in India"}` : get("city") ? `Top Colleges in ${get("city")}` : "Top Colleges in India 2026";

  return (
    <div data-testid="colleges-page">
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Colleges" }]} title={heading} subtitle="Compare fees, NIRF rankings, cutoffs and placements. Shortlist up to 3 colleges to compare side-by-side." testid="colleges-header">
        <form onSubmit={(e) => { e.preventDefault(); set("q", q.trim()); }} className="mt-6 flex max-w-xl items-center gap-2 rounded-xl bg-white p-1.5 pl-3">
          <Search className="size-4 text-slate-400" />
          <input data-testid="colleges-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by college name or city" className="h-9 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
          <Button type="submit" data-testid="colleges-search-button" className="bg-brand-red text-white hover:bg-red-700">Search</Button>
        </form>
      </PageHeader>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:px-8">
        <aside className="sticky top-32 hidden rounded-2xl border bg-white p-5 lg:col-span-3 lg:block">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-slate-900">Filters</p>
            {active.length > 0 && <button type="button" onClick={clear} className="text-xs font-semibold text-brand-red" data-testid="filters-clear-button">Clear all</button>}
          </div>
          {filters}
        </aside>

        <div className="space-y-5 lg:col-span-9">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600" data-testid="colleges-result-count">
              {list.isLoading ? "Loading…" : list.isError ? "Couldn't load colleges" : <><span className="font-semibold text-slate-900">{list.data?.length ?? 0}</span> colleges found</>}
            </p>
            <Sheet>
              <SheetTrigger render={<Button variant="outline" size="sm" className="lg:hidden" data-testid="mobile-filters-button" />}>
                <SlidersHorizontal className="size-4" /> Filters
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto p-5">
                <SheetTitle>Filters</SheetTitle>
                {filters}
              </SheetContent>
            </Sheet>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-slate-500">Sort by</span>
              <Select value={sort} onValueChange={(v: string) => set("sort", v)}>
                <SelectTrigger size="sm" className="w-44 bg-white" data-testid="colleges-sort-select"><SelectValue>{(v) => SORTS[v as string]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(SORTS).map(([k, l]) => <SelectItem key={k} value={k} data-testid={`colleges-sort-${k}`}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {active.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {active.map((k) => (
                <button key={k} type="button" onClick={() => { if (k === "q") setQ(""); set(k, ""); }} data-testid={`active-filter-${k}`} className="flex items-center gap-1 rounded-full bg-brand-navy px-3 py-1 text-xs font-medium text-white hover:bg-brand-blue transition-colors">
                  {k === "max_fees" ? FEES.find(([v]) => v === get(k))?.[1] : get(k)} <X className="size-3" />
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-5">
            {list.isLoading ? <div className="grid gap-5 md:grid-cols-2"><CardSkeleton count={4} /></div>
              : list.isError ? <EmptyState title="Colleges are unavailable right now" body="Please try again shortly or call +91 8149 68 9468." testid="colleges-error" />
              : list.data && list.data.length ? list.data.map((c) => <CollegeCard key={c.id} c={c} layout="row" />)
              : <EmptyState title="No colleges match these filters" body="Try removing a filter or searching a different city." testid="colleges-empty" />}
          </div>
        </div>
      </div>
    </div>
  );
}
