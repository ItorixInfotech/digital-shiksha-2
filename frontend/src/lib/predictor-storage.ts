// Browser storage for the College Predictor. Only non-sensitive values live here:
// unlock tokens are kept in the httpOnly `ds_unlocks` cookie set by POST /api/predictor/unlock (never readable by JS).

/** localStorage: "1" once this device has filled the details pop-up (no personal data). */
export const GATE_KEY = "ds_predictor_details_v1";
/** sessionStorage (cleared when the tab closes): {name, phone} from the pop-up, used only to prefill the payment step. */
export const CONTACT_KEY = "ds_predictor_contact_v1";
/** localStorage: the predictor query string to restore if Razorpay redirects back (exam/score filters only). */
export const PENDING_KEY = "ds_predictor_pending_v1";

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
}
