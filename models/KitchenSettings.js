import mongoose from "mongoose";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";

const kitchenSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "primary" },
  dailyMaximum: { type: Number, min: 1, default: defaultKitchenSettings.dailyMaximum },
  lunchMaximum: { type: Number, min: 1, default: defaultKitchenSettings.lunchMaximum },
  dinnerMaximum: { type: Number, min: 1, default: defaultKitchenSettings.dinnerMaximum },
  lunchCutoff: { type: String, default: defaultKitchenSettings.lunchCutoff },
  dinnerCutoff: { type: String, default: defaultKitchenSettings.dinnerCutoff },
  upiDisplayName: { type: String, trim: true, default: "" },
  upiId: { type: String, trim: true, lowercase: true, default: "" },
  upiPhoneNumber: { type: String, trim: true, default: "" },
  upiQrImage: { type: String, default: "" },
  businessWhatsApp: { type: String, trim: true, default: "" },
  onlinePaymentEnabled: { type: Boolean, default: false },
  codEnabled: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.KitchenSettings || mongoose.model("KitchenSettings", kitchenSettingsSchema);
