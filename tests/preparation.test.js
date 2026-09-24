import { describe, expect, it } from "vitest";
import { periodCutoffPassed } from "@/lib/dates";
import { getPeriodAvailability } from "@/lib/kitchen-operations";
import { summarizePreparation } from "@/lib/preparation";

const date = "2026-09-24";
const settings = { acceptingOrders: true, lunchEnabled: true, dinnerEnabled: true, lunchCutoff: "11:00", dinnerCutoff: "18:00" };
const beforeLunch = new Date("2026-09-24T10:30:00+05:30");
const afterLunch = new Date("2026-09-24T11:01:00+05:30");

function order(overrides = {}) {
  return {
    orderNumber: "GKB-1", serviceDate: date, mealPeriod: "Lunch", paymentMethod: "COD",
    paymentStatus: "pending", orderStatus: "confirmed", notes: "Less spicy",
    items: [{ kind: "thali", name: "Chicken Thali", quantity: 2,
      fixedItems: [{ name: "Chicken Curry" }],
      selectedChoices: [{ groupName: "Base", options: [{ name: "Roti", preparationQuantity: 4, preparationUnit: "pieces" }] }],
      selectedAddOns: [{ name: "Extra Egg", quantity: 1, preparationQuantity: 1, preparationUnit: "piece" }],
    }],
    ...overrides,
  };
}

describe("made-to-order cutoffs", () => {
  it("uses Kolkata server time at the cutoff boundary", () => {
    expect(periodCutoffPassed(date, "Lunch", settings, beforeLunch)).toBe(false);
    expect(periodCutoffPassed(date, "Lunch", settings, afterLunch)).toBe(true);
    expect(getPeriodAvailability("Lunch", settings, [], beforeLunch, date).available).toBe(true);
    expect(getPeriodAvailability("Lunch", settings, [], afterLunch, date)).toMatchObject({ available: false, reason: "Lunch ordering has closed for today." });
  });

  it("allows tomorrow before its cutoff while honoring manual kitchen controls", () => {
    expect(getPeriodAvailability("Lunch", settings, [], afterLunch, "2026-09-25").available).toBe(true);
    expect(getPeriodAvailability("Lunch", { ...settings, lunchEnabled: false }, [], beforeLunch, date).available).toBe(false);
    expect(getPeriodAvailability("Dinner", { ...settings, acceptingOrders: false }, [], beforeLunch, date).available).toBe(false);
  });
});

describe("preparation summary", () => {
  it("multiplies Thali, selection, and add-on amounts by ordered quantity", () => {
    const result = summarizePreparation([order()], { date, mealPeriod: "Lunch" });
    expect(result.confirmedOrders).toBe(1);
    expect(result.totalThalis).toBe(2);
    expect(result.thalis).toEqual([{ name: "Chicken Thali", unit: "Thali", quantity: 2 }]);
    expect(result.selections).toEqual([
      { name: "Chicken Curry", unit: "portion", quantity: 2 },
      { name: "Roti", unit: "pieces", quantity: 8 },
    ]);
    expect(result.addOns).toEqual([{ name: "Extra Egg", unit: "piece", quantity: 2 }]);
    expect(result.notes).toEqual([{ orderNumber: "GKB-1", text: "Less spicy" }]);
  });

  it("excludes unverified and cancelled orders, then includes a verified payment", () => {
    const online = order({ orderNumber: "GKB-2", paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending" });
    const cancelled = order({ orderNumber: "GKB-3", orderStatus: "cancelled" });
    const pending = summarizePreparation([online, cancelled], { date, mealPeriod: "Lunch" });
    expect(pending).toMatchObject({ confirmedOrders: 0, awaitingPaymentVerification: 1, cancelled: 1, totalThalis: 0 });
    const verified = summarizePreparation([{ ...online, paymentStatus: "paid", orderStatus: "confirmed" }, cancelled], { date, mealPeriod: "Lunch" });
    expect(verified).toMatchObject({ confirmedOrders: 1, awaitingPaymentVerification: 0, cancelled: 1, totalThalis: 2 });
    const afterCancellation = summarizePreparation([{ ...online, paymentStatus: "paid", orderStatus: "cancelled" }, cancelled], { date, mealPeriod: "Lunch" });
    expect(afterCancellation).toMatchObject({ confirmedOrders: 0, cancelled: 2, totalThalis: 0 });
  });

  it("reads older snapshots with a counted roti item", () => {
    const historical = order({ items: [{ kind: "thali", name: "Chicken Roti Meal", quantity: 3, fixedItems: [{ name: "4 Rotis", preparationQuantity: 1, preparationUnit: "portion" }] }] });
    expect(summarizePreparation([historical], { date, mealPeriod: "Lunch" }).selections).toEqual([{ name: "Roti", unit: "pieces", quantity: 12 }]);
  });
});
