import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Loader2, MapPin, Sparkles, Target, TrendingUp } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { PredictorCategory, PredictorChance, PredictorExam, PredictorIn, PredictorOut } from "@/lib/types";
import { feeRange, slugify } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { cn } from "@/lib/utils";

const CITIES: Record<string, string> = { both: "Pune & Mumbai", Pune: "Pune only", Mumbai: "Mumbai only", all: "All India" };
const CITY_LIST: Record<string, string[]> = { both: ["Pune", "Mumbai"], Pune: ["Pune"], Mumbai: ["Mumbai"], all: [] };
const CATEGORIES: { value: PredictorCategory; label: string }[] = [
  { value: "General", label: "General / Open" }, { value: "OBC", label: "OBC (NCL)" }, { value: "EWS", label: "EWS" }, { value: "SC", label: "SC" }, { value: "ST", label: "ST" },
];
const CHANCE: Record<PredictorChance, { label: string; cls: string; desc: string }> = {
  High: { label: "High chance", cls: "bg-green-50 text-green-800 ring-green-200", desc: "Your score is at or above last year's closing cutoff." },
  Medium: { label: "Good chance", cls: "bg-amber-50 text-amber-800 ring-amber-200", desc: "Slightly below last year's cutoff — possible in later rounds." },
  Reach: { label: "Reach", cls: "bg-red-50 text-red-700 ring-red-200", desc: "Below the cutoff — needs luck in spot/institute rounds." },
};

