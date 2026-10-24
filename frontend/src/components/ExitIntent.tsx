import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SHOWN_KEY = "ds_exit_intent_v1"; // sessionStorage: once per visit
const TRIED_KEY = "ds_predictor_tried_v1"; // sessionStorage: visitor opened the predictor this visit

/** Desktop exit-intent: when the mouse leaves through the top of the window (towards tabs / close), invite them to the predictor once. */
export default function ExitIntent() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (pathname.startsWith("/predictor")) sessionStorage.setItem(TRIED_KEY, "1"); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    if (!desktop || pathname.startsWith("/admin")) return;
    const armedAt = Date.now() + 5000; // ignore the first 5 s on a page
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0 || Date.now() < armedAt) return;
      if (sessionStorage.getItem(SHOWN_KEY) || sessionStorage.getItem(TRIED_KEY)) return;
      sessionStorage.setItem(SHOWN_KEY, "1");
      setOpen(true);
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md" data-testid="exit-intent-dialog">
        <div className="relative bg-gradient-to-br from-green-700 via-brand-leaf to-emerald-500 px-6 pb-6 pt-7 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-yellow-300/25 blur-2xl" />
          <span className="grid size-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30"><Sparkles className="size-5 text-yellow-300" /></span>
          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="text-2xl font-extrabold text-white">Wait — which colleges can you get?</DialogTitle>
            <DialogDescription className="text-green-50">Before you go, enter your exam score and see your college chances from official cut-offs.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid gap-3 p-6">
          <p className="flex items-center gap-2 text-sm text-slate-600"><Clock3 className="size-4 text-brand-leaf" /> MHT CET, JEE, NEET & MBA CET — takes 30 seconds</p>
          <Link to="/predictor" onClick={() => setOpen(false)} data-testid="exit-intent-cta"
            className={cn(buttonVariants(), "h-12 rounded-xl bg-brand-red text-base font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700")}>
            Try the College Predictor <ArrowRight className="size-4" />
          </Link>
          <button type="button" onClick={() => setOpen(false)} data-testid="exit-intent-dismiss" className="text-sm text-slate-500 transition-colors hover:text-slate-800">No thanks</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
