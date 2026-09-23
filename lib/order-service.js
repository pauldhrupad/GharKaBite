import crypto from "node:crypto";
import mongoose from "mongoose";
import { calculateDeliveryFee } from "./cart-pricing";
import { ensureWelcomePromo, normalizePromoCode, quotePromo } from "./promotions";
import { seedCatalog } from "./catalog";
import { allowedOrderDate, deliverySlotStart, periodCutoffPassed, weekdayForDate } from "./dates";
import { checkDelivery, validLocation } from "./delivery";
import Meal from "@/models/Meal";
import DailyMenu from "@/models/DailyMenu";
import DailyCapacity from "@/models/DailyCapacity";
import KitchenSettings from "@/models/KitchenSettings";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";
import { defaultKitchenSettings } from "./kitchen-operations";
import { calculateThaliPrice, customizationSignature } from "./thali";

export class CheckoutError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function normalizePayload(body) {
  const date = String(body.serviceDate || "");
  const period = body.mealPeriod;
  const items = Array.isArray(body.items) ? body.items : [];
  if (!allowedOrderDate(date) || !["Lunch", "Dinner"].includes(period) || !items.length || items.length > 20) throw new CheckoutError("Choose a valid delivery date, period and meals.");
  const cleanItems = items.map((item) => ({ mealId: String(item.mealId || ""), quantity: Number(item.quantity), selectedChoices: item.selectedChoices ?? {}, selectedAddOns: item.selectedAddOns ?? {} }));
  if (cleanItems.some((item) => !item.selectedChoices || typeof item.selectedChoices !== "object" || Array.isArray(item.selectedChoices) || !item.selectedAddOns || typeof item.selectedAddOns !== "object" || Array.isArray(item.selectedAddOns))) throw new CheckoutError("Review your menu item choices.");
  if (cleanItems.some((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.mealId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) || new Set(cleanItems.map((item) => `${item.mealId}::${customizationSignature(item.selectedChoices, item.selectedAddOns)}`)).size !== cleanItems.length) throw new CheckoutError("Your cart is not valid.");
  const contact = { name: String(body.contact?.name || "").trim(), phone: String(body.contact?.phone || "").replace(/\D/g, ""), email: String(body.contact?.email || "").trim().toLowerCase() };
  const address = Object.fromEntries(["house", "street", "area", "landmark", "city", "pinCode"].map((field) => [field, String(body.deliveryAddress?.[field] || "").trim()]));
  if (body.deliveryAddress?.location != null) {
    if (!validLocation(body.deliveryAddress.location)) throw new CheckoutError("Choose a valid delivery point or enter the address manually.");
    address.location = { lat: body.deliveryAddress.location.lat, lon: body.deliveryAddress.location.lon };
  }
  if (contact.name.length < 2 || contact.name.length > 80 || !/^[6-9]\d{9}$/.test(contact.phone) || (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) || ["house", "street", "area", "city"].some((field) => !address[field] || address[field].length > 120) || !/^\d{6}$/.test(address.pinCode)) throw new CheckoutError("Please check your contact and delivery details.");
  const slots = period === "Lunch" ? ["12–1 PM", "1–2 PM"] : ["7–8 PM", "8–9 PM", "9–9:30 PM"];
  if (!slots.includes(body.deliverySlot)) throw new CheckoutError("Choose a valid delivery slot.");
  const checkoutKey = String(body.checkoutKey || "");
  const paymentChannel = body.paymentChannel || null;
  if (paymentChannel && !["qr", "upi_id", "phone"].includes(paymentChannel)) throw new CheckoutError("Choose a valid online payment option.");
  if (!/^[0-9a-f-]{36}$/i.test(checkoutKey)) throw new CheckoutError("Checkout request is invalid.");
  return { date, period, items: cleanItems, contact, address, deliverySlot: body.deliverySlot,
    subscriptionId: body.subscriptionId ? String(body.subscriptionId) : "",
    coveredMealId: body.coveredMealId ? String(body.coveredMealId) : "",
    promoCode: normalizePromoCode(body.promoCode).slice(0, 30), notes: String(body.notes || "").trim().slice(0, 300), checkoutKey, paymentChannel };
}

async function reserveStock(meal, date, quantity, session) {
  let daily = await DailyMenu.findOneAndUpdate({ meal: meal._id, date }, { $setOnInsert: { meal: meal._id, date, availableOverride: null, soldOut: false, remaining: meal.stockLimit, stockLimitSnapshot: meal.stockLimit } }, { upsert: true, returnDocument: "after", session });
  const scheduled = meal.availableDays.includes(weekdayForDate(date));
  if (!(daily.availableOverride ?? scheduled) || daily.soldOut) throw new CheckoutError(`${meal.name} is unavailable for this date.`, 409);
  daily = await DailyMenu.findOneAndUpdate({ _id: daily._id, remaining: { $gte: quantity }, soldOut: false }, { $inc: { remaining: -quantity } }, { returnDocument: "after", session });
  if (!daily) throw new CheckoutError(`${meal.name} is sold out.`, 409);
}

async function reserveCapacity(date, period, settings, session) {
  const field = period.toLowerCase();
  const max = Number(period === "Lunch" ? settings.lunchMaximum : settings.dinnerMaximum);
  const doc = await DailyCapacity.findOneAndUpdate({ date }, { $setOnInsert: { date, daily: 0, lunch: 0, dinner: 0 } }, { upsert: true, returnDocument: "after", session });
  const updated = await DailyCapacity.findOneAndUpdate({ _id: doc._id, daily: { $lt: Number(settings.dailyMaximum) }, [field]: { $lt: max } }, { $inc: { daily: 1, [field]: 1 } }, { returnDocument: "after", session });
  if (!updated) throw new CheckoutError("Kitchen capacity is full for this period.", 409);
}

export async function createOrder(userId, body, paymentMethod, { verifyDelivery = checkDelivery } = {}) {
  const payload = normalizePayload(body);
  const checkoutHash = crypto.createHash("sha256").update(JSON.stringify({ payload, paymentMethod })).digest("hex");
  if (!["COD", "DEMO", "manual_online"].includes(paymentMethod)) throw new CheckoutError("Payment method is invalid.");
  await seedCatalog();
  const existing = await Order.findOne({ user: userId, checkoutKey: payload.checkoutKey }).lean();
  if (existing) {
    if (existing.checkoutHash !== checkoutHash) throw new CheckoutError("This checkout key was used for a different order.", 409);
    return existing;
  }
  const delivery = await verifyDelivery(payload.address);
  if (!delivery.serviceable) throw new CheckoutError(delivery.reason, delivery.unavailable ? 503 : 422);
  if (payload.promoCode) await ensureWelcomePromo();
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const duplicate = await Order.findOne({ user: userId, checkoutKey: payload.checkoutKey }).session(session);
      if (duplicate) {
        if (duplicate.checkoutHash !== checkoutHash) throw new CheckoutError("This checkout key was used for a different order.", 409);
        created = duplicate; return;
      }
      const settings = await KitchenSettings.findOne({ key: "primary" }).session(session).lean() || defaultKitchenSettings;
      if (paymentMethod === "COD" && settings.codEnabled === false) throw new CheckoutError("Cash on Delivery is unavailable.", 409);
      if (paymentMethod === "manual_online" && !(settings.onlinePaymentEnabled && (settings.upiQrImage || settings.upiId || settings.upiPhoneNumber))) throw new CheckoutError("Online payment is temporarily unavailable.", 409);
      if (paymentMethod === "manual_online" && (!payload.paymentChannel || !(payload.paymentChannel === "qr" && settings.upiQrImage || payload.paymentChannel === "upi_id" && settings.upiId || payload.paymentChannel === "phone" && settings.upiPhoneNumber))) throw new CheckoutError("Choose a configured online payment option.", 409);
      if (periodCutoffPassed(payload.date, payload.period, settings)) throw new CheckoutError(`${payload.period} ordering has closed for today.`, 409);
      const uniqueSlugs = [...new Set(payload.items.map((item) => item.mealId))];
      const meals = await Meal.find({ slug: { $in: uniqueSlugs }, active: true, archivedAt: null }).session(session);
      if (meals.length !== uniqueSlugs.length) throw new CheckoutError("A menu item is no longer available.", 409);
      const bySlug = new Map(meals.map((meal) => [meal.slug, meal]));
      const pricedItems = [];
      const optionUsage = new Map();
      const addOnUsage = new Map();
      for (const item of payload.items) {
        const meal = bySlug.get(item.mealId);
        if (!meal.slots.includes(payload.period)) throw new CheckoutError(`${meal.name} is unavailable for ${payload.period}.`, 409);
        let priced;
        try { priced = calculateThaliPrice(meal, item.selectedChoices, item.selectedAddOns, item.quantity); }
        catch (error) { throw new CheckoutError(error.message, 409); }
        await reserveStock(meal, payload.date, item.quantity, session);
        pricedItems.push({ mealId: meal.slug, kind: meal.kind || "thali", name: meal.name, image: meal.image, price: priced.unitTotal, basePrice: priced.basePrice, fixedItems: priced.fixedItems, selectedChoices: priced.selectedChoices, selectedAddOns: priced.selectedAddOns, quantity: item.quantity, category: meal.category });
        for (const group of priced.selectedChoices) for (const option of group.options) optionUsage.set(`${meal.slug}::${group.groupId}::${option.id}`, (optionUsage.get(`${meal.slug}::${group.groupId}::${option.id}`) || 0) + item.quantity);
        for (const addOn of priced.selectedAddOns) addOnUsage.set(`${meal.slug}::${addOn.id}`, (addOnUsage.get(`${meal.slug}::${addOn.id}`) || 0) + addOn.quantity * item.quantity);
      }
      for (const meal of meals) {
        let changed = false;
        for (const group of meal.choiceGroups) for (const option of group.options) {
          const used = optionUsage.get(`${meal.slug}::${group.id}::${option.id}`) || 0;
          if (used && option.stock != null) { if (option.stock < used) throw new CheckoutError(`${option.name} is sold out.`, 409); option.stock -= used; changed = true; }
        }
        for (const addOn of meal.addOns) {
          const used = addOnUsage.get(`${meal.slug}::${addOn.id}`) || 0;
          if (used && addOn.stock != null) { if (addOn.stock < used) throw new CheckoutError(`${addOn.name} is sold out.`, 409); addOn.stock -= used; changed = true; }
        }
        if (changed) await meal.save({ session });
      }
      await reserveCapacity(payload.date, payload.period, settings, session);
      let subscription = null;
      let covered = null;
      if (payload.subscriptionId) {
        if (!mongoose.isValidObjectId(payload.subscriptionId)) throw new CheckoutError("Subscription is invalid.");
        const earliestValidTime = new Date(Math.max(Date.now(), deliverySlotStart(payload.date, payload.period, payload.deliverySlot).getTime()));
        subscription = await Subscription.findOne({ _id: payload.subscriptionId, user: userId, status: "active", remainingMeals: { $gt: 0 }, expiryDate: { $gt: earliestValidTime } }).session(session);
        covered = bySlug.get(payload.coveredMealId);
        if (!subscription || !covered || covered.kind === "dish" || !payload.items.some((item) => item.mealId === covered.slug) || !subscription.allowedMealTypes.includes(covered.mealType) || (subscription.mode !== "Mixed" && subscription.mode !== payload.period)) throw new CheckoutError("This plan cannot cover the selected meal.", 409);
      }
      const subtotal = pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const coveredBasePrice = covered?.price || 0;
      const payableSubtotal = subtotal - coveredBasePrice;
      const promo = payload.promoCode ? await quotePromo(userId, payload.promoCode, payableSubtotal, session) : null;
      if (payload.promoCode && !promo.valid) throw new CheckoutError(promo.message);
      const discount = promo?.discount || 0;
      const deliveryFee = subscription ? 0 : calculateDeliveryFee(subtotal, settings.freeDeliveryThreshold ?? defaultKitchenSettings.freeDeliveryThreshold);
      const total = Math.max(0, payableSubtotal - discount + deliveryFee);
      const now = new Date();
      const [order] = await Order.create([{ orderNumber: `GKB-${payload.date.replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`, user: userId,
        checkoutKey: payload.checkoutKey, checkoutHash, serviceDate: payload.date, subscription: subscription?._id || null,
        coveredMealId: covered?.slug || "", customer: payload.contact, items: pricedItems,
        deliveryAddress: payload.address, mealPeriod: payload.period, deliverySlot: payload.deliverySlot,
        paymentMethod, paymentChannel: paymentMethod === "manual_online" ? payload.paymentChannel : null,
        ...(paymentMethod === "manual_online" ? { paymentDetails: { upiDisplayName: settings.upiDisplayName || "", upiId: settings.upiId || "", upiPhoneNumber: settings.upiPhoneNumber || "", upiQrImage: settings.upiQrImage || "", businessWhatsApp: settings.businessWhatsApp || "" } } : {}),
        paymentStatus: paymentMethod === "DEMO" ? "paid" : "pending", orderStatus: paymentMethod === "manual_online" ? "payment_pending" : paymentMethod === "COD" ? "confirmed" : "received",
        subtotal, deliveryFee, discount: discount + coveredBasePrice, promoCode: promo?.code || "", total,
        notes: payload.notes, statusHistory: [{ status: paymentMethod === "manual_online" ? "payment_pending" : paymentMethod === "COD" ? "confirmed" : "received", timestamp: now }] }], { session });
      if (subscription) {
        const updated = await Subscription.findOneAndUpdate({ _id: subscription._id, status: "active", remainingMeals: { $gt: 0 } }, { $inc: { remainingMeals: -1 }, $push: { usageHistory: { order: order._id, mealName: covered.name, usedAt: now } } }, { returnDocument: "after", session });
        if (!updated) throw new CheckoutError("This plan has no remaining meals.", 409);
      }
      created = order;
    });
    return created.toObject ? created.toObject() : created;
  } catch (error) {
    if (error.code === 11000) {
      const order = await Order.findOne({ user: userId, checkoutKey: payload.checkoutKey }).lean();
      if (order) {
        if (order.checkoutHash !== checkoutHash) throw new CheckoutError("This checkout key was used for a different order.", 409);
        return order;
      }
      if (payload.promoCode && await Order.exists({ user: userId, promoCode: payload.promoCode })) throw new CheckoutError("You have already used this promo code.", 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function updateOrderStatus(orderNumber, status) {
  const allowed = ["received", "confirmed", "cooking", "packed", "out_for_delivery", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw new CheckoutError("Invalid order status.");
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber }).session(session);
      if (!order) throw new CheckoutError("Order not found.", 404);
      if (order.orderStatus === status) { result = order; return; }
      if (order.orderStatus === "cancelled") throw new CheckoutError("Cancelled orders cannot be changed.", 409);
      if (order.paymentMethod === "manual_online" && order.paymentStatus !== "paid" && status !== "cancelled") throw new CheckoutError("Verify online payment before moving this order into the kitchen queue.", 409);
      if (order.paymentMethod === "manual_online" && status === "received") throw new CheckoutError("An online payment order cannot return to received.", 409);
      if (order.orderStatus === "delivered" && order.paymentStatus === "paid") throw new CheckoutError("Completed orders cannot be changed.", 409);
      if (status === "cancelled" && order.serviceDate && !order.reservationsReturned && ["payment_pending", "received", "confirmed"].includes(order.orderStatus)) {
        for (const item of order.items) {
          const meal = await Meal.findOne({ slug: item.mealId }).session(session);
          if (meal) {
            await DailyMenu.updateOne({ meal: meal._id, date: order.serviceDate }, { $inc: { remaining: item.quantity } }, { session });
            let changed = false;
            for (const group of item.selectedChoices || []) for (const selected of group.options || []) {
              const option = meal.choiceGroups.find((entry) => entry.id === group.groupId)?.options.find((entry) => entry.id === selected.id);
              if (option?.stock != null) { option.stock += item.quantity; changed = true; }
            }
            for (const selected of item.selectedAddOns || []) {
              const addOn = meal.addOns.find((entry) => entry.id === selected.id);
              if (addOn?.stock != null) { addOn.stock += selected.quantity * item.quantity; changed = true; }
            }
            if (changed) await meal.save({ session });
          }
        }
        await DailyCapacity.updateOne({ date: order.serviceDate }, { $inc: { daily: -1, [order.mealPeriod.toLowerCase()]: -1 } }, { session });
        if (order.subscription) {
          const subscription = await Subscription.findById(order.subscription).session(session);
          if (subscription) {
            const use = subscription.usageHistory.find((entry) => String(entry.order) === String(order._id) && !entry.reversedAt);
            if (use) { use.reversedAt = new Date(); subscription.remainingMeals += 1; await subscription.save({ session }); }
          }
        }
        order.reservationsReturned = true;
      }
      order.orderStatus = status;
      if (status === "cancelled" && order.paymentMethod === "DEMO" && order.paymentStatus === "paid") order.paymentStatus = "refunded";
      order.statusHistory.push({ status, timestamp: new Date() });
      await order.save({ session });
      result = order;
    });
    return result.toObject();
  } finally { await session.endSession(); }
}

export async function markCodPaymentReceived(orderNumber) {
  const order = await Order.findOneAndUpdate(
    { orderNumber, paymentMethod: "COD", orderStatus: "delivered", paymentStatus: "pending" },
    { $set: { paymentStatus: "paid", paymentReceivedAt: new Date() } },
    { returnDocument: "after", runValidators: true },
  );
  if (order) return order.toObject();
  const current = await Order.findOne({ orderNumber }).lean();
  if (!current) throw new CheckoutError("Order not found.", 404);
  if (current.paymentMethod !== "COD") throw new CheckoutError("Only cash-on-delivery orders can be marked as cash received.", 409);
  if (current.orderStatus !== "delivered") throw new CheckoutError("Mark the order as delivered before confirming cash received.", 409);
  if (current.paymentStatus === "paid") return current;
  throw new CheckoutError("This payment cannot be marked as received.", 409);
}
