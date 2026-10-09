import { Link } from "react-router-dom";
import { MapPin, Star, Trophy, IndianRupee, TrendingUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { College } from "@/lib/types";
import { feeRange } from "@/lib/site";
import { useSite } from "@/lib/site-context";

export default function CollegeCard({ c, layout = "grid" }: { c: College; layout?: "grid" | "row" }) {
  const { compare, toggleCompare, openEnquiry } = useSite();
  const checked = compare.includes(c.slug);
  const row = layout === "row";

  return (
    <article
      data-testid={`college-card-${c.slug}`}
      className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg transition-[transform,box-shadow,border-color] duration-200 ${row ? "sm:flex" : "flex flex-col"}`}
    >
      <Link to={`/colleges/${c.slug}`} className={`relative block shrink-0 overflow-hidden ${row ? "h-44 sm:h-auto sm:w-60" : "h-40"}`} data-testid={`college-card-image-link-${c.slug}`}>
        <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {c.nirf_rank ? (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-bold text-brand-navy shadow">
            <Trophy className="size-3.5 text-amber-500" /> NIRF #{c.nirf_rank}
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 rounded-md bg-brand-navy/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">{c.type}</span>
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/colleges/${c.slug}`} data-testid={`college-card-name-${c.slug}`} className="line-clamp-2 text-[17px] font-semibold leading-snug text-slate-900 hover:text-brand-red transition-colors">
              {c.name}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-3.5" /> {c.city}, {c.state}{c.established ? ` • Est. ${c.established}` : ""}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-sm font-semibold text-green-700"><Star className="size-3.5 fill-current" />{c.rating.toFixed(1)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div>
            <p className="flex items-center gap-1 text-xs text-slate-500"><IndianRupee className="size-3" /> Fees (1st yr)</p>
            <p className="mt-0.5 font-semibold text-slate-900" data-testid={`college-card-fees-${c.slug}`}>{feeRange(c.fees_min, c.fees_max)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-slate-500"><TrendingUp className="size-3" /> Avg package</p>
            <p className="mt-0.5 font-semibold text-slate-900">{c.avg_package ? `₹${c.avg_package} LPA` : "—"}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.exams_accepted.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-brand-blue">{e}</span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={checked} onCheckedChange={() => toggleCompare(c.slug)} data-testid={`compare-checkbox-${c.slug}`} />
            Compare
          </label>
          <Button size="sm" data-testid={`college-card-enquire-${c.slug}`} onClick={() => openEnquiry({ college: c.name, source: "college-card", title: `Apply to ${c.short_name || c.name}` })}
            className="bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">
            Apply / Enquire
          </Button>
        </div>
      </div>
    </article>
  );
}
