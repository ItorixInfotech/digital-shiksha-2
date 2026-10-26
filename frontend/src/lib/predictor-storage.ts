// Browser storage for the College Predictor. Only non-sensitive values live here:
// unlock tokens are kept in the httpOnly `ds_unlocks` cookie set by POST /api/predictor/unlock (never readable by JS).

/** localStorage: "1" once this device has filled the details pop-up (no personal data). */
export const GATE_KEY = "ds_predictor_details_v1";
/** sessionStorage (cleared when the tab closes): {name, phone} from the pop-up, used only to prefill the payment step. */
export const CONTACT_KEY = "ds_predictor_contact_v1";
/** sessionStorage (this tab only): the predictor query string the student is paying for, so the page can
 *  restore it and confirm the payment automatically when Razorpay sends them back (exam/score filters only). */
export const PENDING_KEY = "ds_predictor_pending_v2";
const PENDING_TTL = 3 * 60 * 60 * 1000;

export interface PendingPayment {
  qs: string;
  exam: string;
  score: string;
  at: number;
}

export function setPending(qs: string) {
  const p = new URLSearchParams(qs);
  p.delete("razorpay_payment_id"); p.delete("paid");
  const v: PendingPayment = { qs: p.toString(), exam: p.get("exam") ?? "", score: p.get("score") ?? "", at: Date.now() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(v));
}

export function readPending(): PendingPayment | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as PendingPayment | null;
    return v && Date.now() - v.at < PENDING_TTL ? v : null;
  } catch {
    return null;
  }
}

export const clearPending = () => sessionStorage.removeItem(PENDING_KEY);

export interface PredictorContact {
  name: string;
  phone: string;
}

export function readContact(): PredictorContact {
  try {
    const v = JSON.parse(sessionStorage.getItem(CONTACT_KEY) ?? "{}") as Partial<PredictorContact>;
    return { name: v.name ?? "", phone: v.phone ?? "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export const saveContact = (c: PredictorContact) => sessionStorage.setItem(CONTACT_KEY, JSON.stringify(c));

/** Clean up the old localStorage copies written by earlier versions. */
export function dropLegacyStorage() {
  localStorage.removeItem(CONTACT_KEY);
  localStorage.removeItem("ds_predictor_unlocks_v1");
  localStorage.removeItem("ds_predictor_pending_v1");
}
