import mongoose from "mongoose";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";

const kitchenSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "primary" },
  dailyMaximum: { type: Number, min: 1, default: defaultKitchenSettings.dailyMaximum },
  lunchMaximum: { type: Number, min: 1, default: defaultKitchenSettings.lunchMaximum },
  dinnerMaximum: { type: Number, min: 1, default: defaultKitchenSettings.dinnerMaximum },
  lunchCutoff: { type: String, default: defaultKitchenSettings.lunchCutoff },
  dinnerCutoff: { type: String, default: defaultKitchenSettings.dinnerCutoff },
}, { timestamps: true });

export default mongoose.models.KitchenSettings || mongoose.model("KitchenSettings", kitchenSettingsSchema);
