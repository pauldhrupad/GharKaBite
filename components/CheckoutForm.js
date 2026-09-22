"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Clock3, CreditCard, MapPin, NotebookPen, ShieldCheck, UserRound } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { deliverySlotStart, kolkataDate } from "@/lib/dates";
import { calculateDeliveryFee, validatePromoCode } from "@/lib/cart-pricing";

const deliverySlots = {
  Lunch: ["12–1 PM", "1–2 PM"],
  Dinner: ["7–8 PM", "8–9 PM", "9–9:30 PM"],
};

const initialForm = {
  fullName: "", mobile: "", email: "", house: "", street: "", area: "", landmark: "", city: "Kolkata", pinCode: "", notes: "",
};

export default function CheckoutForm() {
  const router = useRouter();
  const { items, hydrated, subtotal, cartPeriod, cartDate, clearCart, promoCode, setPromoCode } = useCart();
  const { getAvailability } = useKitchen();
  const [form, setForm] = useState(initialForm);
  const [deliverySlot, setDeliverySlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [menu, setMenu] = useState([]);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [coveredMealId, setCoveredMealId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [intentId, setIntentId] = useState("");
  const checkoutKey = useRef(null);
  const checkoutSignature = useRef(null);

  const mealPeriod = cartPeriod || "Lunch";
  const serviceDate = cartDate || kolkataDate();
  const slots = deliverySlots[mealPeriod];
  const planValidTime = deliverySlot ? deliverySlotStart(serviceDate, mealPeriod, deliverySlot) : new Date(`${serviceDate}T00:00:00+05:30`);
  const availableSubscriptions = subscriptions.filter((item) => new Date(item.expiryDate) > planValidTime);
  const selectedSubscription = availableSubscriptions.find((item) => item._id === subscriptionId);
  const eligibleItems = items.filter((item) => {
    const meal = menu.find((entry) => entry.id === item.mealId);
    return meal && selectedSubscription?.allowedMealTypes.includes(meal.mealType);
  });
  const coveredItem = eligibleItems.find((item) => item.mealId === coveredMealId);
  const deliveryFee = selectedSubscription ? 0 : calculateDeliveryFee(subtotal);
  const promo = promoCode ? validatePromoCode(promoCode, subtotal - (coveredItem?.price || 0)) : null;
  const total = Math.max(0, subtotal - (coveredItem?.price || 0) - (promo?.valid ? promo.discount : 0) + deliveryFee);
  const availability = serviceDate === kolkataDate() ? getAvailability(mealPeriod) : { available: true, reason: "" };

  useEffect(() => {
    fetch("/api/subscriptions").then((response) => response.ok ? response.json() : null).then((data) => setSubscriptions((data?.subscriptions || []).filter((item) => item.status === "active" && item.remainingMeals > 0 && new Date(item.expiryDate) > new Date(`${serviceDate}T00:00:00+05:30`) && (item.mode === "Mixed" || item.mode === mealPeriod)))).catch(() => {});
    fetch(`/api/menu?date=${serviceDate}`).then((response) => response.ok ? response.json() : null).then((data) => setMenu(data?.meals || [])).catch(() => {});
  }, [mealPeriod, serviceDate]);

  useEffect(() => {
    if (addressQuery.trim().length < 3) return undefined;
    const timer = window.setTimeout(() => fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: addressQuery }) }).then((response) => response.ok ? response.json() : null).then((data) => setSuggestions(data?.suggestions || [])).catch(() => setSuggestions([])), 400);
    return () => window.clearTimeout(timer);
  }, [addressQuery]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    if (["house", "street", "area", "city", "pinCode"].includes(name)) setDeliveryResult(null);
  }

  function validate() {
    const nextErrors = {};
    if (form.fullName.trim().length < 2) nextErrors.fullName = "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, ""))) nextErrors.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Enter a valid email address.";
    ["house", "street", "area", "city"].forEach((field) => { if (!form[field].trim()) nextErrors[field] = "This field is required."; });
    if (!/^\d{6}$/.test(form.pinCode)) nextErrors.pinCode = "Enter a valid 6-digit PIN code.";
    if (!deliverySlot) nextErrors.deliverySlot = "Choose a delivery slot.";
    if (subscriptionId && !coveredMealId) nextErrors.coveredMealId = "Choose one meal for your plan credit.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    if (!validate() || !availability.available) return;
    setSubmitting(true);

    const payload = {
      items: items.map((item) => ({ mealId: item.mealId, quantity: item.quantity })),
      contact: { name: form.fullName.trim(), phone: form.mobile.replace(/\D/g, ""), email: form.email.trim() },
      deliveryAddress: { house: form.house.trim(), street: form.street.trim(), area: form.area.trim(), landmark: form.landmark.trim(), city: form.city.trim(), pinCode: form.pinCode },
      mealPeriod, serviceDate, deliverySlot, notes: form.notes.trim(), promoCode,
      subscriptionId, coveredMealId,
    };
    const signature = JSON.stringify({ payload, paymentMethod });
    if (checkoutSignature.current !== signature) {
      checkoutKey.current = crypto.randomUUID();
      checkoutSignature.current = signature;
    }
    payload.checkoutKey = checkoutKey.current;

    try {
      const response = await fetch(paymentMethod === "COD" ? "/api/orders" : "/api/demo-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paymentMethod === "COD" ? payload : { kind: "order", key: checkoutKey.current, payload }) });
      const data = await response.json();
      if (response.status === 401) { router.push("/login?callbackUrl=/checkout"); return; }
      if (!response.ok) throw new Error(data.message || "Unable to place this order.");
      if (paymentMethod === "COD") { clearCart(); router.push(`/orders/${data.order.orderNumber}`); }
      else setIntentId(data.id);
    } catch (error) {
      setSubmitError(error.message || "Unable to place this order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkAddress() {
    setDeliveryResult({ serviceable: false, reason: "Checking address…" });
    try {
      const address = { house: form.house, street: form.street, area: form.area, city: form.city, pinCode: form.pinCode };
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      setDeliveryResult(await response.json());
    } catch { setDeliveryResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }); }
  }

  async function completeDemo(outcome) {
    setSubmitting(true); setSubmitError("");
    try {
      const response = await fetch(`/api/demo-payments/${intentId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setIntentId("");
      if (outcome === "success") { clearCart(); router.push(`/orders/${data.result.orderNumber}`); }
      else { checkoutKey.current = null; checkoutSignature.current = null; setSubmitError(data.message); }
    } catch (error) { setSubmitError(error.message || "Demo payment failed."); }
    finally { setSubmitting(false); }
  }

  if (!hydrated) return <section className="container-shell py-10"><div className="h-80 animate-pulse rounded-2xl bg-surface-muted" /></section>;
  if (!items.length) return <section className="container-shell py-12"><EmptyState title="Your tiffin box is empty." description="Add a lunch or dinner meal before continuing to checkout." actionLabel="Browse Today’s Menu" /></section>;

  return (
    <form onSubmit={handleSubmit} noValidate className="container-shell grid gap-7 py-10 lg:grid-cols-[1fr_23rem] lg:items-start">
      <div className="space-y-5">
        <CheckoutSection icon={UserRound} number="1" title="Contact Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" name="fullName" value={form.fullName} onChange={updateField} error={errors.fullName} autoComplete="name" placeholder="Your full name" />
            <Field label="Mobile Number" name="mobile" value={form.mobile} onChange={updateField} error={errors.mobile} autoComplete="tel" inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} />
            <Field label="Email" optional name="email" value={form.email} onChange={updateField} error={errors.email} type="email" autoComplete="email" placeholder="you@example.com" className="sm:col-span-2" />
          </div>
        </CheckoutSection>

        <CheckoutSection icon={MapPin} number="2" title="Delivery Address">
          <label className="mb-4 block text-sm font-bold">Search address<input value={addressQuery} onChange={(event) => setAddressQuery(event.target.value)} className="input-field mt-2" placeholder="Start typing a street and area" /></label>
          {suggestions.length > 0 && <div className="mb-4 max-h-40 overflow-y-auto rounded-xl border border-border bg-white">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setAddressQuery(suggestion); setSuggestions([]); setForm((current) => ({ ...current, street: suggestion })); setDeliveryResult(null); }} className="block w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{suggestion}</button>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="House / Flat" name="house" value={form.house} onChange={updateField} error={errors.house} autoComplete="address-line1" placeholder="Flat or house number" />
            <Field label="Building / Street" name="street" value={form.street} onChange={updateField} error={errors.street} autoComplete="address-line2" placeholder="Building and road" />
            <Field label="Area" name="area" value={form.area} onChange={updateField} error={errors.area} placeholder="Locality" />
            <Field label="Landmark" optional name="landmark" value={form.landmark} onChange={updateField} placeholder="Nearby landmark" />
            <Field label="City" name="city" value={form.city} onChange={updateField} error={errors.city} autoComplete="address-level2" />
            <Field label="PIN Code" name="pinCode" value={form.pinCode} onChange={updateField} error={errors.pinCode} autoComplete="postal-code" inputMode="numeric" placeholder="7000XX" maxLength={6} />
          </div>
          <button type="button" onClick={checkAddress} className="mt-4 rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary">Check this address</button>
          {deliveryResult && <p className={`mt-3 text-sm font-bold ${deliveryResult.serviceable ? "text-success" : "text-danger"}`} role="status">{deliveryResult.reason}</p>}
        </CheckoutSection>

        <CheckoutSection icon={Clock3} number="3" title="Delivery Slot">
          <p className="text-sm font-bold text-text-secondary">Delivery on {serviceDate} · {mealPeriod}. Change the date from the menu if needed.</p>
          {!availability.available && <p className="mt-3 rounded-xl border border-danger/20 bg-danger/7 p-3 text-sm font-bold text-danger">{availability.reason}</p>}
          <fieldset className="mt-4">
            <legend className="sr-only">Choose a delivery slot</legend>
            <div className="grid gap-3 sm:grid-cols-3">
            {slots.map((slot) => <label key={slot} className={`cursor-pointer rounded-xl border p-4 text-center text-sm font-black transition ${deliverySlot === slot ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface hover:border-primary/40"}`}><input type="radio" name="deliverySlot" value={slot} checked={deliverySlot === slot} onChange={() => { setDeliverySlot(slot); setSubscriptionId(""); setCoveredMealId(""); setErrors((current) => ({ ...current, deliverySlot: "" })); }} className="sr-only" />{slot}</label>)}
            </div>
            {errors.deliverySlot && <p className="mt-2 text-xs font-bold text-danger">{errors.deliverySlot}</p>}
          </fieldset>
        </CheckoutSection>

        <CheckoutSection icon={CreditCard} number="4" title="Payment">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-4 ${paymentMethod === "COD" ? "border-primary bg-primary/8" : "border-border"}`}><input type="radio" name="payment" value="COD" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} className="sr-only" /><span className="flex items-center gap-3"><Banknote className="size-5 text-primary" aria-hidden="true" /><span><span className="block font-black">Cash on Delivery</span><span className="text-xs text-text-secondary">Pay when your meal arrives</span></span></span></label>
            <label className={`cursor-pointer rounded-xl border p-4 ${paymentMethod === "DEMO" ? "border-primary bg-primary/8" : "border-border"}`}><input type="radio" name="payment" value="DEMO" checked={paymentMethod === "DEMO"} onChange={() => setPaymentMethod("DEMO")} className="sr-only" /><span className="flex items-center gap-3"><CreditCard className="size-5 text-primary" aria-hidden="true" /><span><span className="block font-black">Demo Payment</span><span className="text-xs text-text-secondary">Simulated; no money collected</span></span></span></label>
          </div>
        </CheckoutSection>

        {availableSubscriptions.length > 0 && <CheckoutSection icon={Check} number="5" title="Use a meal plan"><label className="text-sm font-bold">Subscription<select value={subscriptionId} onChange={(event) => { setSubscriptionId(event.target.value); setCoveredMealId(""); }} className="input-field mt-2"><option value="">Pay without a plan credit</option>{availableSubscriptions.map((item) => <option key={item._id} value={item._id}>{item.planName} · {item.remainingMeals} left</option>)}</select></label>{subscriptionId && <label className="mt-3 block text-sm font-bold">Cover one meal unit<select value={coveredMealId} onChange={(event) => setCoveredMealId(event.target.value)} className="input-field mt-2"><option value="">Choose a meal</option>{eligibleItems.map((item) => <option key={item.mealId} value={item.mealId}>{item.name} · ₹{item.price} covered</option>)}</select>{errors.coveredMealId && <span className="text-xs text-danger">{errors.coveredMealId}</span>}</label>}<p className="mt-3 text-xs text-text-secondary">Using a plan credit makes delivery free for this order.</p></CheckoutSection>}

        <CheckoutSection icon={NotebookPen} number="6" title="Order Notes">
          <label className="block text-sm font-bold">Cooking or delivery instructions <span className="font-normal text-text-secondary">(optional)</span><textarea name="notes" value={form.notes} onChange={updateField} className="input-field mt-2 min-h-24 resize-y" placeholder="Less spicy if possible" maxLength={300} /></label>
          <p className="mt-2 text-xs font-semibold text-text-secondary">Special requests are subject to availability.</p>
        </CheckoutSection>
      </div>

      <aside className="card-surface p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-black">Order Summary</h2>
        <div className="mt-5 space-y-4">
          {items.map((item) => <div key={`${item.mealId}-${item.deliveryMealPeriod}`} className="flex gap-3"><div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted"><Image src={item.image} alt="" fill sizes="56px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.name}</p><p className="text-xs text-text-secondary">{item.quantity} × ₹{item.price}</p></div><p className="text-sm font-black">₹{item.quantity * item.price}</p></div>)}
        </div>
        <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
          {coveredItem && <div className="flex justify-between text-success"><span>Plan meal</span><span>−₹{coveredItem.price}</span></div>}
          {promo?.valid && <div className="flex justify-between text-success"><span>{promo.code}</span><span>−₹{promo.discount}</span></div>}
          <label className="block font-bold">Promo code<input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="WELCOME10" className="input-field mt-1" /></label>
          <div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="flex justify-between text-text-secondary"><span>Delivery</span><span className={deliveryFee === 0 ? "font-black text-success" : ""}>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span></div>
          <div className="flex justify-between border-t border-border pt-4 text-lg font-black"><span>Total</span><span>₹{total}</span></div>
        </div>
        {submitError && <p className="mt-4 rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger" role="alert">{submitError}</p>}
        <Button type="submit" disabled={submitting || !availability.available} className="mt-5 w-full disabled:cursor-not-allowed disabled:opacity-55">{submitting ? "Placing order…" : paymentMethod === "DEMO" ? "Continue to demo payment" : "Place COD order"}</Button>
        <p className="mt-5 flex items-center gap-2 text-xs font-bold text-text-secondary"><ShieldCheck className="size-4 text-success" aria-hidden="true" /> Demo payment collects no money or card details.</p>
      </aside>
      {intentId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Demo payment</h2><p className="mt-2 text-sm text-text-secondary">Simulate a payment result. No money is collected.</p><div className="mt-6 flex gap-3"><button type="button" disabled={submitting} onClick={() => completeDemo("success")} className="rounded-xl bg-primary px-4 py-3 font-bold text-white">Simulate success</button><button type="button" disabled={submitting} onClick={() => completeDemo("failure")} className="rounded-xl border border-border px-4 py-3 font-bold">Simulate failure</button></div></div></div>}
    </form>
  );
}

function CheckoutSection({ icon: Icon, number, title, children }) {
  return <section className="card-surface p-5 md:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">Step {number}</p><h2 className="text-xl font-black">{title}</h2></div></div><div className="mt-6">{children}</div></section>;
}

function Field({ label, optional, error, className = "", ...props }) {
  return <label className={`text-sm font-bold ${className}`}>{label} {optional && <span className="font-normal text-text-secondary">(optional)</span>}<input className={`input-field mt-2 ${error ? "border-danger" : ""}`} {...props} />{error && <span className="mt-1 block text-xs font-bold text-danger">{error}</span>}</label>;
}
