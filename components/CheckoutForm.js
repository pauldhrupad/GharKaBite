"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Banknote, Check, Clock3, CreditCard, MapPin, NotebookPen, ShieldCheck, UserRound } from "lucide-react";
import Button from "./Button";
import CustomSelect from "./CustomSelect";
import EmptyState from "./EmptyState";
import LocationPicker from "./LocationPicker";
import PaymentOptions, { availableChannels } from "./PaymentOptions";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { deliverySlotStart, kolkataDate } from "@/lib/dates";
import { calculateDeliveryFee } from "@/lib/cart-pricing";
import { usePromoQuote } from "@/lib/use-promo-quote";

const deliverySlots = {
  Lunch: ["12–1 PM", "1–2 PM"],
  Dinner: ["7–8 PM", "8–9 PM", "9–9:30 PM"],
};

const initialForm = {
  fullName: "", mobile: "", email: "", house: "", street: "", area: "", landmark: "", city: "Kolkata", pinCode: "", location: null, notes: "",
};
const addressFields = ["house", "street", "area", "landmark", "city", "pinCode"];

function addressKey(address, index) {
  return String(address._id || index);
}

function addressValues(address) {
  return {
    house: address.house || "",
    street: address.street || "",
    area: address.area || "",
    landmark: address.landmark || "",
    city: address.city || "Kolkata",
    pinCode: address.pinCode || "",
    location: address.location || null,
  };
}

