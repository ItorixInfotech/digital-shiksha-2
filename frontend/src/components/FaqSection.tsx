import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Accordion of Q&As. The matching FAQPage JSON-LD is emitted by the page's <Seo>. */
export default function FaqSection({ faqs, title = "Frequently asked questions", testid = "faq-section" }: { faqs: FaqItem[]; title?: string; testid?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!faqs.length) return null;
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm" data-testid={testid}>
      <h2 className="flex items-center gap-2 text-xl font-semibold"><HelpCircle className="size-5 text-brand-teal" /> {title}</h2>
      <div className="mt-4 divide-y divide-slate-200">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.question} data-testid={`${testid}-item-${i}`}>
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} data-testid={`${testid}-toggle-${i}`}
                className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium text-slate-900 hover:text-brand-red transition-colors">
                <span>{f.question}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-200", isOpen && "rotate-180 text-brand-red")} />
              </button>
              <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <p className="overflow-hidden pb-0 text-sm leading-relaxed text-slate-600" data-testid={`${testid}-answer-${i}`}><span className="block pb-4">{f.answer}</span></p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
