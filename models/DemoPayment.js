import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  key: { type: String, required: true },
  kind: { type: String, enum: ["order", "subscription"], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  payloadHash: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "paid", "failed"], default: "pending" },
  processingAt: { type: Date, default: null },
  resultId: { type: mongoose.Schema.Types.ObjectId, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ user: 1, key: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.models.DemoPayment || mongoose.model("DemoPayment", schema);
