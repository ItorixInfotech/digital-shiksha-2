import { CheckCircle2, XCircle } from "lucide-react";
import type { SeoScore } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TONE = { green: "bg-green-50 text-green-800 ring-green-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", red: "bg-red-50 text-red-700 ring-red-200" };
const DOT = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" };

/** Coloured SEO score pill; hover/focus shows the checklist of what to fix. */
export default function SeoBadge({ score, testid }: { score: SeoScore; testid: string }) {
  return (
    <span className="group relative inline-flex" data-testid={testid}>
      <button type="button" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2", TONE[score.level])} aria-label={`SEO score ${score.score}`}>
        <span className={cn("size-1.5 rounded-full", DOT[score.level])} />{score.score}
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-72 translate-y-1 rounded-xl bg-brand-ink p-3 text-left text-xs font-normal text-slate-200 opacity-0 shadow-xl transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100" data-testid={`${testid}-tooltip`}>
        <span className="mb-1.5 block font-semibold text-white">SEO checklist — {score.passed}/{score.checks.length} passed</span>
        {score.checks.map((c) => (
          <span key={c.label} className="flex items-start gap-1.5 py-0.5">
            {c.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-green-400" /> : <XCircle className="mt-px size-3.5 shrink-0 text-red-400" />}
            <span className={c.ok ? "text-slate-400" : "text-white"}>{c.ok ? c.label : c.fix}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
