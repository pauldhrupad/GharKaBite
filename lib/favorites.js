import mongoose from "mongoose";
import crypto from "node:crypto";
import { customizationSignature } from "./thali";

export const MAX_FAVORITES = 20;
export const favoriteName = (value) => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 60 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : "";
export const favoriteId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value) ? new mongoose.Types.ObjectId(value) : null;

export function favoriteRecord(selection, name, meal, price) {
  const { mealId, preferredPeriod, quantity, selectedChoices, selectedAddOns } = selection;
  const signature = crypto.createHash("sha256").update(JSON.stringify([mealId, preferredPeriod, quantity, customizationSignature(selectedChoices, selectedAddOns)])).digest("hex");
  return {
    _id: new mongoose.Types.ObjectId(), ...selection, name, mealName: meal.name, signature,
    price: price.unitTotal,
    fixedItems: price.fixedItems.map(({ name, preparationQuantity, preparationUnit }) => ({ name, preparationQuantity, preparationUnit })),
    choiceSummary: price.selectedChoices.filter(({ options }) => options.length).map(({ groupId, groupName, options }) => ({ groupId, groupName, options: options.map(({ id, name, preparationQuantity, preparationUnit }) => ({ id, name, preparationQuantity, preparationUnit })) })),
    addOnSummary: price.selectedAddOns.map(({ id, name, quantity, preparationQuantity, preparationUnit }) => ({ id, name, quantity, preparationQuantity, preparationUnit })),
  };
}

export function favoriteResponse({ _id, name, mealId, mealName, preferredPeriod, quantity, selectedChoices, selectedAddOns, choiceSummary, addOnSummary, fixedItems, price }) {
  return { id: String(_id), name, mealId, mealName, preferredPeriod, quantity, selectedChoices, selectedAddOns, choiceSummary, addOnSummary, fixedItems, price };
}
