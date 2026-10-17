const key = "gharkabite-pending-checkout-v1";
const fields = ["fullName", "mobile", "email", "house", "street", "area", "landmark", "city", "pinCode", "notes"];

export function readCheckoutAttempt(storage, userId) {
  try {
    const draft = JSON.parse(storage.getItem(key) || "null");
    if (!draft) return null;
    if (draft.userId !== userId || !fields.every((field) => typeof draft.form?.[field] === "string") || !/^[0-9a-f-]{36}$/i.test(draft.attempt?.checkoutKey || "") || !Array.isArray(draft.attempt.items)) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch { return null; }
}

export function writeCheckoutAttempt(storage, draft) {
  try {
    if (draft?.attempt) storage.setItem(key, JSON.stringify(draft));
    else storage.removeItem(key);
    return true;
  } catch { return false; }
}
