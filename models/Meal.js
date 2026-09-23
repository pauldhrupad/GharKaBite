import mongoose from "mongoose";

export const CATEGORIES = ["Veg", "Egg", "Chicken", "Fish", "Special"];
export const MEAL_TYPES = ["Rice Meal", "Roti Meal", "Comfort Meal", "Light Meal"];
export const MENU_TYPES = [...MEAL_TYPES, "Single Dish"];
export const BADGES = ["Popular", "Low Oil", "Limited", "Today's Special"];

const mealSchema = new mongoose.Schema({
  kind: { type: String, enum: ["thali", "dish"], default: "thali" },
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  name: { type: String, required: true, trim: true, maxlength: 90 },
  shortDescription: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 1500 },
  price: { type: Number, required: true, min: 1, max: 10000 },
  category: { type: String, required: true, enum: CATEGORIES },
  mealType: { type: String, required: true, enum: MENU_TYPES },
  contents: { type: [String], required: true, validate: (value) => value.length > 0 && value.length <= 20 },
  customizationVersion: { type: Number, default: 1 },
  fixedItems: { type: [{ name: { type: String, required: true }, description: { type: String, default: "" } }], default: [], _id: false },
  choiceGroups: { type: [{
    id: { type: String, required: true }, name: { type: String, required: true }, description: { type: String, default: "" },
    required: { type: Boolean, default: false }, minSelections: { type: Number, min: 0, default: 0 }, maxSelections: { type: Number, min: 1, default: 1 },
    displayType: { type: String, enum: ["single_choice", "multiple_choice"], default: "single_choice" },
    options: { type: [{ id: { type: String, required: true }, name: { type: String, required: true }, description: { type: String, default: "" }, priceAdjustment: { type: Number, min: 0, default: 0 }, active: { type: Boolean, default: true }, stock: { type: Number, min: 0, default: null } }], default: [], _id: false },
  }], default: [], _id: false },
  addOns: { type: [{ id: { type: String, required: true }, name: { type: String, required: true }, description: { type: String, default: "" }, price: { type: Number, min: 0, required: true }, active: { type: Boolean, default: true }, maxQuantity: { type: Number, min: 1, max: 20, default: 1 }, stock: { type: Number, min: 0, default: null } }], default: [], _id: false },
  slots: { type: [String], enum: ["Lunch", "Dinner"], validate: (value) => value.length > 0 },
  availableDays: { type: [Number], validate: (value) => value.length > 0 && value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) },
  stockLimit: { type: Number, required: true, min: 0, max: 10000 },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  badges: { type: [String], enum: BADGES, default: [] },
  image: { type: String, required: true },
  imagePublicId: { type: String, default: "" },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.Meal || mongoose.model("Meal", mealSchema);
