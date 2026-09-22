import mongoose from "mongoose";
import { MEAL_TYPES } from "./Meal";

const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  mealCount: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 1 },
  allowedMealTypes: { type: [String], enum: MEAL_TYPES, required: true },
  lunchAllowed: { type: Boolean, default: true },
  dinnerAllowed: { type: Boolean, default: true },
  mixedAllowed: { type: Boolean, default: true },
  validityDays: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.SubscriptionPlan || mongoose.model("SubscriptionPlan", schema);
