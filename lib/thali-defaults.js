const baseChoice = {
  id: "base", name: "Choose Your Base", description: "Choose rice or roti for your Thali.",
  required: true, minSelections: 1, maxSelections: 1, displayType: "single_choice",
  options: [
    { id: "rice", name: "Rice", priceAdjustment: 0, active: true, preparationQuantity: 1, preparationUnit: "portion" },
    { id: "roti", name: "Roti", priceAdjustment: 0, active: true, preparationQuantity: 4, preparationUnit: "pieces" },
  ],
};
const add = (id, name, price, maxQuantity = 3) => ({ id, name, description: "", price, active: true, maxQuantity, preparationQuantity: 1, preparationUnit: id.includes("rice") || id.includes("dal") || id.includes("sabzi") || id === "salad" ? "portion" : "piece" });
const common = [add("extra-rice", "Extra Rice", 20), add("papad", "Papad", 10), add("salad", "Extra Salad", 15)];

export const initialThaliConfiguration = {
  "chicken-home-meal": {
    name: "Chicken Thali", shortDescription: "Home-style chicken curry with your choice of rice or roti.", description: "A complete Bengali-style Thali with chicken curry, dal, seasonal vegetables and salad. Choose rice or roti, then add any extras you like.", fixedItems: ["Chicken Curry", "Dal", "Seasonal Sabzi", "Salad"].map((name) => ({ name, description: "" })),
    choiceGroups: [baseChoice], addOns: [add("extra-chicken", "Extra Chicken Piece", 50), add("extra-rice", "Extra Rice", 20), add("extra-roti", "Extra Roti", 10, 5), add("egg", "Boiled Egg", 20), ...common.slice(1)],
  },
  "fish-curry-meal": {
    name: "Fish Thali", shortDescription: "Bengali fish curry with rice, dal and seasonal sides.", description: "A homestyle fish curry Thali served with rice, dal, seasonal vegetables and salad. Rice is included; select optional extras to make it yours.", fixedItems: ["Rice", "Fish Curry", "Dal", "Seasonal Sabzi", "Salad"].map((name) => ({ name, description: "" })),
    choiceGroups: [], addOns: [add("extra-fish", "Extra Fish Piece", 60), ...common, add("egg", "Boiled Egg", 20)],
  },
  "egg-curry-meal": {
    name: "Egg Thali", shortDescription: "Comforting egg curry with your choice of rice or roti.", description: "A satisfying everyday Thali with egg curry, dal, seasonal vegetables and salad. Choose rice or roti, and add extras if you wish.", fixedItems: ["Egg Curry", "Dal", "Seasonal Sabzi", "Salad"].map((name) => ({ name, description: "" })),
    choiceGroups: [baseChoice], addOns: [add("extra-egg", "Extra Egg", 20), add("extra-rice", "Extra Rice", 20), add("extra-roti", "Extra Roti", 10, 5), ...common.slice(1)],
  },
  "veg-home-meal": {
    name: "Veg Thali", shortDescription: "Balanced vegetarian Thali with your choice of rice or roti.", description: "A light, familiar Thali with dal, seasonal vegetables, salad and crisp aloo bhaja. Choose rice or roti, then customize with optional extras.", fixedItems: ["Dal", "Seasonal Sabzi", "Salad", "Aloo Bhaja"].map((name) => ({ name, description: "" })),
    choiceGroups: [baseChoice], addOns: [add("paneer", "Paneer Item", 40), add("extra-dal", "Extra Dal", 20), add("extra-sabzi", "Extra Sabzi", 25), add("extra-rice", "Extra Rice", 20), add("extra-roti", "Extra Roti", 10, 5), ...common.slice(1)],
  },
};

export const initialThaliSlugs = Object.keys(initialThaliConfiguration);
export const legacyMealSlugs = ["veg-roti-meal", "chicken-roti-meal", "khichuri-meal", "light-dinner-meal"];
