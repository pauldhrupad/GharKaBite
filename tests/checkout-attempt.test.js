import { describe, expect, it } from "vitest";
import { readCheckoutAttempt, writeCheckoutAttempt, remainingCartAfterCheckout } from "@/lib/checkout-attempt";

function memoryStorage() { const data = new Map(); return { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; }
const draft = { userId: "customer-a", form: Object.fromEntries(["fullName", "mobile", "email", "house", "street", "area", "landmark", "city", "pinCode", "notes"].map((field) => [field, "test"])), attempt: { checkoutKey: "11111111-1111-1111-1111-111111111111", items: [{ mealId: "saved-thali" }], pricingRevision: "original-signed-revision" } };
describe("tab-scoped uncertain checkout recovery", () => {
  it("restores the exact original request after reload, then clears on success", () => {
    const storage = memoryStorage();
    expect(writeCheckoutAttempt(storage, draft)).toBe(true);
    expect(readCheckoutAttempt(storage, "customer-a")).toEqual(draft);
    writeCheckoutAttempt(storage, null);
    expect(readCheckoutAttempt(storage, "customer-a")).toBe(null);
  });
  it("does not restore another account's contact details or invalid storage", () => {
    const storage = memoryStorage(); writeCheckoutAttempt(storage, draft);
    expect(readCheckoutAttempt(storage, "customer-b")).toBe(null);
    expect(readCheckoutAttempt(storage, "customer-a")).toBe(null);
    writeCheckoutAttempt(storage, { ...draft, form: {} });
    expect(readCheckoutAttempt(storage, "customer-a")).toBe(null);
  });
  it("keeps blocked storage from breaking checkout", () => {
    const storage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
    expect(readCheckoutAttempt(storage, "customer-a")).toBe(null);
    expect(writeCheckoutAttempt(storage, draft)).toBe(false);
  });
  it("removes only the quantities and configurations actually ordered", () => {
    const meal = { key: "saved", mealId: "test-thali", quantity: 3, serviceDate: "2026-10-18", deliveryMealPeriod: "Dinner", selectedChoices: { base: ["rice"] }, selectedAddOns: {} };
    const other = { ...meal, key: "other", quantity: 1, selectedChoices: { base: ["roti"] } };
    const payload = { serviceDate: meal.serviceDate, mealPeriod: "Dinner", items: [{ mealId: meal.mealId, quantity: 2, selectedChoices: meal.selectedChoices, selectedAddOns: {} }] };
    expect(remainingCartAfterCheckout([meal, other], payload)).toEqual([{ ...meal, quantity: 1 }, other]);
    expect(remainingCartAfterCheckout([meal], { ...payload, items: [{ ...payload.items[0], quantity: 3 }] })).toEqual([]);
    expect(remainingCartAfterCheckout([meal], { ...payload, serviceDate: "2026-10-17" })).toEqual([meal]);
    expect(remainingCartAfterCheckout([meal], { ...payload, mealPeriod: "Lunch" })).toEqual([meal]);
    expect(meal.quantity).toBe(3);
  });
});
