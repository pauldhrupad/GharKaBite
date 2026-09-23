import mongoose from "mongoose";

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9-]{4,20}$/ },
  type: { type: String, required: true, enum: ["percent", "fixed"] },
  value: { type: Number, required: true, min: 1 },
  maxDiscount: { type: Number, required: true, min: 1 },
  minSubtotal: { type: Number, required: true, min: 0, default: 0 },
  active: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.PromoCode || mongoose.model("PromoCode", promoCodeSchema);
