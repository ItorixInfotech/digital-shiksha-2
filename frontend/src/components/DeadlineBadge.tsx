import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

/** "X days left to apply" from the server-computed days_left (null = rolling / no fixed deadline). */
export default function DeadlineBadge({ daysLeft, deadline, testid, className }: { daysLeft: number | null; deadline: string; testid: string; className?: string }) {
  if (daysLeft === null) return null;
  const closed = daysLeft < 0;
  const text = closed ? "Applications closed" : daysLeft === 0 ? "Last day to apply" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left to apply`;
  const tone = closed ? "bg-slate-100 text-slate-500 ring-slate-200"
    : daysLeft <= 30 ? "bg-red-50 text-red-700 ring-red-200"
    : daysLeft <= 90 ? "bg-amber-50 text-amber-800 ring-amber-200"
    : "bg-green-50 text-green-800 ring-green-200";
  return (
    <span title={closed ? `Deadline was ${deadline}` : `Counted to the end of ${deadline} — check the official site for the exact date`}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", tone, className)} data-testid={testid}>
      <Hourglass className={cn("size-3", !closed && daysLeft <= 30 && "animate-pulse")} /> {text}
    </span>
  );
}
