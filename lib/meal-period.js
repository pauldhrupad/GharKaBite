import { getPeriodAvailability } from "./kitchen-operations";

export function validMealPeriod(value, slots = ["Lunch", "Dinner"]) {
  return ["Lunch", "Dinner"].includes(value) && slots.includes(value) ? value : undefined;
}

export function initialHomePeriod(saved, settings, meals, now, date) {
  if (validMealPeriod(saved)) return saved;
  const open = ["Lunch", "Dinner"].filter((period) => getPeriodAvailability(period, settings, [], now, date).available);
  return open.find((period) => meals.some((meal) => meal.available && meal.slots.includes(period))) || open[0] || "Lunch";
}

export function mealDetailHref(id, date, period) {
  const query = new URLSearchParams({ date });
  if (validMealPeriod(period)) query.set("period", period);
  return `/menu/${encodeURIComponent(id)}?${query}`;
}

export function checkedDeliveryLabel(result, query) {
  if (result?.serviceable !== true) return "";
  return [result.address?.area, result.address?.city].filter(Boolean).join(", ") || query.trim();
}
