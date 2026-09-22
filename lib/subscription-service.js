import crypto from "node:crypto";
import mongoose from "mongoose";
import { seedCatalog } from "./catalog";
import Subscription from "@/models/Subscription";
import SubscriptionPlan from "@/models/SubscriptionPlan";
import { CheckoutError } from "./order-service";

export function effectiveSubscriptionStatus(subscription, now = new Date()) {
  if (subscription.status === "active" && (subscription.remainingMeals <= 0 || new Date(subscription.expiryDate) <= now)) return "expired";
  return subscription.status;
}

export async function purchaseSubscription(userId, { planId, mode, purchaseKey }) {
  await seedCatalog();
  if (!mongoose.isValidObjectId(planId) || !["Lunch", "Dinner", "Mixed"].includes(mode) || !/^[0-9a-f-]{36}$/i.test(purchaseKey || "")) throw new CheckoutError("Choose a valid plan and schedule.");
  const purchaseHash = crypto.createHash("sha256").update(`${planId}:${mode}`).digest("hex");
  const existing = await Subscription.findOne({ purchaseKey, user: userId }).lean();
  if (existing) {
    if (existing.purchaseHash !== purchaseHash) throw new CheckoutError("This purchase key was used for another plan.", 409);
    return existing;
  }
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const plan = await SubscriptionPlan.findOne({ _id: planId, active: true }).session(session);
      if (!plan || (mode === "Lunch" && !plan.lunchAllowed) || (mode === "Dinner" && !plan.dinnerAllowed) || (mode === "Mixed" && !plan.mixedAllowed)) throw new CheckoutError("This plan is unavailable.", 409);
      const now = new Date();
      [created] = await Subscription.create([{ user: userId, plan: plan._id, planName: plan.name, planPrice: plan.price,
        allowedMealTypes: plan.allowedMealTypes, mode, totalMeals: plan.mealCount, remainingMeals: plan.mealCount,
        startDate: now, expiryDate: new Date(now.getTime() + plan.validityDays * 86400000),
        status: "active", purchaseKey, purchaseHash }], { session });
    });
    return created.toObject();
  } catch (error) {
    if (error.code === 11000) {
      const result = await Subscription.findOne({ purchaseKey, user: userId }).lean();
      if (result) {
        if (result.purchaseHash !== purchaseHash) throw new CheckoutError("This purchase key was used for another plan.", 409);
        return result;
      }
    }
    throw error;
  } finally { await session.endSession(); }
}

export async function setSubscriptionStatus(id, status) {
  if (!["active", "paused", "cancelled"].includes(status)) throw new CheckoutError("Invalid subscription status.");
  const subscription = await Subscription.findById(id);
  if (!subscription) throw new CheckoutError("Subscription not found.", 404);
  if (["expired", "cancelled"].includes(effectiveSubscriptionStatus(subscription))) throw new CheckoutError("This subscription can no longer be changed.", 409);
  if (status === subscription.status) return subscription.toObject();
  if (status === "paused" && subscription.status === "active") subscription.pausedAt = new Date();
  if (status === "active" && subscription.status === "paused") {
    subscription.expiryDate = new Date(subscription.expiryDate.getTime() + (Date.now() - subscription.pausedAt.getTime()));
    subscription.pausedAt = null;
  }
  subscription.status = status;
  await subscription.save();
  return subscription.toObject();
}
