import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { RedirectIn } from "@/lib/types";

const norm = (p: string) => p.toLowerCase().replace(/\/+$/, "") || "/";
/** Sections of this site — they render immediately; any other address waits for the redirect list first. */
const OWN = new Set(["", "colleges", "courses", "exams", "news", "predictor", "compare", "consultation"]);

function findRedirect(list: RedirectIn[], pathname: string): RedirectIn | undefined {
  const p = norm(pathname);
  // exact match wins; otherwise the longest "include sub-pages" prefix
  const hit = list.find((r) => r.from_path === p)
    ?? list.filter((r) => r.include_subpages && p.startsWith(`${r.from_path}/`)).sort((a, b) => b.from_path.length - a.from_path.length)[0];
  return hit && norm(hit.to_path) !== p ? hit : undefined;
}

/** Sends visitors from old website addresses (managed in Admin → Redirects) to their new page.
 *  Returns true while the page should be held back (redirect pending, or an unknown address awaiting the list). */
export function useOldPageRedirect(): boolean {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { data, isPending } = useQuery({ queryKey: ["redirects"], queryFn: () => apiGet<RedirectIn[]>("/redirects"), staleTime: 5 * 60_000 });
  const hit = data ? findRedirect(data, pathname) : undefined;

  useEffect(() => {
    if (!hit) return;
    if (/^https?:\/\//.test(hit.to_path)) window.location.replace(hit.to_path);
    else nav(hit.to_path, { replace: true });
  }, [hit, nav]);

  return !!hit || (isPending && !OWN.has(norm(pathname).split("/")[1] ?? ""));
}
