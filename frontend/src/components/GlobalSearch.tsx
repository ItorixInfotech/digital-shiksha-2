import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Building2, BookOpen, FileText, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { SearchHit } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND = {
  college: { icon: Building2, path: "/colleges/", label: "College" },
  course: { icon: BookOpen, path: "/courses/", label: "Course" },
  exam: { icon: FileText, path: "/exams/", label: "Exam" },
} as const;

export default function GlobalSearch({ size = "md", testid = "global-search", onNavigate }: { size?: "md" | "lg"; testid?: string; onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => apiGet<SearchHit[]>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });

  const go = (path: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    nav(path);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go(`/colleges?q=${encodeURIComponent(q.trim())}`);
  };

  const lg = size === "lg";
  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={submit} className={cn("flex items-center gap-2 rounded-xl border bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-blue/30 transition-shadow", lg ? "p-2 pl-4 border-white/20 shadow-xl" : "px-3 py-1.5")}>
        <Search className={cn("shrink-0 text-slate-400", lg ? "size-5" : "size-4")} />
        <input
          data-testid={`${testid}-input`}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={lg ? "Search colleges, courses, exams… e.g. COEP, MBA, NEET" : "Search colleges, courses, exams"}
          className={cn("min-w-0 flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400", lg ? "h-11 text-base" : "h-8 text-sm")}
        />
        {lg && (
          <button type="submit" data-testid={`${testid}-submit-button`} className="h-11 rounded-lg bg-brand-red px-6 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform]">
            Search
          </button>
        )}
      </form>
      {open && debounced.length >= 2 && (
        <div data-testid={`${testid}-results`} className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-xl border bg-white p-1.5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
          {isFetching && !data ? (
            <div className="flex items-center gap-2 p-3 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Searching…</div>
          ) : isError ? (
            <div className="p-3 text-sm text-slate-500">Search is unavailable right now.</div>
          ) : data && data.length ? (
            data.map((h) => {
              const k = KIND[h.kind];
              const Icon = k.icon;
              return (
                <button
                  key={`${h.kind}-${h.slug}`}
                  type="button"
                  data-testid={`${testid}-result-${h.kind}-${h.slug}`}
                  onClick={() => go(`${k.path}${h.slug}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="grid size-8 place-items-center rounded-md bg-slate-100 text-brand-navy"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{h.title}</span>
                    <span className="block truncate text-xs text-slate-500">{h.subtitle}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</span>
                </button>
              );
            })
          ) : (
            <div className="p-3 text-sm text-slate-500">No matches for “{debounced}”.</div>
          )}
        </div>
      )}
    </div>
  );
}
