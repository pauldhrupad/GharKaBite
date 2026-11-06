import { allowedOrderDate } from "./dates";
import { validMealPeriod } from "./meal-period";

const storageKey = "gharkabite-favorite-draft-v1";
const lifetime = 15 * 60 * 1000;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (id) => typeof id === "string" && id.length <= 60 && slug.test(id);
const record = (value) => value && typeof value === "object" && !Array.isArray(value);

export const validFavoriteToken = (token) => typeof token === "string" && tokenPattern.test(token);

export function favoriteSelection(input) {
  const { mealId, preferredPeriod, quantity, selectedChoices, selectedAddOns } = input || {};
  if (typeof mealId !== "string" || mealId.length > 150 || !slug.test(mealId) || !validMealPeriod(preferredPeriod) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10 || !record(selectedChoices) || !record(selectedAddOns)) return null;
  const groups = Object.entries(selectedChoices), extras = Object.entries(selectedAddOns);
  if (groups.length > 10 || extras.length > 30 ||
      groups.some(([key, ids]) => !validId(key) || !Array.isArray(ids) || ids.length > 20 || new Set(ids).size !== ids.length || !ids.every(validId)) ||
      extras.some(([key, count]) => !validId(key) || !Number.isInteger(count) || count < 0 || count > 20)) return null;
  return { mealId, preferredPeriod, quantity, selectedChoices: Object.fromEntries(groups.filter(([, ids]) => ids.length)), selectedAddOns: Object.fromEntries(extras.filter(([, count]) => count > 0)) };
}

export function writeFavoriteDraft(storage, token, input, date, now = Date.now()) {
  const selection = favoriteSelection(input);
  if (!selection || !validFavoriteToken(token) || !allowedOrderDate(date, new Date(now))) return false;
  try { storage.setItem(storageKey, JSON.stringify({ token, selection, date, expiresAt: now + lifetime })); return true; }
  catch { return false; }
}

export function consumeFavoriteDraft(storage, token, mealId, date, period, now = Date.now()) {
  if (!validFavoriteToken(token)) return null;
  try {
    const draft = JSON.parse(storage.getItem(storageKey) || "null");
    if (draft?.token !== token) return null;
    storage.removeItem(storageKey);
    const selection = favoriteSelection(draft.selection);
    if (!Number.isFinite(draft.expiresAt) || draft.expiresAt <= now || draft.expiresAt > now + lifetime ||
        draft.date !== date || !allowedOrderDate(date, new Date(now)) ||
        selection?.mealId !== mealId || selection.preferredPeriod !== period) return null;
    return selection;
  } catch { return null; }
}
