import { describe, expect, it } from "vitest";
import { additionalMenuCategories, illustratedCategories, matchesMenuCategory } from "@/lib/menu-categories";

describe("customer food categories", () => {
  it("keeps all six custom illustrations and the existing plans route", () => {
    expect(illustratedCategories.map((category) => category.image)).toEqual([
      "veg-thali.webp", "egg-thali.webp", "chicken-thali.webp", "fish-thali.webp", "add-ons.webp", "meal-plans.webp",
    ]);
    expect(illustratedCategories.at(-1).href).toBe("/plans");
  });

  it.each(["Veg", "Egg", "Chicken", "Fish"])("filters %s Thalis without treating individual dishes as Thalis", (category) => {
    expect(matchesMenuCategory({ kind: "thali", category }, category)).toBe(true);
    expect(matchesMenuCategory({ kind: "dish", category }, category)).toBe(false);
    expect(matchesMenuCategory({ kind: "thali", category: "Special" }, category)).toBe(false);
    expect(matchesMenuCategory({ category }, category)).toBe(true);
  });

  it("shows only Thalis with active extras in the add-on experience", () => {
    expect(matchesMenuCategory({ kind: "thali", addOns: [{ active: true }] }, "Add-ons")).toBe(true);
    expect(matchesMenuCategory({ addOns: [{}] }, "Add-ons")).toBe(true);
    expect(matchesMenuCategory({ addOns: [{ active: false }] }, "Add-ons")).toBe(false);
    expect(matchesMenuCategory({ addOns: [] }, "Add-ons")).toBe(false);
    expect(matchesMenuCategory({ kind: "dish", addOns: [{ active: true }] }, "Add-ons")).toBe(false);
  });

  it("preserves additional categories and keeps individual dishes in All meals", () => {
    expect(additionalMenuCategories([{ category: "Veg" }, { category: "Special" }, { category: "Seasonal" }, { category: "Seasonal" }])).toEqual(["Special", "Seasonal"]);
    expect(matchesMenuCategory({ kind: "dish", category: "Seasonal" }, "Seasonal")).toBe(true);
    expect(matchesMenuCategory({ kind: "dish", category: "Veg" }, "All")).toBe(true);
  });
});