export default function Predictor() {
  const { openEnquiry } = useSite();
  const [exam, setExam] = useState("MHT CET");
  const [score, setScore] = useState("");
  const [city, setCity] = useState("both");
  const [category, setCategory] = useState<PredictorCategory>("General");
  const [chanceFilter, setChanceFilter] = useState<PredictorChance | "all">("all");

  const exams = useQuery({ queryKey: ["predictor", "exams"], queryFn: () => apiGet<PredictorExam[]>("/predictor/exams") });
  const spec = exams.data?.find((e) => e.name === exam);

  const predict = useMutation({
    mutationFn: (body: PredictorIn) => apiPost<PredictorOut>("/predictor", body),
    onSuccess: () => setChanceFilter("all"),
    onError: (e) => toast.error(e instanceof ApiError && e.status === 422 ? `Enter a valid ${spec?.label ?? "score"}` : "Prediction failed. Please try again."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(score);
    if (!score.trim() || Number.isNaN(n)) return toast.error(`Please enter your ${spec?.label ?? "score"}`);
    if (spec && (n < spec.min || n > spec.max)) return toast.error(`${spec.label} must be between ${spec.min} and ${spec.max}`);
    predict.mutate({ exam, score: n, category, cities: CITY_LIST[city] });
  };

  const data = predict.data;
  const shown = (data?.results ?? []).filter((r) => chanceFilter === "all" || r.chance === chanceFilter);
  const counts = (["High", "Medium", "Reach"] as const).map((c) => [c, data?.results.filter((r) => r.chance === c).length ?? 0] as const);
  const colleges = new Set(data?.results.map((r) => r.college_slug)).size;

  return (
    <div data-testid="predictor-page">
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "College Predictor" }]} title={<>College Predictor <span className="text-red-400">2026</span></>}
        subtitle="Enter your MHT CET, JEE Main, NEET or MBA CET score and see which Pune & Mumbai colleges you can likely get, based on last year's closing cutoffs." testid="predictor-header">
        <form onSubmit={submit} className="mt-8 grid max-w-4xl gap-4 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:grid-cols-12 sm:items-end" data-testid="predictor-form">
          <div className="grid gap-1.5 sm:col-span-3">
            <Label>Entrance exam</Label>
            <Select value={exam} onValueChange={(v: string) => { setExam(v); setScore(""); }}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-exam-select"><SelectValue>{(v) => v as string}</SelectValue></SelectTrigger>
              <SelectContent>
                {(exams.data ?? []).map((e) => <SelectItem key={e.name} value={e.name} data-testid={`predictor-exam-option-${slugify(e.name)}`}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-3">
            <Label htmlFor="predictor-score">{spec?.label ?? "Your score"}</Label>
            <Input id="predictor-score" data-testid="predictor-score-input" inputMode="decimal" className="h-11" placeholder={spec?.hint.split(" — ")[0] ?? "Score"} value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v: string) => setCategory(v as PredictorCategory)}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-category-select"><SelectValue>{(v) => CATEGORIES.find((c) => c.value === v)?.label}</SelectValue></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value} data-testid={`predictor-category-option-${c.value.toLowerCase()}`}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Location</Label>
            <Select value={city} onValueChange={(v: string) => setCity(v)}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-city-select"><SelectValue>{(v) => CITIES[v as string]}</SelectValue></SelectTrigger>
              <SelectContent>{Object.entries(CITIES).map(([k, l]) => <SelectItem key={k} value={k} data-testid={`predictor-city-option-${k.toLowerCase()}`}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={predict.isPending} data-testid="predictor-submit-button" className="h-11 bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform] sm:col-span-2">
            {predict.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Predict
          </Button>
          {spec && <p className="text-xs text-slate-500 sm:col-span-12">{spec.hint}{category !== "General" && spec.rank_note ? ` • ${spec.rank_note}` : ""}</p>}
        </form>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {!data && !predict.isPending && (
          <div className="grid gap-4 md:grid-cols-3" data-testid="predictor-intro">
            {[[Target, "Cutoff-based", "Uses previous-year closing cutoffs (General Open, CAP Round 1 / state quota)."], [MapPin, "Pune & Mumbai focus", "Covers top engineering, medical and MBA colleges in both cities."], [TrendingUp, "Fees & packages", "Compare fees and average placements right in the results."]].map(([I, t, d]) => {
              const Icon = I as typeof Target;
              return (
                <div key={t as string} className="rounded-2xl border bg-white p-6">
                  <span className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-brand-blue"><Icon className="size-5" /></span>
                  <p className="mt-4 font-semibold">{t as string}</p>
                  <p className="mt-1 text-sm text-slate-600">{d as string}</p>
                </div>
              );
            })}
          </div>
        )}

        {data && (
          <div data-testid="predictor-results">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight" data-testid="predictor-results-summary">
                  {data.results.length ? <>{colleges} colleges, {data.results.length} course options for {data.exam} {data.metric === "rank" ? `rank ${data.score}` : data.metric === "score" ? `score ${data.score}` : `${data.score} percentile`}</> : "No matching colleges"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{CITIES[city]} • {CATEGORIES.find((c) => c.value === data.category)?.label} • sorted by chance, then most competitive first</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setChanceFilter("all")} data-testid="predictor-filter-all" className={cn("rounded-full border px-3 py-1 text-sm transition-colors", chanceFilter === "all" ? "border-brand-navy bg-brand-navy text-white" : "bg-white hover:border-slate-400")}>All ({data.results.length})</button>
                {counts.map(([c, n]) => (
                  <button key={c} type="button" onClick={() => setChanceFilter(c)} data-testid={`predictor-filter-${c.toLowerCase()}`} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", chanceFilter === c ? "border-brand-navy bg-brand-navy text-white" : "bg-white hover:border-slate-400")}>{CHANCE[c].label} ({n})</button>
                ))}
              </div>
            </div>

            {!data.results.length ? (
              <div className="mt-6"><EmptyState title="No colleges found in this range" body="Try All India, a different exam, or talk to our counsellor — management & institute-level quota seats may still be available." testid="predictor-empty" /></div>
            ) : (
              <div className="mt-6 grid gap-3">
                {shown.map((r, i) => (
                  <div key={`${r.college_slug}-${r.course}`} data-testid={`predictor-result-${r.college_slug}-${slugify(r.course)}`} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                    className="flex flex-col gap-4 rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow animate-fade-up sm:flex-row sm:items-center">
                    <img src={r.image} alt="" loading="lazy" className="h-20 w-full rounded-xl object-cover sm:w-32" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", CHANCE[r.chance].cls)} title={CHANCE[r.chance].desc}>{CHANCE[r.chance].label}</span>
                        <span className="text-xs text-slate-500">{r.type} • {r.city}</span>
                      </div>
                      <Link to={`/colleges/${r.college_slug}`} className="mt-1 block font-semibold text-slate-900 hover:text-brand-red transition-colors" data-testid={`predictor-result-link-${r.college_slug}`}>{r.college_name}</Link>
                      <p className="text-sm text-slate-600">{r.course}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm sm:w-[380px]">
                      <div><p className="text-xs text-slate-500">{r.estimated ? "Est. cutoff" : "Last cutoff"}</p><p className="font-semibold" data-testid={`predictor-cutoff-${r.college_slug}-${slugify(r.course)}`}>{r.cutoff.replace(/^≈ /, "").replace(/ \((OBC|EWS|SC|ST)\)$/, "")}</p>{r.estimated && <p className="text-[11px] text-slate-400">Open: {r.general_cutoff}</p>}</div>
                      <div><p className="text-xs text-slate-500">Fees / yr</p><p className="font-semibold">{feeRange(r.fees_min, r.fees_max)}</p></div>
                      <div><p className="text-xs text-slate-500">Avg pkg</p><p className="font-semibold">{r.avg_package ? `₹${r.avg_package} LPA` : "—"}</p></div>
                    </div>
                    <Button size="sm" data-testid={`predictor-apply-${r.college_slug}-${slugify(r.course)}`}
                      onClick={() => openEnquiry({ college: r.college_name, source: "predictor", title: `Get admission guidance for ${r.short_name}`, message: `Predictor: ${data.exam} ${data.score} (${data.category}) — interested in ${r.course} at ${r.short_name} (${CHANCE[r.chance].label})` })}
                      className="bg-brand-red text-white hover:bg-red-700">Get guidance</Button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-6 flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600" data-testid="predictor-disclaimer">
              <Info className="mt-0.5 size-4 shrink-0" /> Predictions use approximate previous-year closing cutoffs for the General Open category (Maharashtra state quota / All-India quota where noted). For OBC, EWS, SC and ST we estimate the category cutoff from typical historical gaps — actual category, home-university, ladies and minority quota cutoffs vary by college and change every year. Call {"+91 8149 68 9468"} for a personalised option-form plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
