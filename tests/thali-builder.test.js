import { describe, expect, it } from "vitest";
import { reviewThaliSelections, thaliPreviewImage, requiredChoiceProgress } from "@/lib/thali-builder";

describe("builder imagery and explicit recovery", () => {
  it.each([
    ["veg-home-meal", "bengali-thali.jpg", "veg-thali"],
    ["egg-curry-meal", "dal-rice.jpg", "egg-thali"],
    ["chicken-home-meal", "chicken-meal.jpg", "chicken-thali"],
    ["fish-curry-meal", "home-table.jpg", "fish-thali"],
  ])("only substitutes the verified starter pair for %s", (id, image, artwork) => {
    expect(thaliPreviewImage({ id, image: `/images/${image}` })).toEqual({ src: `/images/categories/${artwork}.webp`, illustration: true });
    expect(thaliPreviewImage({ id, image: "https://res.cloudinary.com/test/new-meal.jpg" })).toEqual({ src: "https://res.cloudinary.com/test/new-meal.jpg", illustration: false });
    expect(thaliPreviewImage({ id: "admin-special", image: `/images/${image}` }).src).toBe(`/images/${image}`);
  });
  it("supports missing imagery without inventing a replacement", () => {
    expect(thaliPreviewImage({ id: "admin-special" })).toEqual({ src: "", illustration: false });
  });
  const meal = { choiceGroups: [{ id: "base", name: "Base", options: [{ id: "rice", name: "Rice" }, { id: "roti", name: "Roti", active: false }] }], addOns: [{ id: "dal", name: "Dal", maxQuantity: 1 }] };
  it("identifies removed items by their previous labels and never mutates saved selections", () => {
    const choices = { base: ["rice", "roti"], old: ["old-option"] };
    const extras = { dal: 3, gone: 2 };
    const before = JSON.stringify([choices, extras]);
    const review = reviewThaliSelections(meal, choices, extras, { choiceSummary: [{ groupId: "old", groupName: "Old sides", options: [{ id: "old-option", name: "Chutney" }] }], addOnSummary: [{ id: "gone", name: "Dessert" }] });
    expect(review.issues.join(" ")).toMatch(/Roti.*Old sides: Chutney.*Dessert/);
    expect(review.cleanChoices).toEqual({ base: ["rice"] });
    expect(review.cleanAddOns).toEqual({ dal: 3 });
    expect(JSON.stringify([choices, extras])).toBe(before);
  });
  it("retains all valid selections regardless of admin order", () => {
    expect(reviewThaliSelections(meal, { base: ["rice"] }, { dal: 1 }).issues).toEqual([]);
    expect(reviewThaliSelections(meal, { base: ["rice"] }, { dal: 1 }).cleanChoices).toEqual({ base: ["rice"] });
  });
  it("can review older snapshots without option detail arrays", () => {
    expect(reviewThaliSelections(meal, { removed: ["old"] }, {}, { choiceSummary: [{ groupId: "removed", groupName: "Old choices" }] }).issues).toEqual(["Old choices: old is no longer available."]);
  });
  it("does not mark missing, duplicated or unavailable required selections complete", () => {
    const required = { ...meal, choiceGroups: [{ ...meal.choiceGroups[0], minSelections: 1, maxSelections: 1 }] };
    for (const ids of [[], ["roti"], ["gone"], ["rice", "rice"]]) expect(requiredChoiceProgress(required, { base: ids })).toEqual({ completed: 0, total: 1 });
    expect(requiredChoiceProgress(required, { base: ["rice"] })).toEqual({ completed: 1, total: 1 });
    expect(requiredChoiceProgress({ ...meal, choiceGroups: [] }, {})).toEqual({ completed: 0, total: 0 });
  });
});
