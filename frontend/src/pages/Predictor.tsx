import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Download, Info, Link2, Loader2, MapPin, MessageCircle, Sparkles, Target, TrendingUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PredictorGate from "@/components/PredictorGate";
import PredictorPayment from "@/components/PredictorPayment";
import { clearPending, dropLegacyStorage, GATE_KEY, readContact, readPending } from "@/lib/predictor-storage";
import { PageHeader, EmptyState } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import type { CapMeta, PredictorCategory, PredictorChance, PredictorExam, PredictorAccess, PredictorIn, PredictorOut, PredictionLogIn } from "@/lib/types";
import { feeRange, slugify } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { cn } from "@/lib/utils";
import { PageSeo } from "@/components/Seo";

const CITIES: Record<string, string> = { both: "Pune & Mumbai", Pune: "Pune only", Mumbai: "Mumbai only", all: "All India / all Maharashtra" };
const CITY_LIST: Record<string, string[]> = { both: ["Pune", "Mumbai"], Pune: ["Pune"], Mumbai: ["Mumbai"], all: [] };
// Extra Maharashtra regions — only meaningful for MHT CET (official CAP data covers 380+ colleges statewide).
const MH_REGIONS = ["Navi Mumbai", "Thane", "Nagpur", "Nashik", "Aurangabad", "Kolhapur", "Solapur", "Amravati", "Sangli", "Satara", "Jalgaon"];
MH_REGIONS.forEach((c) => { CITIES[c] = `${c} only`; CITY_LIST[c] = [c]; });
// Karnataka (KCET / COMEDK) locations — only shown for those exams; any other location key means all of Karnataka.
const KA_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Dharwad", "Belagavi", "Davanagere", "Tumakuru", "Shivamogga", "Kalaburagi", "Hassan", "Mandya"];
const KA_ALL = "karnataka";
CITIES[KA_ALL] = "All Karnataka"; CITY_LIST[KA_ALL] = [];
KA_CITIES.forEach((c) => { CITIES[c] = `${c} only`; CITY_LIST[c] = [c]; });
const KA_KEYS = [KA_ALL, ...KA_CITIES];
const KCET = "KCET";
const COMEDK = "COMEDK";
const isKa = (exam: string) => exam === KCET || exam === COMEDK;
const CATEGORIES: { value: PredictorCategory; label: string }[] = [
  { value: "General", label: "General / Open" }, { value: "OBC", label: "OBC (NCL)" }, { value: "EWS", label: "EWS" }, { value: "SC", label: "SC" }, { value: "ST", label: "ST" },
  { value: "VJ", label: "VJ / DT (A)" }, { value: "NT1", label: "NT 1 (B)" }, { value: "NT2", label: "NT 2 (C)" }, { value: "NT3", label: "NT 3 (D)" }, { value: "SEBC", label: "SEBC" }, { value: "TFWS", label: "TFWS (fee waiver)" },
];
const KCET_CATEGORIES: { value: PredictorCategory; label: string }[] = [
  { value: "General", label: "General Merit (GM)" }, { value: "1", label: "Category 1" }, { value: "2A", label: "Category 2A" }, { value: "2B", label: "Category 2B" },
  { value: "3A", label: "Category 3A" }, { value: "3B", label: "Category 3B" }, { value: "SC", label: "SC" }, { value: "ST", label: "ST" },
];
const COMEDK_CATEGORIES: { value: PredictorCategory; label: string }[] = [{ value: "General", label: "General Merit (all India)" }];
const categoriesFor = (exam: string) => (exam === KCET ? KCET_CATEGORIES : exam === COMEDK ? COMEDK_CATEGORIES : CATEGORIES);
const categoryLabel = (exam: string, v: string) => categoriesFor(exam).find((c) => c.value === v)?.label ?? v;
const citiesFor = (exam: string, key: string) => (isKa(exam) ? (KA_KEYS.includes(key) ? CITY_LIST[key] : []) : KA_KEYS.includes(key) ? [] : CITY_LIST[key]);
const ANY_HU = "any";
// Display names in the exam drop-down (the exam key stays "MHT CET" for links, payments and stored data).
const EXAM_LABEL: Record<string, string> = { "MHT CET": "MHT CET (Engineering)", "MHT CET Pharmacy": "MHT CET (Pharmacy)" };
const examLabel = (name: string) => EXAM_LABEL[name] ?? name;
// Exams backed by official CET Cell CAP cut-offs → program key for /predictor/cap-meta
const CAP_PROGRAM: Record<string, string> = { "MHT CET": "engineering", "MHT CET Pharmacy": "pharmacy", [KCET]: "kcet", [COMEDK]: "comedk" };
const ALL_BRANCHES = "all";
const CHANCE: Record<PredictorChance, { label: string; cls: string; desc: string }> = {
  High: { label: "High chance", cls: "bg-green-50 text-green-800 ring-green-200", desc: "Your score is at or above last year's closing cutoff." },
  Medium: { label: "Good chance", cls: "bg-amber-50 text-amber-800 ring-amber-200", desc: "Slightly below last year's cutoff — possible in later rounds." },
  Reach: { label: "Reach", cls: "bg-red-50 text-red-700 ring-red-200", desc: "Below the cutoff — needs luck in spot/institute rounds." },
};

