import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CalendarClock, PhoneCall, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import type { Lead, PredictorReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const fmtScore = (metric: string, v: number) => (metric === "rank" ? `Rank ${Math.round(v)}` : metric === "score" ? `${Math.round(v)}/720` : `${v}%ile`);
const when = (d: string) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function PredictorReportPanel() {
  const report = useQuery({ queryKey: ["admin", "predictor-report"], queryFn: () => apiGet<PredictorReport>("/admin/predictor-report") });
  const leads = useQuery({ queryKey: ["admin", "leads"], queryFn: () => apiGet<Lead[]>("/admin/leads") });
  const [sel, setSel] = useState<string | null>(null);

  const r = report.data;
  const active = r?.exams.find((e) => e.exam === sel) ?? r?.exams[0];
  const predictorLeads = (leads.data ?? []).filter((l) => l.source === "predictor");

  if (report.isLoading) return <p className="text-slate-500">Loading report…</p>;
  if (report.isError || !r) return <p className="text-slate-500" data-testid="admin-predictor-error">Report unavailable right now.</p>;

  const cards = [
    [Search, "Total predictions", r.total_searches],
    [CalendarClock, "Last 7 days", r.last_7_days],
    [PhoneCall, "Leads from predictor", r.predictor_leads],
    [Activity, "Conversion to lead", r.total_searches ? `${Math.round((r.predictor_leads / r.total_searches) * 100)}%` : "—"],
  ] as const;

  return (
    <div className="space-y-8" data-testid="admin-predictor-panel">
      <div>
        <h2 className="text-xl font-semibold">College Predictor report</h2>
        <p className="text-sm text-slate-500">Which exams and score ranges students are checking — use it to plan follow-up calls.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([Icon, l, v]) => (
          <div key={l} className="rounded-xl border bg-white p-4" data-testid={`admin-predictor-stat-${l.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="flex items-center gap-1.5 text-xs text-slate-500"><Icon className="size-3.5" /> {l}</p>
            <p className="mt-1 text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-4">
          {r.exams.map((e) => (
            <button key={e.exam} type="button" onClick={() => setSel(e.exam)} data-testid={`admin-predictor-exam-${e.exam.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn("flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left transition-colors", active?.exam === e.exam ? "border-brand-navy ring-1 ring-brand-navy" : "hover:border-slate-300")}>
              <span>
                <span className="block font-semibold">{e.exam}</span>
                <span className="text-xs text-slate-500">{e.searches ? `Avg ${fmtScore(e.metric, e.avg_score)}` : "No searches yet"}</span>
              </span>
              <span className="text-2xl font-bold text-brand-navy">{e.searches}</span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border bg-white p-5 lg:col-span-8" data-testid="admin-predictor-chart">
          {active && (
            <>
              <p className="font-semibold">{active.exam} — score distribution</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={active.buckets}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} />
                    <Tooltip formatter={(value: number) => [`${value} searches`, "Students"]} />
                    <Bar dataKey="count" fill="#0A2540" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.keys(active.categories).length ? Object.entries(active.categories).map(([c, n]) => (
                  <span key={c} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-brand-blue">{c}: {n}</span>
                )) : <span className="text-xs text-slate-500">No category data yet</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="font-semibold">Recent predictions</h3>
          <div className="mt-3 rounded-2xl border bg-white">
            <Table data-testid="admin-predictor-recent-table">
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Exam</TableHead><TableHead>Score</TableHead><TableHead>Category</TableHead><TableHead>Where</TableHead><TableHead>Results</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.recent.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{when(p.created_at)}</TableCell>
                    <TableCell className="font-medium">{p.exam}</TableCell>
                    <TableCell>{fmtScore(p.metric, p.score)}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-xs">{p.cities.length ? p.cities.join(" & ") : "All India"}</TableCell>
                    <TableCell className="text-xs">{p.results} <span className="text-green-700">({p.high} high)</span></TableCell>
                  </TableRow>
                ))}
                {!r.recent.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-slate-500">No predictions yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <h3 className="font-semibold">Leads from the predictor <span className="text-sm font-normal text-slate-500">— call these first</span></h3>
          <div className="mt-3 rounded-2xl border bg-white">
            <Table data-testid="admin-predictor-leads-table">
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Student</TableHead><TableHead>Prediction</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {predictorLeads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{when(l.created_at)}</TableCell>
                    <TableCell><p className="font-medium">{l.name}</p><a href={`tel:+91${l.phone}`} className="text-xs text-brand-blue">+91 {l.phone}</a></TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-slate-600">{l.message.replace(/^Predictor: /, "")}</TableCell>
                    <TableCell className="text-xs">{l.status}</TableCell>
                  </TableRow>
                ))}
                {!predictorLeads.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-slate-500">No predictor leads yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
