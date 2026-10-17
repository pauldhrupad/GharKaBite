import { describe, expect, it } from "vitest";
import { reviewCartItems } from "@/lib/use-cart-review";
import { priceBreakdownChanges, savedCartBreakdown } from "@/lib/cart-pricing";

const meal = { id: "custom-thali", name: "Custom Thali", available: true, slots: ["Lunch", "Dinner"], price: 100, choiceGroups: [{ id: "base", name: "Base", minSelections: 1, maxSelections: 1, options: [{ id: "rice", name: "Rice", priceAdjustment: 10 }] }], addOns: [{ id: "dal", name: "Dal", price: 20, maxQuantity: 2 }] };
const item = { key: "saved", mealId: meal.id, deliveryMealPeriod: "Dinner", quantity: 2, price: 130, basePrice: 100, selectedChoices: { base: ["rice"] }, selectedAddOns: { dal: 1 }, choiceSummary: [{ groupId: "base", options: [{ id: "rice", priceAdjustment: 10 }] }], addOnSummary: [{ id: "dal", price: 20, quantity: 1 }] };
describe("cart review", () => {
  it("checks saved IDs without replacing choices or mutating the cart", () => {
    const before = structuredClone(item);
    expect(reviewCartItems([item], [meal])[0].blocked).toBe(false);
    expect(reviewCartItems([item], [{ ...meal, price: 110 }])[0].priceChanged).toBe(true);
    expect(reviewCartItems([item], [])[0].blocked).toBe(true);
    expect(item).toEqual(before);
  });
  it("blocks removed choices, unsupported periods and legacy selections", () => {
    expect(reviewCartItems([item], [{ ...meal, choiceGroups: [] }])[0].blocked).toBe(true);
    expect(reviewCartItems([item], [{ ...meal, slots: ["Lunch"] }])[0].blocked).toBe(true);
    expect(reviewCartItems([{ ...item, needsReview: true }], [meal])[0].blocked).toBe(true);
  });
  it("detects offsetting component changes even when the total is unchanged", () => {
    const previous = { items: savedCartBreakdown([item]), subtotal: 260, total: 280, deliveryFee: 20 };
    const current = { ...previous, items: [{ ...previous.items[0], basePrice: 110, choiceAdjustments: 0 }] };
    expect(priceBreakdownChanges(previous, current)).toHaveLength(1);
    expect(priceBreakdownChanges(previous, structuredClone(previous))).toEqual([]);
    expect(priceBreakdownChanges(previous, { ...previous, deliveryFee: 0, total: 260 })).toHaveLength(2);
  });
});
