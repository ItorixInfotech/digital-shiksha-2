import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { PredictorExam } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAM_LABEL: Record<string, string> = { "MHT CET": "MHT CET (Engineering)", "MHT CET Pharmacy": "MHT CET (Pharmacy)" };

/** Score -> the matching predictor (names match the predictor's). Several names show an exam picker; none matching shows a link. */
export default function ExamPredictorBox({ examName, examNames, testid = "exam-predictor" }: { examName?: string; examNames?: string[]; testid?: string }) {
  const nav = useNavigate();
  const exams = useQuery({ queryKey: ["predictor", "exams"], queryFn: () => apiGet<PredictorExam[]>("/predictor/exams") });
  const wanted = examNames ?? (examName ? [examName] : []);
  const options = wanted.map((w) => exams.data?.find((p) => p.name === w)).filter((p): p is PredictorExam => !!p);
  const [picked, setPicked] = useState<string | null>(null);
  const spec = options.find((p) => p.name === picked) ?? options[0];
  const [score, setScore] = useState("");
  const n = Number(score);
  const valid = !!spec && score !== "" && !Number.isNaN(n) && n >= spec.min && n <= spec.max;
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (spec && valid) nav(`/predictor?${new URLSearchParams({ exam: spec.name, score, category: "General", city: "both" })}`);
  };
  const shell = "relative overflow-hidden rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50 p-5 shadow-sm";

  if (exams.isPending) return <div className={cn(shell, "h-36 animate-pulse")} data-testid={`${testid}-box-loading`} />;
  return (
    <div className={shell} data-testid={`${testid}-box`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand-leaf/10 blur-xl" />
      <p className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-leaf to-emerald-500 text-white shadow-md shadow-green-600/30"><Sparkles className="size-4" /></span>
        Check colleges for your score
      </p>
      {spec ? (
        <form onSubmit={submit} className="mt-3" noValidate>
          {options.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Choose exam">
              {options.map((o) => (
                <button key={o.name} type="button" role="radio" aria-checked={o.name === spec.name} onClick={() => { setPicked(o.name); setScore(""); }}
                  className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", o.name === spec.name ? "border-brand-leaf bg-brand-leaf text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-leaf")}
                  data-testid={`${testid}-exam-${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{EXAM_LABEL[o.name] ?? o.name}</button>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-600">Enter your {spec.label} and see which colleges you can get with {EXAM_LABEL[spec.name] ?? spec.name} — High, Good & Reach chances in 30 seconds.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={score} onChange={(ev) => setScore(ev.target.value)} inputMode="decimal" placeholder={`Your ${spec.label}`} aria-label={spec.label}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 outline-none transition-shadow focus:ring-2 focus:ring-brand-leaf/40 sm:flex-1" data-testid={`${testid}-score-input`} />
            <Button type="submit" disabled={!valid} className="h-11 rounded-xl bg-brand-red px-5 font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]" data-testid={`${testid}-submit`}>
              Check my colleges <ArrowRight className="size-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{spec.hint}</p>
          {score !== "" && !valid && <p className="mt-1.5 text-xs text-red-600" data-testid={`${testid}-error`}>Enter a value between {spec.min} and {spec.max}</p>}
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Use our College Predictor for MHT CET, JEE, NEET and MBA CET to see the colleges your score can get.</p>
          <Link to="/predictor" className={cn(buttonVariants(), "h-11 rounded-xl bg-brand-leaf px-5 font-semibold text-white hover:bg-brand-leaf/90")} data-testid={`${testid}-link`}>
            Open College Predictor <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
