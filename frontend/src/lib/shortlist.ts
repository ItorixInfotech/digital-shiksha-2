import { useSyncExternalStore } from "react";
import type { College } from "@/lib/types";

/** Students' saved colleges, kept in this browser (no login needed). Shared by every card and the shortlist sheet. */
export type SavedCollege = Pick<College, "slug" | "name" | "city" | "state" | "logo" | "image" | "fees_min" | "fees_max">;

const KEY = "ds_shortlist_v1";
const MAX = 30;
const listeners = new Set<() => void>();
let cache: SavedCollege[] | null = null;

function read(): SavedCollege[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]") as SavedCollege[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: SavedCollege[]) {
  cache = list.slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cache = null; listeners.forEach((l) => l()); } });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useShortlist() {
  const list = useSyncExternalStore(subscribe, read, () => [] as SavedCollege[]);
  const has = (slug: string) => list.some((c) => c.slug === slug);
  const toggle = (c: SavedCollege): boolean => {
    const on = !has(c.slug);
    write(on ? [{ slug: c.slug, name: c.name, city: c.city, state: c.state, logo: c.logo, image: c.image, fees_min: c.fees_min, fees_max: c.fees_max }, ...list] : list.filter((x) => x.slug !== c.slug));
    return on;
  };
  const remove = (slug: string) => write(list.filter((x) => x.slug !== slug));
  const clear = () => write([]);
  return { list, has, toggle, remove, clear };
}
