import { describe, expect, it } from "vitest";
import { cartItemKey, mergeRepeatCart, orderSelections, repeatAvailability, repeatPriceKey, reviewRepeatLine } from "@/lib/repeat-order";
import { consumeFavoriteDraft, writeFavoriteDraft } from "@/lib/favorite-draft";
import { customerReturnTo } from "@/lib/auth-navigation";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";

const date = "2026-11-07", period = "Dinner";
const meal = {
  id: "starter-thali", name: "Starter Thali", available: true, slots: ["Lunch", "Dinner"], price: 140,
  choiceGroups: [{ id: "base", name: "Base", minSelections: 1, maxSelections: 1, options: [{ id: "rice", name: "Rice" }, { id: "roti", name: "Roti" }] }],
  addOns: [{ id: "dal", name: "Extra Dal", price: 10, maxQuantity: 3 }],
};
const row = { id: "0", name: meal.name, mealId: meal.id, quantity: 2, selectedChoices: { base: ["rice"] }, selectedAddOns: { dal: 1 }, price: 140 };
const cartRow = { ...row, key: cartItemKey(row.mealId, period, row.selectedChoices, row.selectedAddOns), price: 150, serviceDate: date, deliveryMealPeriod: period };
const context = { date, period, menu: [meal] };

describe("repeat meal review", () => {
  it("restores every historical line without changing quantity, choices or extras", () => {
    const item = { mealId: meal.id, name: meal.name, price: 130, quantity: 3, selectedChoices: [{ groupId: "base", options: [{ id: "roti", name: "Roti" }] }], selectedAddOns: [{ id: "dal", quantity: 2 }] };
    expect(orderSelections({ items: [item, { ...item, quantity: 5 }] })).toMatchObject([{ id: "0", quantity: 3, selectedChoices: { base: ["roti"] }, selectedAddOns: { dal: 2 }, price: 130 }, { id: "1", quantity: 5 }]);
  });
  it("checks price, period, removed choices and reduced limits without changing the saved line", () => {
    const valid = reviewRepeatLine(row, [meal], period);
    expect(valid.price).toMatchObject({ unitTotal: 150, lineTotal: 300 });
    expect(repeatPriceKey([valid])).not.toBe(repeatPriceKey([reviewRepeatLine(row, [{ ...meal, price: 150, addOns: [{ ...meal.addOns[0], price: 0 }] }], period)]));
    expect(reviewRepeatLine(row, [], period).issues).toContain("This meal is no longer on the menu.");
    const updated = { ...meal, slots: ["Lunch"], choiceGroups: [{ ...meal.choiceGroups[0], options: [{ id: "roti", name: "Roti" }] }], addOns: [] };
    expect(reviewRepeatLine(row, [updated], period).issues.join(" ")).toMatch(/Dinner.*rice.*dal/i);
    expect(reviewRepeatLine({ ...row, selectedAddOns: { dal: 4 } }, [meal], period).issues).toHaveLength(1);
    expect(row.selectedChoices).toEqual({ base: ["rice"] });
    expect(row.selectedAddOns).toEqual({ dal: 1 });
  });
  it("blocks expired dates, invalid periods, kitchen pauses and started slots", () => {
    expect(repeatAvailability(date, period, defaultKitchenSettings, new Date("2026-11-06T12:00:00+05:30"))).toBe("");
    expect(repeatAvailability(date, period, defaultKitchenSettings, new Date("2026-11-08T00:00:00+05:30"))).toMatch(/date/);
    expect(repeatAvailability(date, "Brunch", defaultKitchenSettings, new Date("2026-11-06T12:00:00+05:30"))).toMatch(/Lunch or Dinner/);
    expect(repeatAvailability(date, period, { ...defaultKitchenSettings, acceptingOrders: false }, new Date("2026-11-06T12:00:00+05:30"))).toMatch(/paused/);
    expect(repeatAvailability(date, period, { ...defaultKitchenSettings, dinnerCutoff: "23:59" }, new Date("2026-11-07T21:05:00+05:30"))).toMatch(/slots have started/);
  });
  it("detects changed ingredients even when IDs and prices are unchanged", () => {
    const saved = { ...row, fixedItems: [{ name: "Aloo Bhaja", preparationQuantity: 1, preparationUnit: "portion" }], choiceSummary: [{ groupId: "base", options: [{ id: "rice", name: "Rice" }] }] };
    const before = reviewRepeatLine(saved, [{ ...meal, fixedItems: saved.fixedItems }], period);
    const after = reviewRepeatLine(saved, [{ ...meal, fixedItems: [{ name: "Mixed Sabzi" }], choiceGroups: [{ ...meal.choiceGroups[0], options: [{ id: "rice", name: "Jeera Rice" }, meal.choiceGroups[0].options[1]] }] }], period);
    expect(before.changes).toEqual([]);
    expect(after.price.unitTotal).toBe(before.price.unitTotal);
    expect(after.changes.join(" ")).toMatch(/Mixed Sabzi.*Jeera Rice/);
    expect(repeatPriceKey([after])).not.toBe(repeatPriceKey([before]));
  });
  it("merges exact quantities without touching unrelated existing rows", () => {
    const other = { ...cartRow, key: cartItemKey(row.mealId, period, { base: ["roti"] }, row.selectedAddOns), quantity: 1, selectedChoices: { base: ["roti"] } };
    const existing = [cartRow, other];
    const applied = mergeRepeatCart(existing, [{ ...cartRow, quantity: 3 }], context);
    expect(applied[0].quantity).toBe(5);
    expect(applied[1]).toBe(other);
    expect(existing[0].quantity).toBe(2);
  });
  it("does not clamp a quantity, accept invalid existing rows or replace without consent", () => {
    expect(() => mergeRepeatCart([cartRow], [{ ...cartRow, quantity: 9 }], context)).toThrow(/exceed 10/);
    expect(() => mergeRepeatCart([], [{ ...cartRow, quantity: 11 }], context)).toThrow(/1 to 10/);
    expect(() => mergeRepeatCart([{ ...cartRow, price: 1 }], [cartRow], context)).toThrow(/price.*changed/);
    expect(() => mergeRepeatCart([{ ...cartRow, key: "wrong" }], [cartRow], context)).toThrow(/existing meals/);
    expect(() => mergeRepeatCart([{ ...cartRow, serviceDate: "2026-11-06" }], [cartRow], context)).toThrow(/another date/);
    expect(mergeRepeatCart([{ ...cartRow, serviceDate: "2026-11-06" }], [cartRow], { ...context, replace: true })).toEqual([cartRow]);
    expect(mergeRepeatCart([cartRow], [cartRow], { ...context, replace: true })[0].quantity).toBe(4);
    const menu = Array.from({ length: 21 }, (_, index) => ({ ...meal, id: `meal-${index}` }));
    const additions = menu.map((entry) => ({ ...cartRow, key: cartItemKey(entry.id, period, row.selectedChoices, row.selectedAddOns), mealId: entry.id }));
    expect(() => mergeRepeatCart([], additions, { ...context, menu })).toThrow(/20 different/);
  });
});

