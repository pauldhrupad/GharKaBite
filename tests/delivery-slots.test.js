import { describe, expect, it } from "vitest";
import { deliverySlots, slotExpired } from "@/lib/dates";

describe("shared delivery slots", () => {
  it("preserves the existing slot values", () => {
    expect(deliverySlots.Lunch).toEqual(["12–1 PM", "1–2 PM"]);
    expect(deliverySlots.Dinner).toEqual(["7–8 PM", "8–9 PM", "9–9:30 PM"]);
  });
  it("closes exactly at the Kolkata slot start, without closing tomorrow", () => {
    expect(slotExpired("2026-10-17", "Lunch", "12–1 PM", new Date("2026-10-17T11:59:59+05:30"))).toBe(false);
    expect(slotExpired("2026-10-17", "Lunch", "12–1 PM", new Date("2026-10-17T12:00:00+05:30"))).toBe(true);
    expect(slotExpired("2026-10-18", "Dinner", "7–8 PM", new Date("2026-10-17T23:59:59+05:30"))).toBe(false);
    expect(slotExpired("2026-10-17", "Dinner", "9–9:30 PM", new Date("2026-10-17T21:00:00+05:30"))).toBe(true);
  });
});
