import { allowedOrderDate, deliverySlots, slotExpired } from "./dates";
import { getPeriodAvailability } from "./kitchen-operations";
import { calculateThaliPrice, customizationSignature } from "./thali";
import { reviewThaliSelections } from "./thali-builder";

export const MAX_CART_LINES = 20;
export const MAX_MEAL_QUANTITY = 10;

export function cartItemKey(mealId, period, choices = {}, addOns = {}) {
  return `${mealId}::${period}::${customizationSignature(choices, addOns)}`;
}

export function orderSelections(order) {
  return order.items.map((item, index) => ({
    id: String(index),
    mealId: item.mealId,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    fixedItems: item.fixedItems?.length ? item.fixedItems : undefined,
    selectedChoices: Object.fromEntries((item.selectedChoices || []).filter((group) => group.options?.length).map((group) => [group.groupId, group.options.map((option) => option.id)])),
    selectedAddOns: Object.fromEntries((item.selectedAddOns || []).map((extra) => [extra.id, extra.quantity])),
    choiceSummary: item.selectedChoices || [],
    addOnSummary: item.selectedAddOns || [],
  }));
}

export function repeatAvailability(date, period, settings, now = new Date()) {
  if (!allowedOrderDate(date, now)) return "Choose a current delivery date.";
  if (!deliverySlots[period]) return "Choose Lunch or Dinner.";
  if (!settings) return "Kitchen availability could not be checked.";
  const availability = getPeriodAvailability(period, settings, [], now, date);
  if (!availability.available) return availability.reason;
  return deliverySlots[period].every((slot) => slotExpired(date, period, slot, now)) ? "All delivery slots have started for this meal period." : "";
}

const portionLabel = ({ name, preparationQuantity, preparationUnit }) => Number.isFinite(preparationQuantity) ? `${name} (${preparationQuantity} ${preparationUnit || "portion"})` : name;
const portionChanged = (saved, current) => saved?.name && (saved.name !== current.name || (Number.isFinite(saved.preparationQuantity) && (saved.preparationQuantity !== current.preparationQuantity || saved.preparationUnit !== current.preparationUnit)));

export function reviewRepeatLine(line, menu, period) {
  const meal = menu.find((entry) => entry.id === line.mealId && (!line.isFavorite || entry.kind !== "dish"));
  if (!meal) return { line, meal, issues: ["This meal is no longer on the menu."], price: null, changes: [] };
  const issues = [];
  if (!meal.slots.includes(period)) issues.push(`This meal isn’t available for ${period}.`);
  if (!meal.available) issues.push(meal.choiceUnavailable ? "A required choice is unavailable." : "This meal isn’t available on the selected date.");
  issues.push(...reviewThaliSelections(meal, line.selectedChoices, line.selectedAddOns, line).issues);
  let price = null;
  try { price = calculateThaliPrice(meal, line.selectedChoices, line.selectedAddOns, line.quantity); }
  catch (error) { if (!issues.includes(error.message)) issues.push(error.message); }
  const changes = [];
  if (line.name && line.name !== meal.name) changes.push(`Meal name changed from ${line.name} to ${meal.name}.`);
  if (price && Array.isArray(line.fixedItems)) {
    const labels = (items) => items.map(({ name, preparationQuantity, preparationUnit }) => [name, preparationQuantity ?? null, preparationUnit ?? ""].join("|")).sort();
    if (JSON.stringify(labels(line.fixedItems)) !== JSON.stringify(labels(price.fixedItems))) {
      const describe = (items) => items.map(portionLabel).join(", ");
      changes.push(`Included items or portions changed. Previously: ${describe(line.fixedItems)}. Now: ${describe(price.fixedItems)}.`);
    }
  }
  if (price) {
    for (const group of price.selectedChoices) for (const option of group.options) {
      const saved = line.choiceSummary?.find((entry) => entry.groupId === group.groupId)?.options?.find((entry) => entry.id === option.id);
      if (portionChanged(saved, option)) changes.push(`${group.groupName} changed: ${portionLabel(saved)} → ${portionLabel(option)}.`);
    }
    for (const extra of price.selectedAddOns) {
      const saved = line.addOnSummary?.find((entry) => entry.id === extra.id);
      if (portionChanged(saved, extra)) changes.push(`Extra changed: ${portionLabel(saved)} → ${portionLabel(extra)}.`);
    }
  }
  return { line, meal, issues, price, changes };
}

export function repeatPriceKey(reviews) {
  return JSON.stringify(reviews.map(({ line, meal, price }) => [
    line.id, line.quantity, line.selectedChoices, line.selectedAddOns, price?.basePrice, price?.choiceAdjustments, price?.addOnTotal,
    meal?.name, price?.fixedItems,
    price?.selectedChoices.map((g) => g.options.map((o) => [o.id, o.name, o.priceAdjustment, o.preparationQuantity, o.preparationUnit])),
    price?.selectedAddOns.map((o) => [o.id, o.name, o.price, o.quantity, o.preparationQuantity, o.preparationUnit]),
  ]));
}

export function repeatCartConflict(items, date, period) {
  return items.some((item) => item.serviceDate !== date || item.deliveryMealPeriod !== period);
}

export function mergeRepeatCart(existing, additions, { date, period, menu, replace = false }) {
  if (!additions.length) throw new Error("Choose at least one meal to add.");
  const conflict = repeatCartConflict(existing, date, period);
  if (conflict && !replace) throw new Error("Your cart uses another date or meal period. Review it before replacing.");
  const merged = new Map();
  for (const item of [...(conflict && replace ? [] : existing), ...additions]) {
    if (item.serviceDate !== date || item.deliveryMealPeriod !== period || item.needsReview) throw new Error("Review the existing meals in your cart first.");
    const meal = menu.find((entry) => entry.id === item.mealId);
    if (!meal?.available || !meal.slots.includes(period)) throw new Error(`${item.name} is unavailable. Review your meals before adding.`);
    const priced = calculateThaliPrice(meal, item.selectedChoices, item.selectedAddOns, item.quantity);
    if (item.key !== cartItemKey(item.mealId, period, item.selectedChoices, item.selectedAddOns)) throw new Error("Review the existing meals in your cart first.");
    if (priced.unitTotal !== item.price) throw new Error(`The price of ${item.name} in your cart changed. Review the existing cart first.`);
    const earlier = merged.get(item.key);
    const quantity = (earlier?.quantity || 0) + item.quantity;
    if (quantity > MAX_MEAL_QUANTITY) throw new Error(`${item.name} would exceed ${MAX_MEAL_QUANTITY} for this configuration. Adjust the quantity first.`);
    merged.set(item.key, earlier ? { ...earlier, quantity } : item);
  }
  if (merged.size > MAX_CART_LINES) throw new Error(`Your cart can contain up to ${MAX_CART_LINES} different meal selections.`);
  return [...merged.values()];
}
