import PromoCode from "@/models/PromoCode";
import Order from "@/models/Order";
import { calculatePromoDiscount } from "./cart-pricing";

export function normalizePromoCode(code) {
  return String(code || "").trim().toUpperCase();
}

// Preserve the code already advertised in the cart, while letting the owner disable it.
export async function ensureWelcomePromo() {
  await Promise.all([PromoCode.init(), Order.init()]);
  await PromoCode.updateOne({ code: "WELCOME10" }, { $setOnInsert: { code: "WELCOME10", type: "percent", value: 10, maxDiscount: 100, minSubtotal: 0, active: true } }, { upsert: true });
}

export async function quotePromo(userId, code, subtotal, session) {
  const normalized = normalizePromoCode(code);
  if (!/^[A-Z0-9-]{4,20}$/.test(normalized)) return { valid: false, code: normalized, discount: 0, message: "Enter a valid promo code." };
  const promoQuery = PromoCode.findOne({ code: normalized, deletedAt: null });
  const usedQuery = Order.exists({ user: userId, promoCode: normalized });
  if (session) { promoQuery.session(session); usedQuery.session(session); }
  const [promotion, used] = await Promise.all([promoQuery.lean(), usedQuery]);
  if (used) return { valid: false, code: normalized, discount: 0, message: "You have already used this promo code." };
  if (normalized === "WELCOME10") {
    // Older orders stored the discount but not its code. WELCOME10 was the only legacy promo.
    const legacyQuery = Order.find({ user: userId, promoCode: { $in: ["", null] }, discount: { $gt: 0 } }).select("discount coveredMealId items");
    if (session) legacyQuery.session(session);
    const legacyOrders = await legacyQuery.lean();
    const previouslyUsed = legacyOrders.some((order) => {
      const coveredPrice = order.coveredMealId ? order.items.find((item) => item.mealId === order.coveredMealId)?.price || 0 : 0;
      return order.discount > coveredPrice;
    });
    if (previouslyUsed) return { valid: false, code: normalized, discount: 0, message: "You have already used this promo code." };
  }
  return calculatePromoDiscount(promotion, subtotal);
}
