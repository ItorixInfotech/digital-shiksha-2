import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { apiPost } from "@/lib/api";
import type { AdviceIn, AdviceOut, PredictorIn } from "@/lib/types";
import { aiErrorText } from "@/components/admin/AIButtons";

/** Claude-written personal advice for a paid (unlocked) prediction; cached server-side and added to the PDF. */
export default function PredictorAdvice({ prediction }: { prediction: PredictorIn }) {
  const q = useQuery({
    queryKey: ["predictor", "advice", prediction],
    queryFn: () => apiPost<AdviceOut>("/predictor/advice", { prediction } satisfies AdviceIn),
    staleTime: Infinity,
    retry: false,
  });
  if (q.isError) return null; // advice is a bonus — never block the results
  return (
    <div className="mb-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm animate-fade-up" data-testid="predictor-advice-card">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-navy"><Sparkles className="size-4 text-brand-leaf" /> Your personal advice</p>
      {q.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Writing advice for your result…</p>
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700" data-testid="predictor-advice-text">{q.data.advice}</p>
      )}
      <p className="mt-3 text-[11px] text-slate-400">Written by AI from your result. Also included in your PDF when downloaded after it appears.</p>
    </div>
  );
}
