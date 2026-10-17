export const DELIVERY_FEE = 20;
export const FREE_DELIVERY_THRESHOLD = 399;

export function formatINR(amount) {
  if (!Number.isFinite(amount)) return "Unavailable";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

export function savedCartBreakdown(items) {
  return items.map((item) => ({ mealId: item.mealId, quantity: item.quantity, basePrice: item.basePrice, choiceAdjustments: (item.choiceSummary || []).reduce((sum, group) => sum + group.options.reduce((n, option) => n + (option.priceAdjustment || 0), 0), 0), addOnTotal: (item.addOnSummary || []).reduce((sum, extra) => sum + extra.price * extra.quantity, 0), unitTotal: item.price, lineTotal: item.price * item.quantity }));
}

export function priceBreakdownChanges(previous, current) {
  const changes = [];
  for (const [field, label] of [["subtotal", "Meal subtotal"], ["coveredBasePrice", "Plan coverage"], ["discount", "Promo discount"], ["deliveryFee", "Delivery"], ["total", "Total"]]) {
    if ((previous[field] || 0) !== (current[field] || 0)) changes.push(`${label}: ${formatINR(previous[field] || 0)} → ${formatINR(current[field] || 0)}`);
  }
  const components = (quote) => (quote.items || []).map(({ mealId, quantity, basePrice, choiceAdjustments, addOnTotal }) => ({ mealId, quantity, basePrice, choiceAdjustments, addOnTotal }));
  if (JSON.stringify(components(previous)) !== JSON.stringify(components(current))) changes.unshift("Meal base prices, selected choices or extras have changed. Review the item breakdowns below.");
  return changes;
}

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
