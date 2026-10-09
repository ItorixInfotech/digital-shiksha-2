import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiPost, ApiError } from "@/lib/api";
import type { CutoffImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CutoffUploadPanel() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CutoffImportResult | null>(null);

  const run = useMutation({
    mutationFn: (dry: boolean) => {
      const fd = new FormData();
      fd.append("file", file as File);
      return apiPost<CutoffImportResult>(`/admin/cutoffs/upload?dry_run=${dry}`, fd);
    },
    onSuccess: (r) => {
      setResult(r);
      if (!r.dry_run) {
        toast.success(`Imported: ${r.added} added, ${r.updated} updated`);
        qc.invalidateQueries({ queryKey: ["colleges"] });
        qc.invalidateQueries({ queryKey: ["college"] });
        qc.invalidateQueries({ queryKey: ["predictor", "run"] });
      }
    },
    onError: (e) => {
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : "Upload failed";
      toast.error(detail);
    },
  });

  const pick = (f: File | null) => { setFile(f); setResult(null); };

  return (
    <div className="space-y-6" data-testid="admin-cutoffs-panel">
      <div>
        <h2 className="text-xl font-semibold">Category-wise cutoff upload</h2>
        <p className="text-sm text-slate-500">Copy closing cutoffs from the CET Cell / MCC / JoSAA lists into the Digital Shiksha Excel template, then upload. Official category values replace the predictor's estimates.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Download the template", "Pre-filled with every cutoff currently on the website, plus a Colleges sheet and instructions."],
          ["2", "Add category rows", "One row per College + Course/Branch + Exam + Category (General, OBC, EWS, SC, ST) with the closing value."],
          ["3", "Validate, then import", "Validation shows exactly what will change and lists any rows with problems."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-xl border bg-white p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-navy text-sm font-semibold text-white">{n}</span>
            <p className="mt-3 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-5">
        <a href="/api/admin/cutoffs/template" download data-testid="admin-cutoffs-template-button" className={cn(buttonVariants({ variant: "outline" }))}>
          <FileSpreadsheet className="size-4" /> Download Excel template
        </a>
        <div className="h-8 w-px bg-slate-200" />
        <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" data-testid="admin-cutoffs-file-input" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <Button variant="outline" onClick={() => input.current?.click()} data-testid="admin-cutoffs-choose-button"><Upload className="size-4" /> Choose file</Button>
        <span className="text-sm text-slate-600" data-testid="admin-cutoffs-file-name">{file ? file.name : "No file chosen (.xlsx or .csv, max 5 MB)"}</span>
        <div className="ml-auto flex gap-2">
          <Button disabled={!file || run.isPending} onClick={() => run.mutate(true)} data-testid="admin-cutoffs-validate-button" className="bg-brand-navy text-white hover:bg-brand-blue">
            {run.isPending && run.variables === true && <Loader2 className="size-4 animate-spin" />} Validate
          </Button>
          <Button disabled={!file || !result || !result.dry_run || run.isPending || result.added + result.updated === 0} onClick={() => run.mutate(false)} data-testid="admin-cutoffs-import-button" className="bg-brand-red text-white hover:bg-red-700">
            {run.isPending && run.variables === false && <Loader2 className="size-4 animate-spin" />} Import to website
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-fade-up" data-testid="admin-cutoffs-result">
          <div className={cn("flex items-center gap-2 rounded-xl p-4 text-sm font-medium", result.dry_run ? "bg-indigo-50 text-brand-blue" : "bg-green-50 text-green-800")}>
            {result.dry_run ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {result.dry_run ? "Validation only — nothing has been saved yet. Click “Import to website” to apply." : "Import complete — the predictor now uses these values."}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {([["Rows read", result.rows_read], ["New rows", result.added], ["Updated rows", result.updated], ["Colleges", result.colleges_affected], ["Rows with problems", result.skipped]] as const).map(([l, v]) => (
              <div key={l} className="rounded-xl border bg-white p-4" data-testid={`admin-cutoffs-stat-${l.toLowerCase().replace(/\s+/g, "-")}`}>
                <p className="text-xs text-slate-500">{l}</p>
                <p className={cn("mt-1 text-2xl font-bold", l === "Rows with problems" && v > 0 ? "text-red-600" : "")}>{v}</p>
              </div>
            ))}
          </div>
          {result.issues.length > 0 && (
            <div className="rounded-2xl border bg-white">
              <Table data-testid="admin-cutoffs-issues-table">
                <TableHeader><TableRow><TableHead className="w-24">Excel row</TableHead><TableHead>Problem (row skipped)</TableHead></TableRow></TableHeader>
                <TableBody>{result.issues.map((i) => <TableRow key={`${i.row}-${i.message}`}><TableCell>{i.row}</TableCell><TableCell className="whitespace-normal text-red-700">{i.message}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
