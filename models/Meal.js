import mongoose from "mongoose";

export const CATEGORIES = ["Veg", "Egg", "Chicken", "Fish"];
export const MEAL_TYPES = ["Rice Meal", "Roti Meal", "Comfort Meal", "Light Meal"];
export const BADGES = ["Popular", "Low Oil", "Limited", "Today's Special"];

const mealSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  name: { type: String, required: true, trim: true, maxlength: 90 },
  shortDescription: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 1500 },
  price: { type: Number, required: true, min: 1, max: 10000 },
  category: { type: String, required: true, enum: CATEGORIES },
  mealType: { type: String, required: true, enum: MEAL_TYPES },
  contents: { type: [String], required: true, validate: (value) => value.length > 0 && value.length <= 20 },
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
