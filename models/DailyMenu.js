import mongoose from "mongoose";

const dailyMenuSchema = new mongoose.Schema({
  meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meal", required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  availableOverride: { type: Boolean, default: null },
  soldOut: { type: Boolean, default: false },
  remaining: { type: Number, min: 0 }, // Deprecated historical value.
  stockLimitSnapshot: { type: Number, min: 0 }, // Deprecated historical value.
}, { timestamps: true });
dailyMenuSchema.index({ meal: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyMenu || mongoose.model("DailyMenu", dailyMenuSchema);