export default function CheckoutForm() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { items, hydrated, subtotal, cartPeriod, cartDate, clearCart, promoCode, setPromoCode } = useCart();
  const { getAvailability, settings } = useKitchen();
  const [form, setForm] = useState(initialForm);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("custom");
  const [editingContact, setEditingContact] = useState(false);
  const [editingAddress, setEditingAddress] = useState(true);
  const [profileState, setProfileState] = useState({ userId: "", status: "loading" });
  const [deliverySlot, setDeliverySlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentChannel, setPaymentChannel] = useState("");
  const [paymentSettingsError, setPaymentSettingsError] = useState("");
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
  }).filter((item, index, eligible) => eligible.findIndex((candidate) => candidate.mealId === item.mealId) === index);
  const coveredItem = eligibleItems.find((item) => item.mealId === coveredMealId);
  const payableSubtotal = subtotal - (coveredItem?.basePrice || 0);
  const deliveryFee = selectedSubscription ? 0 : calculateDeliveryFee(subtotal, settings.freeDeliveryThreshold ?? 399);
  const promo = usePromoQuote(promoCode, payableSubtotal);
  const total = Math.max(0, subtotal - (coveredItem?.basePrice || 0) - (promo?.valid ? promo.discount : 0) + deliveryFee);
  const availability = serviceDate === kolkataDate() ? getAvailability(mealPeriod) : { available: true, reason: "" };
  const selectedAddress = savedAddresses.find((address, index) => addressKey(address, index) === selectedAddressId);
  const profileReady = authStatus === "authenticated" && profileState.userId === session?.user?.id && profileState.status === "ready";
  const profileFailed = authStatus === "authenticated" && profileState.userId === session?.user?.id && profileState.status === "error";

  useEffect(() => {
    fetch("/api/payment-settings", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Payment options are unavailable. Please retry shortly."); return response.json(); }).then((data) => { setPaymentSettings(data.payment); setPaymentMethod(data.payment.onlinePaymentEnabled ? "manual_online" : data.payment.codEnabled ? "COD" : ""); setPaymentChannel(availableChannels(data.payment)[0] || ""); }).catch((error) => setPaymentSettingsError(error.message));
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session?.user?.id) return undefined;
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load saved details.");
        const data = await response.json();
        if (controller.signal.aborted) return;

        const user = data.user;
        const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
        const firstAddress = addresses[0];
        setSavedAddresses(addresses);
        setSelectedAddressId(firstAddress ? addressKey(firstAddress, 0) : "custom");
        setEditingContact(!user?.name || !user?.phone);
        setEditingAddress(!firstAddress || !firstAddress.house || !firstAddress.street || !firstAddress.area || !firstAddress.pinCode);
        setForm((current) => ({
          ...current,
          fullName: user?.name || "",
          mobile: user?.phone || "",
          email: user?.email || "",
          ...(firstAddress ? addressValues(firstAddress) : {}),
        }));
        setProfileState({ userId: session.user.id, status: "ready" });
      } catch {
        if (controller.signal.aborted) return;
        setEditingContact(true);
        setEditingAddress(true);
        setForm((current) => ({
          ...current,
          fullName: session.user.name || "",
          mobile: session.user.phone || "",
          email: session.user.email || "",
        }));
        setProfileState({ userId: session.user.id, status: "error" });
      }
    }

    loadProfile();
    return () => controller.abort();
  }, [authStatus, session?.user?.id, session?.user?.name, session?.user?.phone, session?.user?.email]);

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
    setForm((current) => ({ ...current, [name]: value, ...(["street", "area", "city", "pinCode"].includes(name) ? { location: null } : {}) }));
    setErrors((current) => ({ ...current, [name]: "" }));
    if (addressFields.includes(name)) {
      setSelectedAddressId("custom");
      setDeliveryResult(null);
    }
  }

  function selectAddress(event) {
    const id = event.target.value;
    setSelectedAddressId(id);
    setAddressQuery("");
    setSuggestions([]);
    setDeliveryResult(null);
    setErrors((current) => ({ ...current, house: "", street: "", area: "", city: "", pinCode: "" }));
    const address = savedAddresses.find((item, index) => addressKey(item, index) === id);
    setForm((current) => ({ ...current, ...addressValues(address || initialForm) }));
    setEditingAddress(!address);
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
    if (["fullName", "mobile", "email"].some((field) => nextErrors[field])) setEditingContact(true);
    if (addressFields.some((field) => nextErrors[field])) setEditingAddress(true);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    if (!validate() || !availability.available || (promoCode.trim() && !promo.valid)) return;
    setSubmitting(true);

    const payload = {
        items: items.map((item) => ({ mealId: item.mealId, quantity: item.quantity, selectedChoices: item.selectedChoices, selectedAddOns: item.selectedAddOns })),
      contact: { name: form.fullName.trim(), phone: form.mobile.replace(/\D/g, ""), email: form.email.trim() },
      deliveryAddress: { house: form.house.trim(), street: form.street.trim(), area: form.area.trim(), landmark: form.landmark.trim(), city: form.city.trim(), pinCode: form.pinCode, ...(form.location ? { location: form.location } : {}) },
      mealPeriod, serviceDate, deliverySlot, notes: form.notes.trim(), promoCode,
      subscriptionId, coveredMealId, paymentMethod, paymentChannel: paymentMethod === "manual_online" ? paymentChannel : null,
    };
    const signature = JSON.stringify({ payload, paymentMethod });
    if (checkoutSignature.current !== signature) {
      checkoutKey.current = crypto.randomUUID();
      checkoutSignature.current = signature;
    }
    payload.checkoutKey = checkoutKey.current;

    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (response.status === 401) { router.push("/login?callbackUrl=/checkout"); return; }
      if (!response.ok) throw new Error(data.message || "Unable to place this order.");
      clearCart(); router.push(paymentMethod === "manual_online" ? `/orders/${data.order.orderNumber}/payment` : `/orders/${data.order.orderNumber}`);
    } catch (error) {
      setSubmitError(error.message || "Unable to place this order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkAddress() {
    setDeliveryResult({ serviceable: false, reason: "Checking address…" });
    try {
      const address = { house: form.house, street: form.street, area: form.area, city: form.city, pinCode: form.pinCode, ...(form.location ? { location: form.location } : {}) };
      const response = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      setDeliveryResult(await response.json());
    } catch { setDeliveryResult({ serviceable: false, reason: "We couldn't verify this address. Please contact us for delivery confirmation." }); }
  }

  if (!hydrated) return <section className="container-shell py-10"><div className="h-80 animate-pulse rounded-2xl bg-surface-muted" /></section>;
  if (!items.length) return <section className="container-shell py-12"><EmptyState title="Your tiffin box is empty." description="Add a lunch or dinner meal before continuing to checkout." actionLabel="Browse Menu" /></section>;
  if (authStatus === "loading" || (authStatus === "authenticated" && !profileReady && !profileFailed)) return <section className="container-shell py-10"><div className="card-surface h-44 animate-pulse bg-surface-muted" aria-label="Loading your checkout details" /></section>;
  if (authStatus === "unauthenticated") return <section className="container-shell py-10"><div className="card-surface max-w-xl p-6 md:p-8"><h2 className="text-2xl font-black">Sign in to finish your order</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Your saved contact details and delivery addresses will be filled in automatically. Your cart will be waiting when you return.</p><div className="mt-5 flex flex-wrap gap-3"><Button href="/login?callbackUrl=/checkout">Sign in and continue</Button><Button href="/register" variant="secondary">Create an account</Button></div></div></section>;

  return (
    <form onSubmit={handleSubmit} noValidate className="container-shell grid gap-7 py-10 lg:grid-cols-[1fr_23rem] lg:items-start">
      <div className="space-y-5">
        <CheckoutSection icon={UserRound} number="1" title="Contact Information">
          {profileFailed && <p className="mb-4 rounded-xl bg-warning/10 p-3 text-sm text-text-secondary" role="status">We couldn’t load your saved profile. Please review your details for this order.</p>}
          {profileReady && !editingContact ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface-muted p-4">
              <div className="min-w-0 text-sm leading-6"><p className="font-black">{form.fullName}</p><p>{form.mobile}</p>{form.email && <p className="break-all text-text-secondary">{form.email}</p>}</div>
              <button type="button" onClick={() => setEditingContact(true)} className="text-sm font-bold text-primary underline underline-offset-4">Edit for this order</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" type="text" value={form.fullName} onChange={updateField} error={errors.fullName} autoComplete="name" placeholder="e.g. Ananya Sen" />
              <Field label="Mobile number" name="mobile" type="tel" value={form.mobile} onChange={updateField} error={errors.mobile} autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" placeholder="e.g. 9876543210" maxLength={10} />
              <Field label="Email" optional name="email" value={form.email} onChange={updateField} error={errors.email} type="email" autoComplete="email" placeholder="e.g. ananya@example.com" className="sm:col-span-2" />
            </div>
          )}
        </CheckoutSection>

        <CheckoutSection icon={MapPin} number="2" title="Delivery Address">
          {savedAddresses.length > 0 && <label className="mb-4 block text-sm font-bold">Deliver to<CustomSelect value={selectedAddressId} onChange={selectAddress} className="input-field mt-2"><option value="custom">Use another address</option>{savedAddresses.map((address, index) => <option key={addressKey(address, index)} value={addressKey(address, index)}>{address.label || `Address ${index + 1}`} · {address.area}, {address.city}</option>)}</CustomSelect></label>}
          <div className="mb-4"><LocationPicker location={form.location} onSelect={(choice) => { setForm((current) => ({ ...current, ...choice.address, location: choice.location })); setSelectedAddressId("custom"); setEditingAddress(true); setDeliveryResult(choice.result); setAddressQuery(""); setSuggestions([]); }} /></div>
          {selectedAddress && !editingAddress ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface-muted p-4">
              <div className="min-w-0 text-sm leading-6"><p className="font-black">{selectedAddress.label || "Saved address"}</p><p>{[form.house, form.street, form.area].filter(Boolean).join(", ")}</p>{form.landmark && <p>{form.landmark}</p>}<p>{form.city} · {form.pinCode}</p></div>
              <button type="button" onClick={() => setEditingAddress(true)} className="text-sm font-bold text-primary underline underline-offset-4">Edit for this order</button>
            </div>
          ) : (
            <>
              <label className="mb-4 block text-sm font-bold">Search address<input type="search" name="addressSearch" value={addressQuery} onChange={(event) => setAddressQuery(event.target.value)} className="input-field mt-2" placeholder="Search by street, area or PIN" autoComplete="off" enterKeyHint="search" /></label>
              {suggestions.length > 0 && <div className="mb-4 max-h-40 overflow-y-auto rounded-xl border border-border bg-white">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setAddressQuery(suggestion); setSuggestions([]); setSelectedAddressId("custom"); setForm((current) => ({ ...current, street: suggestion, location: null })); setDeliveryResult(null); }} className="block w-full border-b border-border p-2 text-left text-xs hover:bg-surface-muted">{suggestion}</button>)}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="House / flat" name="house" value={form.house} onChange={updateField} error={errors.house} autoComplete="address-line1" placeholder="e.g. Flat 3B" />
                <Field label="Building / street" name="street" value={form.street} onChange={updateField} error={errors.street} autoComplete="address-line2" placeholder="e.g. 21 Lake Road" />
                <Field label="Area" name="area" value={form.area} onChange={updateField} error={errors.area} autoComplete="address-level3" placeholder="e.g. Ballygunge" />
                <Field label="Landmark" optional name="landmark" value={form.landmark} onChange={updateField} placeholder="e.g. Near the post office" />
                <Field label="City" name="city" value={form.city} onChange={updateField} error={errors.city} autoComplete="address-level2" />
                <Field label="PIN code" name="pinCode" value={form.pinCode} onChange={updateField} error={errors.pinCode} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" placeholder="e.g. 700029" maxLength={6} />
              </div>
              {!savedAddresses.length && <p className="mt-3 text-xs text-text-secondary">Save an address in <Link href="/profile" className="font-bold text-primary underline underline-offset-2">your profile</Link> for faster checkout next time.</p>}
            </>
          )}
          <button type="button" onClick={checkAddress} className="mt-4 rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary">Check this address</button>
          {deliveryResult && <p className={`mt-3 text-sm font-bold ${deliveryResult.serviceable ? "text-success" : "text-danger"}`} role="status">{deliveryResult.reason}</p>}
        </CheckoutSection>

        <CheckoutSection icon={Clock3} number="3" title="Delivery Slot">
          <p className="text-sm font-bold text-text-secondary">Delivery on {serviceDate} · {mealPeriod}. Change the date from the menu if needed.</p>
          {!availability.available && <p className="mt-3 rounded-xl border border-danger/20 bg-danger/7 p-3 text-sm font-bold text-danger">{availability.reason}</p>}
          <fieldset className="mt-4">
            <legend className="sr-only">Choose a delivery slot</legend>
            <div className="grid gap-3 sm:grid-cols-3">
            {slots.map((slot) => <label key={slot} className={`cursor-pointer rounded-xl border p-4 text-center text-sm font-black transition-colors focus-within:outline-2 focus-within:outline-primary active:scale-[0.99] ${deliverySlot === slot ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface hover:border-primary/40"}`}><input type="radio" name="deliverySlot" value={slot} checked={deliverySlot === slot} onChange={() => { setDeliverySlot(slot); setSubscriptionId(""); setCoveredMealId(""); setErrors((current) => ({ ...current, deliverySlot: "" })); }} className="sr-only" />{deliverySlot === slot && <Check className="mr-1 inline size-4" aria-hidden="true" />}{slot}</label>)}
            </div>
            {errors.deliverySlot && <p className="mt-2 text-xs font-bold text-danger">{errors.deliverySlot}</p>}
          </fieldset>
        </CheckoutSection>

        <CheckoutSection icon={CreditCard} number="4" title="Payment Method">
          {paymentSettingsError && <p role="alert" className="text-sm font-bold text-danger">{paymentSettingsError}</p>}
          {!paymentSettings && !paymentSettingsError && <p className="text-sm text-text-secondary">Loading payment options…</p>}
          {paymentSettings && <><div className="grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-primary active:scale-[0.99] ${paymentMethod === "manual_online" ? "border-primary bg-primary/8" : "border-border hover:border-primary/40 hover:bg-primary/5"} ${!paymentSettings.onlinePaymentEnabled ? "cursor-not-allowed opacity-50" : ""}`}><input type="radio" name="payment" value="manual_online" checked={paymentMethod === "manual_online"} disabled={!paymentSettings.onlinePaymentEnabled} onChange={() => setPaymentMethod("manual_online")} className="sr-only" /><span className="flex items-center gap-3"><CreditCard className="size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="block font-black">Online Payment</span><span className="text-xs text-text-secondary">UPI · manually verified</span></span>{paymentMethod === "manual_online" && <Check className="size-5 text-primary" aria-hidden="true" />}</span></label>
            {paymentSettings.codEnabled && <label className={`cursor-pointer rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-primary active:scale-[0.99] ${paymentMethod === "COD" ? "border-primary bg-primary/8" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}><input type="radio" name="payment" value="COD" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} className="sr-only" /><span className="flex items-center gap-3"><Banknote className="size-5 text-primary" aria-hidden="true" /><span className="flex-1"><span className="block font-black">Cash on Delivery</span><span className="text-xs text-text-secondary">Pay when your meal arrives</span></span>{paymentMethod === "COD" && <Check className="size-5 text-primary" aria-hidden="true" />}</span></label>}
          </div>{!paymentSettings.onlinePaymentEnabled && <p className="mt-3 text-sm text-text-secondary">Online payment is temporarily unavailable. Please choose another payment method.</p>}{paymentMethod === "manual_online" && <div className="mt-5"><PaymentOptions payment={paymentSettings} channel={paymentChannel} onChange={setPaymentChannel} amount={total} /></div>}</>}
        </CheckoutSection>

        {availableSubscriptions.length > 0 && <CheckoutSection icon={Check} number="5" title="Use a meal plan"><label className="text-sm font-bold">Subscription<CustomSelect value={subscriptionId} onChange={(event) => { setSubscriptionId(event.target.value); setCoveredMealId(""); }} className="input-field mt-2"><option value="">Pay without a plan credit</option>{availableSubscriptions.map((item) => <option key={item._id} value={item._id}>{item.planName} · {item.remainingMeals} left</option>)}</CustomSelect></label>{subscriptionId && <label className="mt-3 block text-sm font-bold">Cover one Thali base<CustomSelect value={coveredMealId} onChange={(event) => setCoveredMealId(event.target.value)} className="input-field mt-2"><option value="">Choose a Thali</option>{eligibleItems.map((item) => <option key={item.key} value={item.mealId}>{item.name} · ₹{item.basePrice} base covered</option>)}</CustomSelect>{errors.coveredMealId && <span className="text-xs text-danger">{errors.coveredMealId}</span>}</label>}<p className="mt-3 text-xs text-text-secondary">Your plan covers one eligible base Thali and delivery. Paid choices and add-ons remain payable.</p></CheckoutSection>}

        <CheckoutSection icon={NotebookPen} number="6" title="Order Notes">
          <label className="block text-sm font-bold">Cooking or delivery instructions <span className="font-normal text-text-secondary">(optional)</span><textarea name="notes" value={form.notes} onChange={updateField} className="input-field mt-2 min-h-24 resize-y" placeholder="e.g. Please make it mildly spicy" maxLength={300} /></label>
          <p className="mt-2 text-xs font-semibold text-text-secondary">Special requests are subject to availability.</p>
        </CheckoutSection>
      </div>

      <aside className="card-surface p-5 lg:sticky lg:top-24">
        <h2 className="text-xl font-black">Order Summary</h2>
        <div className="mt-5 space-y-4">
          {items.map((item) => <div key={item.key} className="flex gap-3"><div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted"><Image src={item.image} alt="" fill sizes="56px" className="object-cover" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">{item.name}</p><p className="text-xs text-text-secondary">{item.quantity} × ₹{item.price}</p>{item.choiceSummary?.flatMap((group) => group.options.map((option) => <p key={`${group.groupId}-${option.id}`} className="text-xs text-text-secondary">{group.groupName}: {option.name}</p>))}{item.addOnSummary?.map((addOn) => <p key={addOn.id} className="text-xs text-text-secondary">{addOn.name} ×{addOn.quantity} per Thali</p>)}</div><p className="text-sm font-black">₹{item.quantity * item.price}</p></div>)}
        </div>
        <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
          {coveredItem && <div className="flex justify-between text-success"><span>Plan Thali base</span><span>−₹{coveredItem.basePrice}</span></div>}
          {promo?.valid && <div className="flex justify-between text-success"><span>{promo.code}</span><span>−₹{promo.discount}</span></div>}
          <label className="block font-bold">Promo code<input name="promoCode" type="text" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Enter promo code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} className="input-field mt-1 uppercase" /></label>
          {promoCode.trim() && <p className={`text-xs font-bold ${promo.valid ? "text-success" : "text-warning"}`} role="status">{promo.message}</p>}
          <div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="flex justify-between text-text-secondary"><span>Delivery</span><span className={deliveryFee === 0 ? "font-black text-success" : ""}>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span></div>
          <div className="flex justify-between border-t border-border pt-4 text-lg font-black"><span>Total</span><span>₹{total}</span></div>
        </div>
        {submitError && <p className="mt-4 rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger" role="alert">{submitError}</p>}
        <Button type="submit" disabled={submitting || !availability.available || !paymentMethod || (paymentMethod === "manual_online" && !paymentChannel) || (Boolean(promoCode.trim()) && !promo.valid)} className="mt-5 w-full disabled:cursor-not-allowed disabled:opacity-55">{submitting ? "Placing order…" : paymentMethod === "manual_online" ? "Place order & continue to payment" : "Place COD order"}</Button>
        <p className="mt-5 flex items-center gap-2 text-xs font-bold text-text-secondary"><ShieldCheck className="size-4 text-success" aria-hidden="true" /> Online orders are confirmed only after we verify payment.</p>
      </aside>
    </form>
  );
}

function CheckoutSection({ icon: Icon, number, title, children }) {
  return <section className="card-surface p-5 md:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">Step {number}</p><h2 className="text-xl font-black">{title}</h2></div></div><div className="mt-6">{children}</div></section>;
}

function Field({ label, optional, error, className = "", ...props }) {
  const inputId = props.id || `checkout-${props.name}`;
  const errorId = `${inputId}-error`;
  return <label htmlFor={inputId} className={`text-sm font-bold ${className}`}>{label} {optional && <span className="font-normal text-text-secondary">(optional)</span>}<input id={inputId} className="input-field mt-2" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props} />{error && <span id={errorId} className="mt-1 block text-xs font-bold text-danger">{error}</span>}</label>;
}