describe("guest favorite return", () => {
  const token = "31236881-f3f7-44a4-af8d-fca2285cbb8b";
  const now = Date.parse("2026-11-07T12:00:00+05:30");
  const selection = { mealId: meal.id, preferredPeriod: period, quantity: 2, selectedChoices: { base: ["rice"] }, selectedAddOns: { dal: 1 } };
  const tabStorage = () => {
    const data = new Map();
    return { data, getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  };
  it("keeps only public selections and consumes a matching draft exactly once", () => {
    const storage = tabStorage();
    expect(writeFavoriteDraft(storage, token, { ...selection, email: "secret@test", orderNumber: "secret", price: 10 }, date, now)).toBe(true);
    expect([...storage.data.values()][0]).not.toMatch(/secret|price|email/);
    expect(consumeFavoriteDraft(storage, token, meal.id, date, period, now + 1000)).toEqual(selection);
    expect(consumeFavoriteDraft(storage, token, meal.id, date, period, now + 1000)).toBeNull();
  });
  it("rejects a replay, changed context, expiration and unsafe returns", () => {
    const storage = tabStorage();
    expect(writeFavoriteDraft(storage, token, selection, date, now)).toBe(true);
    expect(consumeFavoriteDraft(storage, token, meal.id, date, "Lunch", now + 1000)).toBeNull();
    expect(consumeFavoriteDraft(storage, token, meal.id, date, period, now + 1000)).toBeNull();
    writeFavoriteDraft(storage, token, selection, date, now);
    expect(consumeFavoriteDraft(storage, token, meal.id, date, period, now + 900000)).toBeNull();
    expect(writeFavoriteDraft(storage, token, { ...selection, quantity: 11 }, date, now)).toBe(false);
    expect(customerReturnTo("//example.test")).toBe("/profile");
    expect(customerReturnTo(`/menu/${meal.id}?date=${date}&period=${period}&favoriteDraft=${token}`)).toContain(token);
  });
});
