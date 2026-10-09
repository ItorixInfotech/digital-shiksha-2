import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

export interface EnquiryPrefill {
  college?: string;
  course_interest?: string;
  source?: string;
  title?: string;
}

interface SiteCtx {
  compare: string[];
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;
  setCompareList: (slugs: string[]) => void;
  enquiry: EnquiryPrefill | null;
  openEnquiry: (prefill?: EnquiryPrefill) => void;
  closeEnquiry: () => void;
}

const Ctx = createContext<SiteCtx | null>(null);
const KEY = "ds_compare";
export const MAX_COMPARE = 3;

function readCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [compare, setCompare] = useState<string[]>(readCompare);
  const [enquiry, setEnquiry] = useState<EnquiryPrefill | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(compare));
  }, [compare]);

  const toggleCompare = useCallback((slug: string) => {
    setCompare((cur) => {
      if (cur.includes(slug)) return cur.filter((s) => s !== slug);
      if (cur.length >= MAX_COMPARE) {
        toast.error(`You can compare up to ${MAX_COMPARE} colleges`);
        return cur;
      }
      return [...cur, slug];
    });
  }, []);

  const value = useMemo<SiteCtx>(
    () => ({
      compare,
      toggleCompare,
      clearCompare: () => setCompare([]),
      setCompareList: (slugs) => setCompare([...new Set(slugs)].slice(0, MAX_COMPARE)),
      enquiry,
      openEnquiry: (p) => setEnquiry(p ?? {}),
      closeEnquiry: () => setEnquiry(null),
    }),
    [compare, toggleCompare, enquiry],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite must be used inside SiteProvider");
  return v;
}
