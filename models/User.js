import mongoose from "mongoose";
import { locationSchema } from "./Location";

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: "Home" },
  house: { type: String, trim: true, required: true },
  street: { type: String, trim: true, required: true },
  area: { type: String, trim: true, required: true },
  landmark: { type: String, trim: true, default: "" },
  city: { type: String, trim: true, default: "Kolkata" },
  pinCode: { type: String, trim: true, required: true },
  location: { type: locationSchema, default: undefined },
}, { _id: true });

const favoriteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  mealId: { type: String, required: true },
  mealName: { type: String, required: true },
  signature: { type: String, required: true },
  preferredPeriod: { type: String, enum: ["Lunch", "Dinner"], required: true },
  quantity: { type: Number, min: 1, max: 10, required: true },
  price: { type: Number, min: 1, required: true },
  selectedChoices: { type: mongoose.Schema.Types.Mixed, default: {} },
  selectedAddOns: { type: mongoose.Schema.Types.Mixed, default: {} },
  choiceSummary: { type: [mongoose.Schema.Types.Mixed], default: [] },
  addOnSummary: { type: [mongoose.Schema.Types.Mixed], default: [] },
  fixedItems: { type: [mongoose.Schema.Types.Mixed], default: undefined },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  avatarUrl: { type: String, default: "" },
  addresses: { type: [addressSchema], default: [] },
  favorites: { type: [favoriteSchema], default: undefined, select: false },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
