import { describe, expect, it } from "vitest";
import { calculateThaliPrice, previewThaliPrice, customizationSignature, hasRequiredUnavailable } from "@/lib/thali";

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

describe("builder pricing safety", () => {
  it.each([1, 2, 10])("keeps the complete public quote and preview identical at quantity %s", (quantity) => {
    const choices = { base: ["roti"], sides: ["papad", "salad"] };
    const strict = calculateThaliPrice(thali, choices, { egg: 2 }, quantity);
    expect(Object.keys(strict).sort()).toEqual(["basePrice", "choiceAdjustments", "addOnTotal", "unitTotal", "lineTotal", "fixedItems", "selectedChoices", "selectedAddOns"].sort());
    expect(strict).toMatchObject({ basePrice: 150, choiceAdjustments: 15, addOnTotal: 40, unitTotal: 205, lineTotal: 205 * quantity });
    const { incompleteGroups, ...preview } = previewThaliPrice(thali, choices, { egg: 2 }, quantity);
    expect(preview).toEqual(strict);
    expect(incompleteGroups).toEqual([]);
  });
  it("only previews missing required choices; strict cart validation still rejects them", () => {
    expect(previewThaliPrice(thali, {}, { egg: 2 }, 2)).toMatchObject({ unitTotal: 190, lineTotal: 380, incompleteGroups: ["base"] });
    expect(() => calculateThaliPrice(thali, {}, { egg: 2 }, 2)).toThrow(/choose/);
  });
  it("supports required multi-choice groups and unselected optional groups", () => {
    const meal = { ...thali, choiceGroups: [{ ...thali.choiceGroups[1], minSelections: 2 }] };
    expect(previewThaliPrice(meal, { sides: ["papad"] })).toMatchObject({ unitTotal: 155, incompleteGroups: ["sides"] });
    expect(() => calculateThaliPrice(meal, { sides: ["papad"] })).toThrow(/choose/);
    expect(calculateThaliPrice(thali, { base: ["rice"] }).unitTotal).toBe(150);
  });
  it.each([0, 11, 1.5, NaN])("rejects invalid quantity %s in both paths", (quantity) => {
    for (const calculate of [calculateThaliPrice, previewThaliPrice]) expect(() => calculate(thali, { base: ["rice"] }, {}, quantity)).toThrow(/1 to 10/);
  });
  it.each([
    [{ base: ["gone"] }, {}, /unavailable/],
    [{ base: ["rice", "rice"] }, {}, /Review/],
    [{ base: ["rice"], sides: ["papad", "salad", "chutney"] }, {}, /no more than/],
    [{ base: ["rice"], removed: [] }, {}, /no longer/],
    [{ base: ["rice"] }, { gone: 1 }, /no longer/],
    [{ base: ["rice"] }, { egg: 4 }, /unavailable/],
    [{ base: ["rice"] }, { egg: 0.5 }, /quantity/],
  ])("never accepts an invalid selection as a provisional price", (choices, extras, message) => {
    for (const calculate of [calculateThaliPrice, previewThaliPrice]) expect(() => calculate(thali, choices, extras)).toThrow(message);
  });
  it.each([NaN, Infinity, -1, 0.5])("rejects invalid monetary value %s", (price) => {
    for (const calculate of [calculateThaliPrice, previewThaliPrice]) {
      expect(() => calculate({ ...thali, price }, { base: ["rice"] })).toThrow(/pricing/);
      expect(() => calculate({ ...thali, addOns: [{ ...thali.addOns[0], price }] }, { base: ["rice"] }, { egg: 1 })).toThrow(/pricing/);
    }
  });
  it("blocks contradictory or impossible configuration rather than showing a total", () => {
    for (const group of [
      { ...thali.choiceGroups[0], minSelections: 2, maxSelections: 1 },
      { ...thali.choiceGroups[0], minSelections: 0.5 },
      { ...thali.choiceGroups[0], options: [] },
      { ...thali.choiceGroups[0], options: thali.choiceGroups[0].options.map((option) => ({ ...option, active: false })) },
    ]) for (const calculate of [calculateThaliPrice, previewThaliPrice]) expect(() => calculate({ ...thali, choiceGroups: [group] })).toThrow(/configuration|unavailable/);
  });
  it("keeps zero-cost extras and single dishes valid without stock limits", () => {
    const meal = { price: 40, contents: ["Test dish"], choiceGroups: [], addOns: [{ id: "free", name: "Free side", price: 0, maxQuantity: 2, stock: 0 }] };
    expect(previewThaliPrice(meal, {}, { free: 2 })).toMatchObject({ unitTotal: 40, incompleteGroups: [] });
    expect(calculateThaliPrice(meal, {}, { free: 2 }).lineTotal).toBe(40);
  });
});
