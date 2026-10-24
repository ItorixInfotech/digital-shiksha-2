import { useState } from "react";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FaqItem } from "@/lib/types";

let seq = 0;
const nextId = () => ++seq;

export default function FaqEditor({ value, onChange, testid, hint }: { value: FaqItem[]; onChange: (v: FaqItem[]) => void; testid: string; hint?: string }) {
  const set = (i: number, k: keyof FaqItem, v: string) => onChange(value.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  // Stable React keys per row (FAQs have no id), kept in step with adds/removes so inputs keep focus and state.
  const [ids, setIds] = useState<number[]>(() => value.map(nextId));
  if (ids.length !== value.length) setIds(ids.length < value.length ? [...ids, ...value.slice(ids.length).map(nextId)] : ids.slice(0, value.length));
  const remove = (i: number) => { setIds(ids.filter((_, j) => j !== i)); onChange(value.filter((_, j) => j !== i)); };
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-2">
        <HelpCircle className="size-4 text-brand-teal" />
        <h3 className="text-sm font-semibold text-slate-900">FAQs <span className="font-normal text-slate-500">({value.length})</span></h3>
        <span className="text-xs text-slate-500">{hint ?? "Shown as an accordion on the page and as FAQ rich results in Google"}</span>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onChange([...value, { question: "", answer: "" }])} data-testid={`${testid}-add-button`}><Plus className="size-3.5" /> Add FAQ</Button>
      </div>
      {value.map((f, i) => (
        <div key={ids[i] ?? `new-${i}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 animate-fade-up" data-testid={`${testid}-row-${i}`}>
          <div className="flex gap-2">
            <Input value={f.question} placeholder={`Question ${i + 1}`} maxLength={300} onChange={(e) => set(i, "question", e.target.value)} className="bg-white" data-testid={`${testid}-question-${i}`} />
            <Button type="button" size="icon-sm" variant="ghost" className="mt-1 text-red-600" aria-label="Remove FAQ" onClick={() => remove(i)} data-testid={`${testid}-remove-${i}`}><Trash2 className="size-4" /></Button>
          </div>
          <Textarea value={f.answer} rows={2} placeholder="Answer" maxLength={2000} onChange={(e) => set(i, "answer", e.target.value)} className="bg-white" data-testid={`${testid}-answer-${i}`} />
        </div>
      ))}
    </div>
  );
}

/** Drop half-filled rows before saving (backend requires 3+ chars each). */
export const cleanFaqs = (f: FaqItem[]) => f.map((x) => ({ question: x.question.trim(), answer: x.answer.trim() })).filter((x) => x.question.length >= 3 && x.answer.length >= 3);
