export const illustratedCategories = [
  { value: "Veg", label: "Veg Thali", image: "veg-thali.webp" },
  { value: "Egg", label: "Egg Thali", image: "egg-thali.webp" },
  { value: "Chicken", label: "Chicken Thali", image: "chicken-thali.webp" },
  { value: "Fish", label: "Fish Thali", image: "fish-thali.webp" },
  { value: "Add-ons", label: "Add-ons", image: "add-ons.webp" },
  { value: "Meal Plans", label: "Meal Plans", image: "meal-plans.webp", href: "/plans" },
];

export function additionalMenuCategories(meals) {
  return [...new Set(["Special", ...meals.map((meal) => meal.category)])]
    .filter((category) => category && !illustratedCategories.some((item) => item.value === category));
}

export function matchesMenuCategory(meal, category) {
  if (category === "All") return true;
  if (category === "Add-ons") return meal.kind !== "dish" && meal.addOns?.some((addOn) => addOn.active !== false);
  if (["Veg", "Egg", "Chicken", "Fish"].includes(category)) return meal.kind !== "dish" && meal.category === category;
  return meal.category === category;
}
