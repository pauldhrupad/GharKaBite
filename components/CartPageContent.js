"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Minus, Plus, ShieldCheck, Tag, Trash2, Truck } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import { useCart } from "@/context/CartContext";
import {
  FREE_DELIVERY_THRESHOLD,
  amountUntilFreeDelivery,
  calculateDeliveryFee,
  validatePromoCode,
} from "@/lib/cart-pricing";

export default function CartPageContent() {
  const { items, hydrated, removeItem, updateQuantity, clearCart, subtotal, promoCode, setPromoCode } = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  if (!hydrated) {
    return (
      <section className="container-shell grid gap-7 py-10 lg:grid-cols-[1fr_22rem]">
        <div className="h-36 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="container-shell py-12">
        <EmptyState
          title="Your tiffin box is empty."
          description="Pick a freshly prepared lunch or dinner and it will be saved here for you."
          actionLabel="Browse Today’s Menu"
        />
      </section>
    );
  }

  const deliveryFee = calculateDeliveryFee(subtotal);
  const freeDeliveryRemaining = amountUntilFreeDelivery(subtotal);
  const freeDeliveryProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const activePromo = promoCode ? validatePromoCode(promoCode, subtotal) : null;
  const discount = activePromo?.valid ? activePromo.discount : 0;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  function applyPromo(event) {
    event.preventDefault();
    const result = validatePromoCode(promoInput, subtotal);
    setPromoMessage(result.message);
    setPromoCode(result.valid ? result.code : "");
    if (result.valid) setPromoInput(result.code);
  }

  return (
    <section className="container-shell grid gap-7 py-10 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-text-secondary">{items.length} {items.length === 1 ? "meal selection" : "meal selections"}</p>
          <button type="button" onClick={clearCart} className="min-h-10 rounded-lg px-2 text-sm font-black text-danger hover:bg-danger/8">Clear cart</button>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <article key={`${item.mealId}-${item.deliveryMealPeriod}`} className="card-surface flex gap-4 p-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:size-28">
                <Image src={item.image} alt={`${item.name} meal`} fill sizes="112px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-black sm:text-lg">{item.name}</h2>
                    <p className="mt-1 text-xs font-bold text-text-secondary">{item.deliveryMealPeriod} · {item.serviceDate}</p>
                    <p className="mt-2 text-sm font-extrabold">₹{item.price} each</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.mealId, item.deliveryMealPeriod)}
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger/8"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-text-secondary">Quantity</p>
                    <div className="flex items-center rounded-lg border border-border bg-surface">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.mealId, item.deliveryMealPeriod, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="grid size-10 place-items-center rounded-l-lg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-9 text-center text-sm font-black" aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.mealId, item.deliveryMealPeriod, item.quantity + 1)}
                        disabled={item.quantity >= 10}
                        className="grid size-10 place-items-center rounded-r-lg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-text-secondary">Subtotal</p>
                    <p className="text-lg font-black">₹{item.price * item.quantity}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="card-surface p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-black">Order summary</h2>

        <div className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
          <div className="flex items-center gap-2 text-sm font-black">
            {freeDeliveryRemaining > 0 ? <Truck className="size-4 text-accent" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-success" aria-hidden="true" />}
            {freeDeliveryRemaining > 0 ? `Add ₹${freeDeliveryRemaining} more for free delivery` : "You’ve unlocked free delivery"}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${freeDeliveryProgress}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-text-secondary">Free local delivery on orders of ₹{FREE_DELIVERY_THRESHOLD} or more.</p>
        </div>

        <form onSubmit={applyPromo} className="mt-5">
          <label htmlFor="promo-code" className="text-sm font-black">Promo code</label>
          <div className="mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
              <input
                id="promo-code"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                className="input-field pl-10 uppercase"
                placeholder="WELCOME10"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="min-h-12 rounded-xl border border-primary px-4 text-sm font-black text-primary hover:bg-primary/8">Apply</button>
          </div>
          <p className={`mt-2 min-h-5 text-xs font-bold ${promoCode ? "text-success" : "text-text-secondary"}`} aria-live="polite">
            {promoCode ? activePromo.message : (promoMessage || "Use WELCOME10 for 10% off, up to ₹100.")}
          </p>
        </form>

        <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
          <div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="flex justify-between text-text-secondary"><span>Local delivery</span><span className={deliveryFee === 0 ? "font-black text-success" : ""}>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span></div>
          {discount > 0 && <div className="flex justify-between font-bold text-success"><span>{activePromo.code}</span><span>−₹{discount}</span></div>}
          <div className="flex justify-between border-t border-border pt-4 text-lg font-black"><span>Total</span><span>₹{total}</span></div>
        </div>
        <Button href="/checkout" className="mt-5 w-full">Continue to checkout</Button>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs font-bold text-text-secondary"><ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" /> Checkout supports COD and a no-money demo payment.</p>
      </aside>
    </section>
  );
}
