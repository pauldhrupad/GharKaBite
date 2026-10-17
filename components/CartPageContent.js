"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import CartItemSummary from "./CartItemSummary";
import PromoCodeControl from "./PromoCodeControl";
import OrderSummary from "./OrderSummary";
import CheckoutActionBar from "./CheckoutActionBar";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { usePromoQuote } from "@/lib/use-promo-quote";
import { useCartReview } from "@/lib/use-cart-review";
import { amountUntilFreeDelivery, calculateDeliveryFee, formatINR, savedCartBreakdown } from "@/lib/cart-pricing";

export default function CartPageContent() {
  const { items, hydrated, removeItem, updateQuantity, clearCart, subtotal, promoCode, setPromoCode, cartDate, cartPeriod, storageError, cartNotice } = useCart();
  const { settings, getAvailability } = useKitchen();
  const [promoRetry, setPromoRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const list = useRef(null);
  const review = useCartReview(items, cartDate);
  const promo = usePromoQuote(promoCode, subtotal, promoRetry);
  if (!hydrated) return <LoadingState label="Loading your cart" rows={2} />;
  if (!items.length) return <section className="container-shell cart-page"><EmptyState title="Your tiffin box is waiting." description="Choose a homemade lunch or dinner. Your selections will be saved here." actionLabel="Explore Today’s Menu" /><p role="status" className="checkout-status">{notice || cartNotice || storageError}</p></section>;
  const threshold = settings.freeDeliveryThreshold;
  const deliveryFee = calculateDeliveryFee(subtotal, threshold);
  const remaining = amountUntilFreeDelivery(subtotal, threshold);
  const discount = promo.valid ? promo.discount : 0;
  const quote = { items: savedCartBreakdown(items), subtotal, deliveryFee, discount, promoCode, total: Math.max(0, subtotal - discount + deliveryFee) };
  const availability = getAvailability(cartPeriod, cartDate);
  const blocked = review.blocked || !availability.available || Boolean(promoCode && !promo.valid);
  function remove(item) {
    removeItem(item.key);
    setNotice(`${item.name} removed from your cart.`);
    window.requestAnimationFrame(() => { const target = list.current?.querySelector("button, a") || document.querySelector(".cart-page a"); target?.focus(); });
  }
  return <section className="container-shell cart-page checkout-grid"><div ref={list}>
    <div className="cart-delivery-summary"><span>One delivery</span><strong>{cartPeriod} · {cartDate}</strong></div>
    <div className="cart-list-heading"><p>{items.reduce((sum, item) => sum + item.quantity, 0)} {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "meal" : "meals"} in your cart</p><button type="button" className="checkout-text-action" onClick={() => { clearCart(); setNotice("Cart cleared."); }}>Clear cart</button></div>
    <p role="status" className="checkout-status">{notice || storageError || cartNotice}</p>
    {review.loading && <p role="status" className="checkout-notice">Checking current menu…</p>}
    {review.error && <p role="alert" className="checkout-notice checkout-notice--error">{review.error} <button type="button" onClick={review.retry} className="checkout-text-action">Try again</button></p>}
    {!availability.available && <p role="status" className="checkout-notice">{availability.reason} <Link href={`/menu?period=${cartPeriod}`} className="checkout-text-action">Explore available meals</Link></p>}
    <div className="cart-items">{items.map((item) => <CartItemSummary key={item.key} item={item} review={review.reviews.find((entry) => entry.key === item.key)} onQuantity={updateQuantity} onRemove={remove} />)}</div>
    <Link href={`/menu?date=${cartDate}&period=${cartPeriod}`} className="checkout-text-action cart-add-more">Add more meals</Link>
  </div><aside className="checkout-summary card-surface"><h2>Order summary</h2>
    <p className="cart-delivery-incentive">{remaining > 0 ? `${formatINR(remaining)} more for free local delivery` : "Free local delivery included"}</p>
    <PromoCodeControl code={promoCode} onApply={(code) => { setPromoCode(code); setPromoRetry((value) => value + 1); }} onRemove={() => setPromoCode("")} promo={promo} />
    <OrderSummary quote={quote} label="Estimated total" />
    <p className="checkout-support">Prices and availability are checked again before you place the order.</p>
    <CheckoutActionBar total={quote.total} label="Proceed to checkout" href="/checkout" disabled={blocked}>{review.blocked ? "Review your meals before continuing." : !availability.available ? availability.reason : promoCode && !promo.valid ? "Apply a valid code or remove it to continue." : ""}</CheckoutActionBar>
    <p className="checkout-support">Manual online payment or Cash on Delivery, when available.</p>
  </aside></section>;
}
