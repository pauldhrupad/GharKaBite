export const DELIVERY_FEE = 20;
export const FREE_DELIVERY_THRESHOLD = 399;

const PROMO_CODES = {
  WELCOME10: {
    discountPercent: 10,
    maxDiscount: 100,
  },
};

export function calculateDeliveryFee(subtotal) {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}

export function amountUntilFreeDelivery(subtotal) {
  return Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
}

export function validatePromoCode(code, subtotal) {
  const normalizedCode = code.trim().toUpperCase();
  const promotion = PROMO_CODES[normalizedCode];

  if (!normalizedCode) {
    return { valid: false, code: "", discount: 0, message: "Enter a promo code first." };
  }

  if (!promotion) {
    return { valid: false, code: normalizedCode, discount: 0, message: "That promo code is not valid." };
  }

  const percentageDiscount = Math.round(subtotal * (promotion.discountPercent / 100));
  const discount = Math.min(percentageDiscount, promotion.maxDiscount);

  return {
    valid: true,
    code: normalizedCode,
    discount,
    message: `${normalizedCode} applied — you saved ₹${discount}.`,
  };
}
