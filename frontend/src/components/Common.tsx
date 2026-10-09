import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function PageHeader({ crumbs, title, subtitle, children, testid = "page-header" }: {
  crumbs: { label: string; to?: string }[];
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  testid?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-brand-ink text-white" data-testid={testid}>
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 size-72 rounded-full bg-brand-red/15 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {c.to ? <Link to={c.to} className="hover:text-white transition-colors">{c.label}</Link> : <span className="text-slate-300">{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" data-testid={`${testid}-title`}>{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base text-slate-300 sm:text-lg">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export function SectionTitle({ overline, title, action }: { overline?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {overline && <p className="text-xs font-bold uppercase tracking-wider text-brand-red">{overline}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, testid = "empty-state" }: { title: string; body?: string; testid?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center" data-testid={testid}>
      <p className="font-semibold text-slate-900">{title}</p>
      {body && <p className="mt-1 text-sm text-slate-500">{body}</p>}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl border bg-white">
          <div className="h-36 rounded-t-2xl bg-slate-100" />
          <div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
        </div>
      ))}
    </>
  );
}
