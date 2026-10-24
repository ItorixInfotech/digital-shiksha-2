import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "ds_predictor_nudge_v1"; // sessionStorage: shown/dismissed once per visit

/** Friendly invitation after 20 s on a college page (once per browser session). */
export default function PredictorNudge({ collegeName }: { collegeName: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    const t = window.setTimeout(() => { sessionStorage.setItem(KEY, "1"); setShow(true); }, 20_000);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <aside role="dialog" aria-label="Try the College Predictor" data-testid="predictor-nudge"
      className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-green-200 bg-white/95 p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-md animate-fade-up md:inset-x-auto md:bottom-6 md:left-6 md:w-[360px]">
      <button type="button" onClick={() => setShow(false)} aria-label="Close" data-testid="predictor-nudge-close"
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X className="size-4" /></button>
      <div className="flex gap-3 pr-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-leaf to-emerald-500 text-white shadow-md shadow-green-600/30"><Sparkles className="size-5" /></span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">Can you get into {collegeName}?</p>
          <p className="mt-0.5 text-sm text-slate-600">Enter your score and see your chances here and at similar colleges — it takes 30 seconds.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link to="/predictor" onClick={() => setShow(false)} data-testid="predictor-nudge-cta"
          className={cn(buttonVariants(), "h-10 flex-1 bg-brand-leaf font-semibold text-white hover:bg-brand-leaf/90")}>Check my chances</Link>
        <button type="button" onClick={() => setShow(false)} data-testid="predictor-nudge-later" className="h-10 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-100">Maybe later</button>
      </div>
    </aside>
  );
}
