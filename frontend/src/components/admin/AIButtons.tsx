import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost, ApiError } from "@/lib/api";
import type { AIContentIn, AIContentOut, AIKind, AIFacts, AISeoIn, AISeoOut } from "@/lib/types";

export const aiErrorText = (e: unknown) => {
  const d = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : undefined;
  return typeof d === "string" ? d : "AI could not answer right now — please try again";
};

/** Keep only plain values as facts for the prompt. */
export const toFacts = (o: Record<string, unknown>): AIFacts =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v) && v !== "")) as AIFacts;

interface ContentProps {
  kind: AIKind;
  facts: AIFacts;
  onDraft: (d: AIContentOut) => void;
  testid: string;
}

/** "Write with AI" — drafts the long text fields (and FAQs for colleges / exams) from the facts already in the form. */
export function AIContentButton({ kind, facts, onDraft, testid }: ContentProps) {
  const m = useMutation({
    mutationFn: () => apiPost<AIContentOut>("/admin/ai/content", { kind, fields: facts } satisfies AIContentIn),
    onSuccess: (d) => { onDraft(d); toast.success("AI draft added — please review and edit before saving"); },
    onError: (e) => toast.error(aiErrorText(e)),
  });
  return (
    <Button type="button" variant="outline" disabled={m.isPending || !(facts.name || facts.title)} onClick={() => m.mutate()} data-testid={testid}
      className="border-brand-leaf/40 text-brand-leaf hover:bg-green-50">
      {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {m.isPending ? "Writing…" : "Write with AI"}
    </Button>
  );
}

interface SeoProps {
  kind: AISeoIn["kind"];
  facts: AIFacts;
  onFill: (s: AISeoOut) => void;
  testid: string;
}

export function AISeoButton({ kind, facts, onFill, testid }: SeoProps) {
  const m = useMutation({
    mutationFn: () => apiPost<AISeoOut>("/admin/ai/seo", { kind, fields: facts } satisfies AISeoIn),
    onSuccess: (s) => { onFill(s); toast.success("SEO fields filled by AI — review before saving"); },
    onError: (e) => toast.error(aiErrorText(e)),
  });
  return (
    <Button type="button" size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()} data-testid={testid}
      className="ml-auto h-8 border-brand-leaf/40 text-xs text-brand-leaf hover:bg-green-50">
      {m.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Fill with AI
    </Button>
  );
}
