import mongoose from "mongoose";

const schema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  daily: { type: Number, default: 0, min: 0 },
  lunch: { type: Number, default: 0, min: 0 },
  dinner: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.models.DailyCapacity || mongoose.model("DailyCapacity", schema);
