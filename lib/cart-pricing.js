export const DELIVERY_FEE = 20;
export const FREE_DELIVERY_THRESHOLD = 399;

export function calculateDeliveryFee(subtotal, threshold = FREE_DELIVERY_THRESHOLD) {
  return subtotal >= threshold ? 0 : DELIVERY_FEE;
}

export function amountUntilFreeDelivery(subtotal, threshold = FREE_DELIVERY_THRESHOLD) {
  return Math.max(0, threshold - subtotal);
}

export function calculatePromoDiscount(promotion, subtotal, now = new Date()) {
  const code = String(promotion?.code || "").toUpperCase();
  if (!promotion || promotion.deletedAt || !promotion.active || (promotion.expiresAt && new Date(promotion.expiresAt) <= now)) return { valid: false, code, discount: 0, message: "That promo code is not available." };
  if (subtotal < promotion.minSubtotal) return { valid: false, code, discount: 0, message: `Add ₹${promotion.minSubtotal - subtotal} more to use ${code}.` };
  const rawDiscount = promotion.type === "percent" ? Math.round(subtotal * promotion.value / 100) : promotion.value;
  const discount = Math.min(subtotal, rawDiscount, promotion.type === "percent" ? promotion.maxDiscount : subtotal);
  if (!Number.isFinite(discount) || discount <= 0) return { valid: false, code, discount: 0, message: "That promo code is not available for this order." };
  return { valid: true, code, discount, message: `${code} applied — you saved ₹${discount}.` };
}
