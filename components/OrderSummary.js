import { formatINR } from "@/lib/cart-pricing";

export default function OrderSummary({ quote, label = "Total" }) {
  const items = quote.items || [];
  const bases = items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0);
  const choices = items.reduce((sum, item) => sum + item.choiceAdjustments * item.quantity, 0);
  const extras = items.reduce((sum, item) => sum + item.addOnTotal * item.quantity, 0);
  return <dl className="checkout-breakdown">
    {items.length ? <><div><dt>Meals (base)</dt><dd>{formatINR(bases)}</dd></div>{choices > 0 && <div><dt>Choice adjustments</dt><dd>{formatINR(choices)}</dd></div>}{extras > 0 && <div><dt>Extras</dt><dd>{formatINR(extras)}</dd></div>}</> : <div><dt>Meal subtotal</dt><dd>{formatINR(quote.subtotal)}</dd></div>}
    {quote.coveredBasePrice > 0 && <div><dt>Plan base covered</dt><dd>−{formatINR(quote.coveredBasePrice)}</dd></div>}
    {quote.discount > 0 && <div><dt>Promo {quote.promoCode}</dt><dd>−{formatINR(quote.discount)}</dd></div>}
    <div><dt>Delivery</dt><dd>{quote.deliveryFee === 0 ? "Free" : formatINR(quote.deliveryFee)}</dd></div>
    <div className="checkout-total"><dt>{label}</dt><dd>{formatINR(quote.total)}</dd></div>
  </dl>;
}
