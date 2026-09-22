import mongoose from "mongoose";

const usageSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  mealName: { type: String, required: true },
  usedAt: { type: Date, default: Date.now },
  reversedAt: { type: Date, default: null },
}, { _id: false });

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
  planName: { type: String, required: true },
  planPrice: { type: Number, required: true },
  allowedMealTypes: { type: [String], required: true },
  mode: { type: String, enum: ["Lunch", "Dinner", "Mixed"], required: true },
  totalMeals: { type: Number, required: true, min: 1 },
  remainingMeals: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  pausedAt: { type: Date, default: null },
  status: { type: String, enum: ["pending", "active", "paused", "expired", "cancelled"], default: "active" },
  purchaseKey: { type: String, required: true, unique: true },
  purchaseHash: { type: String, required: true },
  usageHistory: { type: [usageSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.Subscription || mongoose.model("Subscription", schema);
