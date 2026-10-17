import { customizationSignature } from "./thali";

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

export function remainingCartAfterCheckout(items, payload) {
  return items.flatMap((item) => {
    if (item.serviceDate !== payload.serviceDate || item.deliveryMealPeriod !== payload.mealPeriod) return [item];
    const ordered = payload.items.find((entry) => entry.mealId === item.mealId && customizationSignature(entry.selectedChoices, entry.selectedAddOns) === customizationSignature(item.selectedChoices, item.selectedAddOns));
    if (!ordered) return [item];
    const quantity = item.quantity - ordered.quantity;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
