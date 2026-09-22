import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: "Home" },
  house: { type: String, trim: true, required: true },
  street: { type: String, trim: true, required: true },
  area: { type: String, trim: true, required: true },
  landmark: { type: String, trim: true, default: "" },
  city: { type: String, trim: true, default: "Kolkata" },
  pinCode: { type: String, trim: true, required: true },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  addresses: { type: [addressSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
