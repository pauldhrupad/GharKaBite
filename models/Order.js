import mongoose from "mongoose";
import { locationSchema } from "./Location";

const orderItemSchema = new mongoose.Schema({
  mealId: { type: String, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 10 },
  category: { type: String, required: true },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  house: { type: String, required: true, trim: true },
  street: { type: String, required: true, trim: true },
  area: { type: String, required: true, trim: true },
  landmark: { type: String, trim: true, default: "" },
  city: { type: String, required: true, trim: true },
  pinCode: { type: String, required: true, trim: true },
  location: { type: locationSchema, default: undefined },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
  },
  items: { type: [orderItemSchema], required: true },
  deliveryAddress: { type: addressSchema, required: true },
  mealPeriod: { type: String, enum: ["Lunch", "Dinner"], required: true },
  deliverySlot: { type: String, required: true },
  serviceDate: { type: String, index: true },
  checkoutKey: { type: String },
  checkoutHash: { type: String },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
  coveredMealId: { type: String, default: "" },
  reservationsReturned: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ["COD", "DEMO"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  paymentReceivedAt: { type: Date, default: null },
  orderStatus: { type: String, enum: ["received", "confirmed", "cooking", "packed", "out_for_delivery", "delivered", "cancelled"], default: "received" },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 300, default: "" },
  statusHistory: { type: [statusHistorySchema], default: () => [{ status: "received", timestamp: new Date() }] },
}, { timestamps: true });
orderSchema.index({ user: 1, checkoutKey: 1 }, { unique: true, partialFilterExpression: { checkoutKey: { $exists: true } } });

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
