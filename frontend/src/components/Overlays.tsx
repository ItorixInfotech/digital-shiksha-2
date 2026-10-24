import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, Sparkles, X, GitCompareArrows } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EnquiryForm from "@/components/EnquiryForm";
import { SITE } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { apiGet } from "@/lib/api";
import type { College } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingActions() {
  return (
    <div className="fixed bottom-5 right-5 z-40 hidden flex-col items-end gap-3 md:flex" data-testid="floating-actions">
      <a href={SITE.whatsappHref} target="_blank" rel="noreferrer" data-testid="floating-whatsapp-button"
        className="group flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow]">
        <MessageCircle className="size-5" />
        <span className="hidden pr-1 text-sm font-semibold sm:group-hover:inline">Chat with Expert</span>
      </a>
      <a href={SITE.phoneHref} data-testid="floating-call-button"
        className="group flex items-center gap-2 rounded-full bg-brand-red p-3.5 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow]">
        <Phone className="size-5" />
        <span className="hidden pr-1 text-sm font-semibold sm:group-hover:inline">Call Expert</span>
      </a>
    </div>
  );
}

/** Phones only: sticky bar with Predictor, Call and WhatsApp (replaces the floating buttons below md). */
export function MobileBottomBar() {
  const { pathname } = useLocation();
  const onPredictor = pathname.startsWith("/predictor");
  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-[transform,background-color] active:scale-95";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(15,23,42,0.12)] backdrop-blur-md md:hidden" data-testid="mobile-bottom-bar" aria-label="Quick actions">
      <div className="flex h-16 items-stretch gap-2 px-2 py-2">
        <Link to="/predictor" data-testid="mobile-bar-predictor"
          className={cn(item, "relative flex-[1.4] flex-row gap-1.5 rounded-xl bg-gradient-to-r from-brand-leaf to-emerald-500 text-sm text-white shadow-md shadow-green-600/30", onPredictor && "ring-2 ring-green-200")}>
          <Sparkles className="size-4" /> Predictor
          <span className="absolute -top-2 right-2 rounded-full bg-yellow-300 px-1.5 text-[9px] font-bold uppercase text-slate-900">Try</span>
        </Link>
        <a href={SITE.phoneHref} data-testid="mobile-bar-call" className={cn(item, "rounded-xl text-brand-red hover:bg-red-50")}>
          <Phone className="size-5" /> Call
        </a>
        <a href={SITE.whatsappHref} target="_blank" rel="noreferrer" data-testid="mobile-bar-whatsapp" className={cn(item, "rounded-xl text-[#128C7E] hover:bg-green-50")}>
          <MessageCircle className="size-5" /> WhatsApp
        </a>
      </div>
    </nav>
  );
}

export function EnquiryDialog() {
  const { enquiry, closeEnquiry } = useSite();
  return (
    <Dialog open={enquiry !== null} onOpenChange={(o) => { if (!o) closeEnquiry(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="enquiry-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl">{enquiry?.title ?? "Get Free Admission Counselling"}</DialogTitle>
          <DialogDescription>
            {enquiry?.college ? `Enquiring about ${enquiry.college}. ` : ""}Share your details and an expert counsellor will call you back.
          </DialogDescription>
        </DialogHeader>
        {enquiry && <EnquiryForm key={`${enquiry.college}-${enquiry.source}`} prefill={enquiry} testid="enquiry-modal" />}
      </DialogContent>
    </Dialog>
  );
}

export function CompareBar() {
  const { compare, toggleCompare, clearCompare } = useSite();
  const loc = useLocation();
  const { data } = useQuery({
    queryKey: ["colleges", "all"],
    queryFn: () => apiGet<College[]>("/colleges"),
    enabled: compare.length > 0,
  });
  if (!compare.length || loc.pathname === "/compare") return null;
  const names = compare.map((s) => data?.find((c) => c.slug === s)?.short_name || s);
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t md:bottom-0 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md animate-fade-up" data-testid="compare-bar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 pr-24 sm:px-6 lg:px-8">
        <GitCompareArrows className="size-5 text-brand-blue" />
        <span className="text-sm font-semibold text-slate-900">Compare ({compare.length}/3)</span>
        <div className="flex flex-wrap gap-2">
          {compare.map((s, i) => (
            <span key={s} className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-brand-blue" data-testid={`compare-bar-item-${s}`}>
              {names[i]}
              <button type="button" aria-label="Remove" data-testid={`compare-bar-remove-${s}`} onClick={() => toggleCompare(s)} className="hover:text-brand-leaf"><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={clearCompare} data-testid="compare-bar-clear-button" className="text-sm text-slate-500 hover:text-slate-900">Clear</button>
          <Link to={`/compare?c=${compare.join(",")}`} data-testid="compare-bar-compare-button" className={cn(buttonVariants(), "bg-brand-navy text-white hover:bg-brand-blue")}>
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );
}
