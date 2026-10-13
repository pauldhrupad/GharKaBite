import { describe, expect, it } from "vitest";
import { checkedDeliveryLabel, initialHomePeriod, mealDetailHref, validMealPeriod } from "@/lib/meal-period";
import { defaultKitchenSettings, getPeriodAvailability } from "@/lib/kitchen-operations";
import { kolkataDate } from "@/lib/dates";

const date = "2026-10-13";
const meals = [{ available: true, slots: ["Lunch", "Dinner"] }];
const at = (time) => new Date(`${date}T${time}:00+05:30`);

describe("homepage ordering navigation", () => {
  it("keeps a valid explicit selection, including a closed period for browsing", () => {
    expect(initialHomePeriod("Lunch", defaultKitchenSettings, meals, at("12:00"), date)).toBe("Lunch");
    expect(initialHomePeriod("Dinner", defaultKitchenSettings, meals, at("09:00"), date)).toBe("Dinner");
  });
  it("uses Kolkata cutoff boundaries and prefers meals available for the open period", () => {
    expect(initialHomePeriod(null, defaultKitchenSettings, meals, at("10:59"), date)).toBe("Lunch");
    expect(initialHomePeriod(null, defaultKitchenSettings, meals, at("11:00"), date)).toBe("Dinner");
    expect(initialHomePeriod(null, defaultKitchenSettings, [{ available: true, slots: ["Dinner"] }], at("09:00"), date)).toBe("Dinner");
  });
  it("respects configured cutoffs, kitchen pauses and disabled periods", () => {
    const settings = { ...defaultKitchenSettings, lunchCutoff: "13:00", dinnerEnabled: false };
    expect(initialHomePeriod("unknown", settings, meals, at("12:00"), date)).toBe("Lunch");
    expect(getPeriodAvailability("Dinner", settings, [], at("12:00"), date).available).toBe(false);
    expect(getPeriodAvailability("Lunch", { ...settings, acceptingOrders: false }, [], at("12:00"), date).available).toBe(false);
    expect(getPeriodAvailability("Lunch", settings, [], at("13:00"), date).available).toBe(false);
  });
  it("rolls dates at Kolkata midnight without treating tomorrow as past cutoff", () => {
    expect(kolkataDate(0, at("23:59"))).toBe(date);
    const midnight = new Date("2026-10-13T18:30:00Z");
    expect(kolkataDate(0, midnight)).toBe("2026-10-14");
    expect(getPeriodAvailability("Lunch", defaultKitchenSettings, [], at("23:59"), "2026-10-14").available).toBe(true);
  });
  it("preserves Dinner and date in every shared meal-card link", () => {
    const href = mealDetailHref("veg-home-meal", date, "Dinner");
    expect(href).toBe(`/menu/veg-home-meal?date=${date}&period=Dinner`);
    expect(validMealPeriod(new URL(href, "http://localhost").searchParams.get("period"), meals[0].slots)).toBe("Dinner");
  });
  it("rejects malformed and unsupported periods", () => {
    expect(validMealPeriod(["Dinner"])).toBeUndefined();
    expect(validMealPeriod("Dinner", ["Lunch"])).toBeUndefined();
    expect(validMealPeriod("dinner")).toBeUndefined();
    expect(mealDetailHref("veg-home-meal", date, "invalid")).toBe(`/menu/veg-home-meal?date=${date}`);
  });
  it("only publishes delivery labels after serviceability is confirmed", () => {
    expect(checkedDeliveryLabel(null, "Test address")).toBe("");
    expect(checkedDeliveryLabel({ serviceable: false }, "Test address")).toBe("");
    expect(checkedDeliveryLabel({ serviceable: true }, " Test address ")).toBe("Test address");
    expect(checkedDeliveryLabel({ serviceable: true, address: { area: "Test Area", city: "Kolkata" } }, "Street address")).toBe("Test Area, Kolkata");
  });
});
