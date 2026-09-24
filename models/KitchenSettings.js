import mongoose from "mongoose";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";

const kitchenSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "primary" },
  // Legacy capacity fields remain readable on historical documents but never limit orders.
  dailyMaximum: { type: Number, min: 1 },
  lunchMaximum: { type: Number, min: 1 },
  dinnerMaximum: { type: Number, min: 1 },
  acceptingOrders: { type: Boolean, default: true },
  lunchEnabled: { type: Boolean, default: true },
  dinnerEnabled: { type: Boolean, default: true },
  lunchCutoff: { type: String, default: defaultKitchenSettings.lunchCutoff },
  dinnerCutoff: { type: String, default: defaultKitchenSettings.dinnerCutoff },
  freeDeliveryThreshold: { type: Number, min: 0, max: 100000, default: defaultKitchenSettings.freeDeliveryThreshold },
  upiDisplayName: { type: String, trim: true, default: "" },
  upiId: { type: String, trim: true, lowercase: true, default: "" },
  upiPhoneNumber: { type: String, trim: true, default: "" },
  upiQrImage: { type: String, default: "" },
  businessWhatsApp: { type: String, trim: true, default: "" },
  onlinePaymentEnabled: { type: Boolean, default: false },
  codEnabled: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.KitchenSettings || mongoose.model("KitchenSettings", kitchenSettingsSchema);
