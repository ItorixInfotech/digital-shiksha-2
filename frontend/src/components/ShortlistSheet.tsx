import { Link } from "react-router-dom";
import { Heart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSite } from "@/lib/site-context";
import { useShortlist } from "@/lib/shortlist";
import { formatINR } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Heart button with saved-count badge that opens the student's shortlist (used in the pinned mobile bar and desktop toolbar). */
export default function ShortlistSheet({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { list, remove, clear } = useShortlist();
  const { openEnquiry } = useSite();
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" aria-label={`Saved colleges (${list.length})`}
        className={cn("relative shrink-0 bg-white transition-colors", list.length && "border-brand-red text-brand-red", compact && "size-8 px-0", className)} data-testid={compact ? "sticky-shortlist-button" : "shortlist-button"} />}>
        <Heart className={cn("size-4", list.length && "fill-current")} />
        {!compact && <span>Saved</span>}
        {list.length > 0 && (
          <span className={cn("grid min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-4 text-white", compact && "absolute -right-1.5 -top-1.5")} data-testid={compact ? "sticky-shortlist-count" : "shortlist-count"}>{list.length}</span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col p-0" data-testid="shortlist-sheet">
        <div className="border-b p-5">
          <SheetTitle className="flex items-center gap-2"><Heart className="size-4 fill-brand-red text-brand-red" /> My shortlist ({list.length})</SheetTitle>
          <p className="mt-1 text-xs text-slate-500">Saved on this device. Tap the heart on any college card to add it.</p>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {list.length === 0 ? (
            <div className="grid place-items-center gap-2 py-16 text-center text-sm text-slate-500" data-testid="shortlist-empty">
              <Heart className="size-8 text-slate-300" /> No colleges saved yet.
            </div>
          ) : list.map((c) => (
            <div key={c.slug} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 transition-colors hover:border-slate-300" data-testid={`shortlist-item-${c.slug}`}>
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50">
                {c.logo ? <img src={c.logo} alt="" className="max-h-10 max-w-10 object-contain" /> : c.image ? <img src={c.image} alt="" className="size-full object-cover" /> : <Heart className="size-4 text-slate-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/colleges/${c.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-brand-leaf" data-testid={`shortlist-link-${c.slug}`}>{c.name}</Link>
                <p className="text-xs text-slate-500">{c.city}{c.fees_min ? ` · ${formatINR(c.fees_min)}/yr` : ""}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove(c.slug)} className="text-slate-400 hover:text-red-600" data-testid={`shortlist-remove-${c.slug}`}><X className="size-4" /></Button>
            </div>
          ))}
        </div>
        {list.length > 0 && (
          <div className="space-y-2 border-t p-4">
            <Button className="w-full bg-brand-red text-white hover:bg-red-700" onClick={() => openEnquiry({ college: list[0].name, source: "shortlist", title: "Counselling for my shortlist", message: `My shortlist: ${list.slice(0, 8).map((c) => c.name).join(", ")}` })} data-testid="shortlist-enquire-button">
              Get free counselling for these colleges
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-slate-500" onClick={() => { if (window.confirm("Remove all saved colleges?")) clear(); }} data-testid="shortlist-clear-button">
              <Trash2 className="size-3.5" /> Clear shortlist
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
