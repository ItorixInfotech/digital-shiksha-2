import { apiPost, ApiError } from "@/lib/api";
import type { Lead, LeadIn } from "@/lib/types";

/** Safety net: an enquiry the server could not accept (network / 5xx) is kept in this browser and re-sent automatically. */
const KEY = "ds_pending_enquiries_v1";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

type Pending = { body: LeadIn; at: number };

const read = (): Pending[] => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || "[]") as Pending[]).filter((p) => Date.now() - p.at < MAX_AGE_MS);
  } catch {
    return [];
  }
};
const write = (list: Pending[]) => (list.length ? localStorage.setItem(KEY, JSON.stringify(list.slice(-10))) : localStorage.removeItem(KEY));

export function queueEnquiry(body: LeadIn): void {
  write([...read().filter((p) => p.body.phone !== body.phone), { body, at: Date.now() }]);
}

let flushing = false;
/** Re-send queued enquiries; drops ones the server rejects as invalid (4xx), keeps the rest for next time. */
export async function flushPendingEnquiries(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const keep: Pending[] = [];
    for (const p of read()) {
      try {
        await apiPost<Lead>("/enquiries", { ...p.body, message: `${p.body.message}\n(Re-sent automatically after a connection problem)`.trim() });
        sent++;
      } catch (e) {
        if (!(e instanceof ApiError && e.status < 500)) keep.push(p);
      }
    }
    write(keep);
  } finally {
    flushing = false;
  }
  return sent;
}
