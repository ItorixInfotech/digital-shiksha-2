/** Unsaved admin edits, kept in this browser until saved or discarded (content only — no secrets). */
export interface Draft<T> {
  data: T;
  savedAt: number;
}

const PREFIX = "ds-admin-draft:";

export const draftKey = (resource: string, id: string | null) => `${PREFIX}${resource}:${id ?? "new"}`;

export function loadDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft<T>) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T): number {
  const savedAt = Date.now();
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt }));
  } catch {
    /* storage full or blocked — autosave is best-effort */
  }
  return savedAt;
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** ids of records in `resource` that have a draft ("new" for an unsaved new record). */
export function draftIds(resource: string): Set<string> {
  const out = new Set<string>();
  try {
    const p = `${PREFIX}${resource}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(p)) out.add(k.slice(p.length));
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function timeAgo(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
