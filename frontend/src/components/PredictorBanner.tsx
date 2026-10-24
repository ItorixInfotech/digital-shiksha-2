import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { PredictorExam } from "@/lib/types";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/site";

const SHORT: Record<string, string> = { "MHT CET": "MHT CET (Engg)", "MHT CET Pharmacy": "MHT CET (Pharmacy)" };

/** Home-page hook: pick exam + score and jump straight into a prediction (/predictor?exam=&score= runs it). */
export default function PredictorBanner() {
  const nav = useNavigate();
  const exams = useQuery({ queryKey: ["predictor", "exams"], queryFn: () => apiGet<PredictorExam[]>("/predictor/exams") });
  const [exam, setExam] = useState("MHT CET");
  const [score, setScore] = useState("");
  const spec = exams.data?.find((e) => e.name === exam);
  const n = Number(score);
  const valid = score !== "" && !Number.isNaN(n) && (!spec || (n >= spec.min && n <= spec.max));
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    nav(valid ? `/predictor?${new URLSearchParams({ exam, score, category: "General", city: "both" })}` : `/predictor?exam=${encodeURIComponent(exam)}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-green-700 via-brand-leaf to-emerald-600 text-white" data-testid="home-predictor-banner">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-yellow-300/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-8 lg:py-7">
        <div className="lg:col-span-5">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25"><Sparkles className="size-3.5 text-yellow-300" /> College Predictor</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl" data-testid="home-predictor-banner-title">
            Find your college in <span className="text-yellow-300">30 seconds</span>
          </h2>
          <p className="mt-1.5 text-sm text-green-50">Enter your exam and score — see your High, Good & Reach chances from official cut-offs.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-100">
            <span className="flex items-center gap-1"><Clock3 className="size-3.5" /> Takes 30 seconds</span>
            <span className="flex items-center gap-1"><ShieldCheck className="size-3.5" /> Official CAP cut-offs</span>
          </div>
        </div>
        <form onSubmit={go} className="rounded-2xl bg-white/95 p-3 text-slate-900 shadow-2xl shadow-green-950/30 ring-1 ring-white/40 backdrop-blur lg:col-span-7" data-testid="home-predictor-banner-form">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Entrance exam">
            {(exams.data ?? []).map((e) => (
              <button key={e.name} type="button" role="radio" aria-checked={exam === e.name} onClick={() => setExam(e.name)} data-testid={`home-predictor-exam-${slugify(e.name)}`}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,color]",
                  exam === e.name ? "border-brand-leaf bg-brand-leaf text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-leaf hover:text-brand-leaf")}>
                {SHORT[e.name] ?? e.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="decimal" data-testid="home-predictor-score-input"
              placeholder={spec ? `Your ${spec.label}` : "Your score / percentile"} aria-label={spec?.label ?? "Score"}
              className="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 text-base sm:flex-1 outline-none transition-shadow focus:ring-2 focus:ring-brand-leaf/40" />
            <Button type="submit" className="h-12 rounded-xl bg-brand-red px-6 text-base font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]" data-testid="home-predictor-banner-submit">
              Predict my college <ArrowRight className="size-4" />
            </Button>
          </div>
          {score !== "" && !valid && spec && <p className="mt-1.5 text-xs text-red-600" data-testid="home-predictor-banner-error">Enter a value between {spec.min} and {spec.max}</p>}
        </form>
      </div>
    </section>
  );
}
