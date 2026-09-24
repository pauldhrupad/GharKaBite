import { describe, expect, it } from "vitest";
import { calculateThaliPrice, customizationSignature, hasRequiredUnavailable } from "@/lib/thali";

const thali = {
  price: 150, fixedItems: [{ name: "Dal" }],
  choiceGroups: [
    { id: "base", name: "Base", minSelections: 1, maxSelections: 1, options: [{ id: "rice", name: "Rice", priceAdjustment: 0, active: true }, { id: "roti", name: "Roti", priceAdjustment: 10, active: true }] },
    { id: "sides", name: "Sides", minSelections: 0, maxSelections: 2, options: [{ id: "papad", name: "Papad", priceAdjustment: 5, active: true }, { id: "chutney", name: "Chutney", priceAdjustment: 0, active: true }, { id: "salad", name: "Salad", priceAdjustment: 0, active: true }] },
  ],
  addOns: [{ id: "egg", name: "Egg", price: 20, maxQuantity: 3, stock: 4, active: true }],
};

describe("configurable Thali pricing", () => {
  it("prices choice upgrades and add-on quantities in integer rupees", () => {
    const quote = calculateThaliPrice(thali, { base: ["roti"], sides: ["papad", "salad"] }, { egg: 2 }, 2);
    expect(quote).toMatchObject({ basePrice: 150, choiceAdjustments: 15, addOnTotal: 40, unitTotal: 205, lineTotal: 410 });
    expect(quote.selectedAddOns[0]).toMatchObject({ name: "Egg", quantity: 2, price: 20 });
  });
  it("requires the base and enforces a two-side maximum", () => {
    expect(() => calculateThaliPrice(thali, {}, {})).toThrow(/choose Rice or Roti/);
    expect(() => calculateThaliPrice(thali, { base: ["rice"], sides: ["papad", "chutney", "salad"] }, {})).toThrow(/no more than 2/);
  });
  it("rejects unknown, unavailable, duplicated or excessive add-on selections", () => {
    expect(() => calculateThaliPrice(thali, { base: ["rice"], unknown: [] }, {})).toThrow(/no longer available/);
    expect(() => calculateThaliPrice(thali, { base: ["rice", "rice"] }, {})).toThrow(/Review Base/);
    expect(calculateThaliPrice({ ...thali, addOns: [{ ...thali.addOns[0], stock: 0 }] }, { base: ["rice"] }, { egg: 3 }, 2).selectedAddOns[0].quantity).toBe(3);
    expect(() => calculateThaliPrice(thali, { base: ["rice"] }, { egg: 4 }, 2)).toThrow(/unavailable/);
    expect(hasRequiredUnavailable({ ...thali, choiceGroups: [{ ...thali.choiceGroups[0], options: thali.choiceGroups[0].options.map((option) => ({ ...option, active: false })) }] })).toBe(true);
  });
  it("gives equivalent selections the same cart identity regardless of object order", () => {
    expect(customizationSignature({ base: ["rice"], sides: ["papad", "salad"] }, { egg: 2 })).toBe(customizationSignature({ sides: ["salad", "papad"], base: ["rice"] }, { egg: 2 }));
    expect(customizationSignature({ base: ["rice"] }, {})).not.toBe(customizationSignature({ base: ["roti"] }, {}));
  });
  it("retains included items from an older catalogue record", () => {
    const legacy = { price: 119, contents: ["Rice", "Dal"], fixedItems: [], choiceGroups: [], addOns: [] };
    expect(calculateThaliPrice(legacy).fixedItems).toEqual([
      { name: "Rice", description: "", preparationQuantity: 1, preparationUnit: "portion" },
      { name: "Dal", description: "", preparationQuantity: 1, preparationUnit: "portion" },
    ]);
  });
});