/** Monogram for colleges without a page/logo, e.g. "Ramaiah Institute of Technology" -> "RIT". */
const initials = (name: string) => name.replace(/\(.*?\)/g, " ").split(/[\s,.-]+/).filter((w) => /^[A-Z]/.test(w) && !["Of", "And", "The", "For"].includes(w)).map((w) => w[0]).join("").slice(0, 4) || name.slice(0, 2).toUpperCase();

export default function Predictor() {
  const { openEnquiry } = useSite();
  const [sp, setSp] = useSearchParams();
  // Same-tab payment: the student leaves for the Razorpay page and comes back here — either redirected by
  // Razorpay (/predictor?paid=1, maybe with razorpay_payment_id) or with the Back button. Restore what they
  // paid for and confirm the payment automatically.
  const rzpId = sp.get("razorpay_payment_id");
  const [pending] = useState(readPending);
  const [autoConfirm] = useState<"poll" | "once" | undefined>(() => (rzpId || sp.get("paid") === "1" ? "poll" : pending ? "once" : undefined));
  const needsRestore = !!pending && !!autoConfirm && !sp.get("exam");
  useEffect(() => {
    if (!needsRestore || !pending) return;
    const next = new URLSearchParams(pending.qs);
    if (rzpId) next.set("razorpay_payment_id", rzpId);
    setSp(next, { replace: true });
  }, [needsRestore, pending, rzpId, setSp]);
  const urlExam = sp.get("exam") ?? "";
  const urlScore = sp.get("score") ?? "";
  const urlCategory = (sp.get("category") ?? "General") as PredictorCategory;
  const urlCity = CITY_LIST[sp.get("city") ?? ""] ? (sp.get("city") as string) : "both";
  const urlLadies = sp.get("ladies") === "1";
  const urlHu = sp.get("hu") ?? "";
  const urlBranch = sp.get("branch") ?? "";
  const urlKannada = sp.get("kannada") === "1";
  const urlRural = sp.get("rural") === "1";
  const urlKkr = sp.get("kkr") === "1";
  const [exam, setExam] = useState(urlExam || "MHT CET");
  const [score, setScore] = useState(urlScore);
  const [city, setCity] = useState(isKa(urlExam) && !KA_KEYS.includes(urlCity) ? KA_ALL : urlCity);
  const [category, setCategory] = useState<PredictorCategory>(urlCategory);
  const [chanceFilter, setChanceFilter] = useState<PredictorChance | "all">("all");
  const [ladies, setLadies] = useState(urlLadies);
  const [hu, setHu] = useState(urlHu || ANY_HU);
  const [branch, setBranch] = useState(urlBranch || ALL_BRANCHES);
  const [kannada, setKannada] = useState(urlKannada);
  const [rural, setRural] = useState(urlRural);
  const [kkr, setKkr] = useState(urlKkr);
  const isKcet = exam === KCET;
  const isComedk = exam === COMEDK;
  const ka = isKcet || isComedk;
  const program = CAP_PROGRAM[exam];
  const capMeta = useQuery({ queryKey: ["predictor", "cap-meta", program], queryFn: () => apiGet<CapMeta>(`/predictor/cap-meta?program=${program}`), staleTime: 10 * 60_000, enabled: !!program });
  const isCap = !!program && !!capMeta.data?.available;

  const exams = useQuery({ queryKey: ["predictor", "exams"], queryFn: () => apiGet<PredictorExam[]>("/predictor/exams") });
  const spec = exams.data?.find((e) => e.name === exam);

  // The URL is the source of truth for a prediction, so result links are shareable.
  const body: PredictorIn | null = urlExam && urlScore && !Number.isNaN(Number(urlScore))
    ? { exam: urlExam, score: Number(urlScore), category: urlCategory, cities: citiesFor(urlExam, urlCity),
        ...(urlExam === KCET ? { branch_group: urlBranch, kannada: urlKannada, rural: urlRural }
          : urlExam === COMEDK ? { branch_group: urlBranch, kkr: urlKkr }
          : CAP_PROGRAM[urlExam] ? { ladies: urlLadies, home_university: urlHu, branch_group: urlBranch } : {}) } : null;
  const urlWhere = isKa(urlExam) && !KA_KEYS.includes(urlCity) ? CITIES[KA_ALL] : CITIES[urlCity];
  // Lead gate: the first prediction on a device needs name/mobile/city/role/college (saved as an enquiry).
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(GATE_KEY) === "1");
  const [gateDismissed, setGateDismissed] = useState(false);
  const gateOpen = !!body && !unlocked && !gateDismissed;
  // Paid exams (MHT CET engineering): one verified Razorpay payment unlocks one exam + score.
  const urlSpec = exams.data?.find((e) => e.name === urlExam);
  const fee = urlSpec?.fee ?? 0;
  const bodyKey = body ? `${body.exam}|${body.score}` : "";
  const qc = useQueryClient();
  const accessKey = ["predictor", "access", body?.exam, body?.score];
  const access = useQuery({
    queryKey: accessKey,
    queryFn: () => apiGet<PredictorAccess>(`/predictor/access?${new URLSearchParams({ exam: body!.exam, score: String(body!.score) })}`),
    enabled: !!body && fee > 0,
  });
  const [payDismissed, setPayDismissed] = useState(false);
  const needsPay = !!body && fee > 0 && access.data?.paid !== true;
  const payOpen = !!body && unlocked && needsPay && !payDismissed;
  // Log every submitted score once (paid exams too, before payment) so admin can download its PDF.
  const logged = useRef(new Set<string>());
  const logKey = body ? JSON.stringify(body) : "";
  useEffect(() => {
    if (!body || !unlocked || !urlSpec || logged.current.has(logKey)) return;
    logged.current.add(logKey);
    const c = readContact();
    const phone = c.phone.replace(/\D/g, "").slice(-10);
    void apiPost<void>("/predictor/log", { prediction: body, name: c.name, phone: /^[6-9]\d{9}$/.test(phone) ? phone : "" } satisfies PredictionLogIn).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by logKey
  }, [logKey, unlocked, urlSpec]);
  const predict = useQuery({
    queryKey: ["predictor", "run", body],
    queryFn: () => apiPost<PredictorOut>("/predictor", body),
    enabled: !!body && unlocked && !!urlSpec && !needsPay,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const err = predict.error;
  const paywalled = err instanceof ApiError && err.status === 402;
  useEffect(() => { if (paywalled) void qc.invalidateQueries({ queryKey: ["predictor", "access"] }); }, [paywalled, qc]);
  useEffect(dropLegacyStorage, []);
  const errMsg = err && !(err instanceof ApiError && err.status === 402) ? (err instanceof ApiError && err.status === 422 ? `Enter a valid ${spec?.label ?? "score"}` : "Prediction failed. Please try again.") : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(score);
    if (!score.trim() || Number.isNaN(n)) return toast.error(`Please enter your ${spec?.label ?? "score"}`);
    if (spec && (n < spec.min || n > spec.max)) return toast.error(`${spec.label} must be between ${spec.min} and ${spec.max}`);
    setChanceFilter("all");
    setGateDismissed(false);
    setPayDismissed(false);
    const qs: Record<string, string> = { exam, score: String(n), category, city };
    if (ka) {
      if (isKcet && kannada) qs.kannada = "1";
      if (isKcet && rural) qs.rural = "1";
      if (isComedk && kkr) qs.kkr = "1";
      if (branch !== ALL_BRANCHES) qs.branch = branch;
    } else if (CAP_PROGRAM[exam]) {
      if (ladies) qs.ladies = "1";
      if (hu !== ANY_HU) qs.hu = hu;
      if (branch !== ALL_BRANCHES) qs.branch = branch;
    }
    setSp(qs, { replace: false });
  };

  const shareQs = body ? sp.toString() : "";
  const shareUrl = `${window.location.origin}/predictor?${shareQs}`;
  const pdfHref = body ? `/api/predictor/pdf?${new URLSearchParams({ exam: body.exam, score: String(body.score), category: body.category, cities: body.cities.join(","),
    ...(body.ladies ? { ladies: "true" } : {}), ...(body.home_university ? { home_university: body.home_university } : {}), ...(body.branch_group ? { branch_group: body.branch_group } : {}),
    ...(body.kannada ? { kannada: "true" } : {}), ...(body.rural ? { rural: "true" } : {}), ...(body.kkr ? { kkr: "true" } : {}) }).toString()}` : "";
  const waText = body ? `My ${body.exam} college prediction (${body.score}, ${body.category}) from Digital Shiksha: ${shareUrl}` : "";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); } catch { toast.error("Couldn't copy — please copy from the address bar"); }
  };

  const data = predict.data;
  const shown = useMemo(() => (data?.results ?? []).filter((r) => chanceFilter === "all" || r.chance === chanceFilter), [data, chanceFilter]);
  const counts = useMemo(() => (["High", "Medium", "Reach"] as const).map((c) => [c, data?.results.filter((r) => r.chance === c).length ?? 0] as const), [data]);
  const cityOptions = useMemo(() => Object.entries(CITIES).filter(([k]) => (ka ? KA_KEYS.includes(k) : !KA_KEYS.includes(k) && (!!CAP_PROGRAM[exam] || !MH_REGIONS.includes(k)))), [exam, ka]);
  const categoryOptions = categoriesFor(exam);
  const changeExam = (v: string) => {
    setExam(v);
    setScore("");
    const kc = isKa(v);
    if (!categoriesFor(v).some((c) => c.value === category)) setCategory("General");
    if (kc !== KA_KEYS.includes(city)) setCity(kc ? KA_ALL : "both");
    if (kc !== ka) setBranch(ALL_BRANCHES);
  };
  const colleges = new Set(data?.results.map((r) => r.college_name)).size;
  const official = !!data?.results[0]?.official || !!data?.source;

  return (
    <div data-testid="predictor-page">
      <PageSeo page="predictor" />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "College Predictor" }]} title={<>College <span className="text-brand-leaf-soft">Predictor</span></>}
        subtitle="Enter your MHT CET, KCET, COMEDK, JEE Main, NEET or MBA CET score and see which colleges you can likely get. MHT CET uses the official CAP cut-offs for 380+ engineering and 520+ pharmacy colleges in Maharashtra; KCET and COMEDK use the official KEA / COMEDK closing ranks for Karnataka colleges." testid="predictor-header">
        <form onSubmit={submit} className="mt-8 grid max-w-5xl gap-4 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl sm:grid-cols-2 lg:grid-cols-12 lg:items-end" data-testid="predictor-form">
          <div className="grid min-w-0 gap-1.5 lg:col-span-3">
            <Label>Entrance exam</Label>
            <Select value={exam} onValueChange={changeExam}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-exam-select"><SelectValue>{(v) => examLabel(v as string)}</SelectValue></SelectTrigger>
              <SelectContent>
                {(exams.data ?? []).map((e) => <SelectItem key={e.name} value={e.name} data-testid={`predictor-exam-option-${slugify(e.name)}`}>{examLabel(e.name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5 lg:col-span-2">
            <Label htmlFor="predictor-score">{spec?.label ?? "Your score"}</Label>
            <Input id="predictor-score" data-testid="predictor-score-input" inputMode="decimal" className="h-11" placeholder={spec?.hint.split(" — ")[0] ?? "Score"} value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="grid min-w-0 gap-1.5 lg:col-span-3">
            <Label>Category</Label>
            {categoryOptions.length === 1 ? (
              <div className="flex h-11 min-w-0 items-center rounded-lg border border-input bg-slate-50 px-2.5 text-sm text-slate-700" title="COMEDK has one merit list for all students" data-testid="predictor-category-fixed">
                <span className="truncate">{categoryOptions[0].label}</span>
              </div>
            ) : (
            <Select value={category} onValueChange={(v: string) => setCategory(v as PredictorCategory)}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-category-select"><SelectValue>{(v) => categoryLabel(exam, v as string)}</SelectValue></SelectTrigger>
              <SelectContent>{categoryOptions.map((c) => <SelectItem key={c.value} value={c.value} data-testid={`predictor-category-option-${c.value.toLowerCase()}`}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            )}
          </div>
          <div className="grid min-w-0 gap-1.5 lg:col-span-2">
            <Label>Location</Label>
            <Select value={city} onValueChange={(v: string) => setCity(v)}>
              <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-city-select"><SelectValue>{(v) => CITIES[v as string]}</SelectValue></SelectTrigger>
              <SelectContent>{cityOptions.map(([k, l]) => <SelectItem key={k} value={k} data-testid={`predictor-city-option-${k.toLowerCase()}`}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={predict.isFetching} data-testid="predictor-submit-button" className="h-11 bg-brand-red text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform] sm:col-span-2 lg:col-span-2">
            {predict.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Predict
          </Button>
          {isCap && (
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 lg:col-span-12 sm:grid-cols-2 lg:grid-cols-12 lg:items-end animate-fade-up" data-testid="predictor-cap-options">
              {isComedk ? (
                <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm lg:col-span-5">
                  <Checkbox checked={kkr} onCheckedChange={(v) => setKkr(Boolean(v))} data-testid="predictor-kkr-checkbox" /> Kalyana-Karnataka (371J) candidate — include KKR seats
                </label>
              ) : isKcet ? (
                <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-5">
                  <label className="flex h-11 flex-1 items-center gap-2.5 rounded-lg border border-slate-200 px-3 text-sm">
                    <Checkbox checked={kannada} onCheckedChange={(v) => setKannada(Boolean(v))} data-testid="predictor-kannada-checkbox" /> Kannada medium (K seats)
                  </label>
                  <label className="flex h-11 flex-1 items-center gap-2.5 rounded-lg border border-slate-200 px-3 text-sm">
                    <Checkbox checked={rural} onCheckedChange={(v) => setRural(Boolean(v))} data-testid="predictor-rural-checkbox" /> Rural candidate (R seats)
                  </label>
                </div>
              ) : (
              <div className="grid min-w-0 gap-1.5 lg:col-span-5">
                <Label>Home university (for HU / OHU seats)</Label>
                <Select value={hu} onValueChange={(v: string) => setHu(v)}>
                  <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-hu-select"><SelectValue>{(v) => (v === ANY_HU ? "Not sure — show Other-than-HU seats" : (v as string))}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_HU}>Not sure — show Other-than-HU seats</SelectItem>
                    {capMeta.data!.home_universities.map((h) => <SelectItem key={h} value={h} data-testid={`predictor-hu-option-${slugify(h)}`}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              )}
              <div className={cn("grid min-w-0 gap-1.5", ka ? "lg:col-span-7" : "lg:col-span-4")}>
                <Label>{program === "pharmacy" ? "Course" : "Branch"}</Label>
                <Select value={branch} onValueChange={(v: string) => setBranch(v)}>
                  <SelectTrigger className="h-11 w-full bg-white" data-testid="predictor-branch-select"><SelectValue>{(v) => (v === ALL_BRANCHES ? (program === "pharmacy" ? "B.Pharm + Pharm.D" : "All branches") : (v as string))}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_BRANCHES}>{program === "pharmacy" ? "B.Pharm + Pharm.D" : "All branches"}</SelectItem>
                    {capMeta.data!.branch_groups.map((b) => <SelectItem key={b} value={b} data-testid={`predictor-branch-option-${slugify(b)}`}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!ka && <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2 lg:col-span-3">
                <Checkbox checked={ladies} onCheckedChange={(v) => setLadies(Boolean(v))} data-testid="predictor-ladies-checkbox" />
                Girl candidate (include Ladies seats)
              </label>}
            </div>
          )}
          {spec && <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-12">{spec.hint}{category !== "General" && spec.rank_note ? ` • ${spec.rank_note}` : ""}{spec.fee > 0 && <span className="ml-1 font-semibold text-brand-leaf" data-testid="predictor-fee-note">• Full college list: ₹{spec.fee.toLocaleString("en-IN")} per {spec.metric === "rank" ? "rank" : spec.metric === "score" ? "score" : "percentile"}</span>}</p>}
        </form>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {errMsg && <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700" data-testid="predictor-error">{errMsg}</p>}
        {body && !unlocked && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-5" data-testid="predictor-locked-card">
            <p className="text-sm text-slate-700"><span className="font-semibold text-brand-leaf">Your predicted college list is ready.</span> Share your details once to view it.</p>
            <Button onClick={() => setGateDismissed(false)} className="bg-brand-red text-white hover:bg-red-700" data-testid="predictor-unlock-button">View my colleges</Button>
          </div>
        )}
        <PredictorGate open={gateOpen} onOpenChange={(o) => { if (!o) setGateDismissed(true); }} onUnlocked={() => setUnlocked(true)}
          prediction={body} examLabel={body ? `${body.exam}${body.branch_group ? ` – ${body.branch_group}` : ""}` : ""} />
        {body && unlocked && needsPay && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-5" data-testid="predictor-paywall-card">
            <p className="text-sm text-slate-700"><span className="font-semibold text-brand-leaf">Your {body.exam} college list for {urlSpec?.metric === "rank" ? `rank ${body.score}` : urlSpec?.metric === "score" ? `score ${body.score}` : `${body.score} percentile`} is ready.</span> Pay ₹{fee.toLocaleString("en-IN")} to view it and get the PDF by email.</p>
            <Button onClick={() => setPayDismissed(false)} className="bg-brand-red text-white hover:bg-red-700" data-testid="predictor-pay-button">Pay ₹{fee.toLocaleString("en-IN")} &amp; view</Button>
          </div>
        )}
        {body && urlSpec && fee > 0 && unlocked && (
          <PredictorPayment key={bodyKey} open={payOpen} onOpenChange={(o) => { if (!o) setPayDismissed(true); }} onPaid={() => { clearPending(); void qc.invalidateQueries({ queryKey: accessKey }); }}
            autoConfirm={pending && body && pending.exam === body.exam && Number(pending.score) === body.score ? autoConfirm : undefined}
            prediction={body} fee={fee} paymentLink={urlSpec.payment_link} autoCheck={urlSpec.payment_auto_check} metric={urlSpec.metric} />
        )}
        {!data && !predict.isFetching && !(body && !unlocked) && !(body && needsPay) && (
          <div className="grid gap-4 md:grid-cols-3" data-testid="predictor-intro">
            {[[Target, "Official CAP cut-offs", "MHT CET (Engineering & Pharmacy) uses the State CET Cell Round I–IV closing percentiles for every category, Home-University and Ladies seat."], [MapPin, "900+ Maharashtra colleges", "Every engineering and pharmacy college in the CAP — Pune, Mumbai, Nagpur, Nashik and more."], [TrendingUp, "Fees & packages", "Compare fees and average placements right in the results."]].map(([I, t, d]) => {
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
                  {data.results.length ? <>{colleges} colleges, {data.total > data.results.length ? `top ${data.results.length} of ${data.total}` : data.results.length} course options for {data.exam} {data.metric === "rank" ? `rank ${data.score}` : data.metric === "score" ? `score ${data.score}` : `${data.score} percentile`}</> : "No matching colleges"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{urlWhere} • {categoryLabel(data.exam, data.category)}{body?.ladies ? " • Ladies seats" : ""}{body?.kannada ? " • Kannada medium" : ""}{body?.rural ? " • Rural" : ""}{body?.kkr ? " • KKR seats" : ""}{body?.home_university ? ` • HU: ${body.home_university}` : ""}{body?.branch_group ? ` • ${body.branch_group}` : ""} • most competitive first</p>
                {official && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-brand-leaf ring-1 ring-green-200" data-testid="predictor-official-badge"><BadgeCheck className="size-3.5" /> {data.exam === COMEDK ? "Official COMEDK closing ranks · 2025 Round 1" : data.exam === KCET ? "Official KEA closing ranks · KCET 2025 Round I" : "Official CET Cell CAP cut-offs · Rounds I–IV"}</p>}
              </div>
              <div className="flex flex-wrap gap-2" data-testid="predictor-share-actions">
                <a href={pdfHref} download data-testid="predictor-download-pdf-button" className={cn(buttonVariants({ size: "sm" }), "bg-brand-navy text-white hover:bg-brand-blue")}><Download className="size-4" /> Download PDF</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" data-testid="predictor-share-whatsapp-button" className={cn(buttonVariants({ size: "sm" }), "bg-[#25D366] text-white hover:bg-[#1ebe5a]")}><MessageCircle className="size-4" /> Share on WhatsApp</a>
                <button type="button" onClick={copyLink} data-testid="predictor-copy-link-button" className={buttonVariants({ size: "sm", variant: "outline" })}><Link2 className="size-4" /> Copy link</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
                  <div key={r.course_code || `${r.college_slug}-${r.course}`} data-testid={r.course_code ? `predictor-result-cap-${r.course_code}` : `predictor-result-${r.college_slug}-${slugify(r.course)}`} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                    className="flex flex-col gap-4 rounded-2xl border bg-white p-4 hover:shadow-md transition-shadow animate-fade-up sm:flex-row sm:items-center">
                    {r.logo ? <img src={r.logo} alt={`${r.short_name} logo`} loading="lazy" className="h-20 w-full rounded-xl bg-white object-contain p-2 ring-1 ring-slate-100 sm:w-32" data-testid="predictor-result-logo" />
                      : r.image ? <img src={r.image} alt="" loading="lazy" className="h-20 w-full rounded-xl object-cover sm:w-32" />
                      : <span className="hidden h-20 w-32 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-lg font-bold tracking-tight text-brand-navy ring-1 ring-slate-200 sm:grid" data-testid="predictor-result-initials">{initials(r.college_name)}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", CHANCE[r.chance].cls)} title={CHANCE[r.chance].desc}>{CHANCE[r.chance].label}</span>
                        <span className="text-xs text-slate-500">{r.type} • {r.city}</span>
                      </div>
                      {r.college_slug
                        ? <Link to={`/colleges/${r.college_slug}`} className="mt-1 block font-semibold text-slate-900 hover:text-brand-leaf transition-colors" data-testid={`predictor-result-link-${r.college_slug}`}>{r.college_name}</Link>
                        : <p className="mt-1 font-semibold text-slate-900">{r.college_name}</p>}
                      <p className="text-sm text-slate-600">{r.course}</p>
                      {data.metric === "rank" && r.official && r.seat && <span className="mt-1.5 inline-block rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800" data-testid="predictor-result-seat">{r.seat} seat</span>}
                      {r.rounds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="predictor-result-rounds">
                          {r.rounds.map((x) => (
                            <span key={x.round} title={x.seat ? `${x.seat}${x.merit_no ? ` · merit no. ${x.merit_no}` : ""}` : "No allotment for your seat types in this round"}
                              className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums", x.percentile === null ? "bg-slate-50 text-slate-400" : "bg-slate-100 text-slate-700")}>
                              R{x.round} {x.percentile === null ? "—" : x.percentile.toFixed(2)}
                            </span>
                          ))}
                          {r.seat && <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">{r.seat}</span>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm sm:w-[380px]">
                      <div><p className="text-xs text-slate-500">{r.official ? (data.metric === "rank" ? "2025 R1 closing" : `Round ${r.rounds.find((x) => x.percentile !== null)?.round ?? 1} closing`) : r.estimated ? "Est. cutoff" : "Last cutoff"}</p><p className="font-semibold" data-testid={`predictor-cutoff-${r.college_slug || "cap"}-${slugify(r.course)}`}>{r.official ? (data.metric === "rank" ? `Rank ${r.cutoff_value.toLocaleString("en-IN")}` : `${r.cutoff_value.toFixed(2)} %ile`) : r.cutoff.replace(/^≈ /, "").replace(/ \((OBC|EWS|SC|ST|VJ|NT1|NT2|NT3|SEBC|TFWS)\)$/, "")}</p>{r.estimated && <p className="text-[11px] text-slate-400">Open: {r.general_cutoff}</p>}</div>
                      <div><p className="text-xs text-slate-500">Fees / yr</p><p className="font-semibold">{feeRange(r.fees_min, r.fees_max)}</p></div>
                      <div><p className="text-xs text-slate-500">Avg pkg</p><p className="font-semibold">{r.avg_package ? `₹${r.avg_package} LPA` : "—"}</p></div>
                    </div>
                    <Button size="sm" data-testid={`predictor-apply-${r.college_slug}-${slugify(r.course)}`}
                      onClick={() => openEnquiry({ college: r.college_name, source: "predictor", title: `Get admission guidance for ${r.short_name}`, prediction: body ?? undefined, message: `Predictor: ${data.exam} ${data.score} (${data.category}) — interested in ${r.course} at ${r.short_name} (${CHANCE[r.chance].label})` })}
                      className="bg-brand-red text-white hover:bg-red-700">Get guidance</Button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-6 flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600" data-testid="predictor-disclaimer">
              <Info className="mt-0.5 size-4 shrink-0" /> {data.exam === COMEDK ? <>Based on the official COMEDK UGET 2025 Engineering cut-off ranks after Round 1 allotment (comedk.org). COMEDK seats are open to students from every state. Chance is judged on the GM closing rank{body?.kkr ? " or the KKR closing rank, whichever is more lenient" : ""}. Later rounds usually close at higher ranks. Ranks change every year. Call {"+91 8149 68 9468"} for a personalised option-entry plan.</> : data.exam === KCET ? <>Based on the official KEA UGCET 2025 First Round allotment closing ranks (cetonline.karnataka.gov.in/kea). Chance is judged on the closing rank of the most lenient seat you qualify for: General Merit + your category{body?.kannada ? ", Kannada medium" : ""}{body?.rural ? ", Rural" : ""}. Hyderabad-Karnataka (371J), special-category and private/COMEDK seats are not included. Ranks change every year. Call {"+91 8149 68 9468"} for a personalised option-entry plan.</> : official ? <>Based on the official State CET Cell CAP cut-offs (Rounds I–IV, Maharashtra & minority seats) from cetcell.mahacet.org. Chance is judged on the Round I closing percentile of the most lenient seat type you qualify for (Open + your category, Home-University / Other-than-HU / State level{body?.ladies ? ", Ladies" : ""}). Later rounds are shown for reference. Defence, PWD, orphan and minority-specific seats are not included. Call {"+91 8149 68 9468"} for a personalised option-form plan.</> : <>Predictions use approximate previous-year closing cutoffs for the General Open category (Maharashtra state quota / All-India quota where noted). For OBC, EWS, SC and ST we estimate the category cutoff from typical historical gaps — actual category, home-university, ladies and minority quota cutoffs vary by college and change every year. Call {"+91 8149 68 9468"} for a personalised option-form plan.</>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
