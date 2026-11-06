"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Clock3, CreditCard, MapPin } from "lucide-react";
import Button from "./Button";
import CustomSelect from "./CustomSelect";
import EmptyState from "./EmptyState";
import LocationPicker from "./LocationPicker";
import LoadingState from "./LoadingState";
import { availableChannels } from "./PaymentOptions";
import CartItemSummary from "./CartItemSummary";
import PromoCodeControl from "./PromoCodeControl";
import OrderSummary from "./OrderSummary";
import CheckoutActionBar from "./CheckoutActionBar";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { deliverySlotStart, deliverySlots, slotExpired, kolkataDate } from "@/lib/dates";
import { calculateDeliveryFee, savedCartBreakdown, priceBreakdownChanges } from "@/lib/cart-pricing";
import { usePromoQuote } from "@/lib/use-promo-quote";
import { useCartReview } from "@/lib/use-cart-review";
import { revealValidationTarget } from "@/lib/validation-navigation";
import { readCheckoutAttempt, writeCheckoutAttempt } from "@/lib/checkout-attempt";

const initialForm = { fullName: "", mobile: "", email: "", house: "", street: "", area: "", landmark: "", city: "Kolkata", pinCode: "", location: null, notes: "" };
const addressFields = ["house", "street", "area", "landmark", "city", "pinCode"];
const addressKey = (address, index) => String(address._id || index);
const channelLabels = { qr: "Scan QR", upi_id: "UPI ID", phone: "UPI phone" };
function addressValues(address) { return { ...Object.fromEntries(addressFields.map((field) => [field, address[field] || (field === "city" ? "Kolkata" : "")])), location: address.location || null }; }

export default function CheckoutForm() {
  const { data: session, status } = useSession();
  const { items, hydrated } = useCart();
  if (!hydrated || status === "loading") return <LoadingState label="Loading your checkout details" rows={2} />;
  if (status !== "authenticated" || !session?.user?.id) {
    if (!items.length) return <EmptyCart />;
    return <section className="container-shell cart-page"><div className="card-surface p-5"><h2>Sign in to finish your order</h2><p className="checkout-support">Your cart will be waiting when you return.</p><div className="flex flex-wrap gap-3 mt-4"><Button href="/welcome?mode=signin&returnTo=/checkout">Sign in and continue</Button><Button href="/welcome?mode=signup&returnTo=/checkout" variant="outline">Create an account</Button></div></div></section>;
  }
  return <AccountCheckout key={session.user.id} user={session.user} />;
}

function EmptyCart() {
  return <section className="container-shell cart-page"><EmptyState title="Your tiffin box is waiting." description="Choose a homemade meal before checkout." actionLabel="Explore Today’s Menu" /></section>;
}

function AccountCheckout({ user }) {
  const router = useRouter();
  const { items, subtotal, cartPeriod, cartDate, completeCheckout, promoCode, setPromoCode, storageError, cartNotice, checkoutDraftRef } = useCart();
  const { getAvailability, settings, now } = useKitchen();
  const [form, setForm] = useState(initialForm);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("custom");
  const [editingContact, setEditingContact] = useState(false);
  const [editingAddress, setEditingAddress] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("");
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentSettingsError, setPaymentSettingsError] = useState("");
  const [paymentRetry, setPaymentRetry] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [recoveryWarning, setRecoveryWarning] = useState("");
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [coveredMealId, setCoveredMealId] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [promoRetry, setPromoRetry] = useState(0);
  const [quoteState, setQuoteState] = useState(null);
  const [reviewedRevision, setReviewedRevision] = useState("");
  const checkoutKey = useRef(null);
  const checkoutSignature = useRef(null);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const addressVersion = useRef(0);
  const requestScope = useRef(null);
  const mealPeriod = cartPeriod || "Lunch";
  const serviceDate = cartDate || kolkataDate();
  const review = useCartReview(items, cartDate);
  const planValidTime = Math.max(now, deliverySlot ? deliverySlotStart(serviceDate, mealPeriod, deliverySlot)?.getTime() || 0 : now);
  const availableSubscriptions = subscriptions.filter((item) => item.status === "active" && item.remainingMeals > 0 && new Date(item.expiryDate).getTime() > planValidTime && (item.mode === "Mixed" || item.mode === mealPeriod));
  const selectedSubscription = availableSubscriptions.find((item) => item._id === subscriptionId);
  const eligibleItems = items.filter((item) => { const meal = review.menu.find((entry) => entry.id === item.mealId); return meal?.available && meal.kind !== "dish" && meal.slots.includes(mealPeriod) && selectedSubscription?.allowedMealTypes.includes(meal.mealType); }).filter((item, index, all) => all.findIndex((entry) => entry.mealId === item.mealId) === index);
  const coveredItem = eligibleItems.find((item) => item.mealId === coveredMealId);
  const coveredBasePrice = coveredItem?.basePrice || 0;
  const promo = usePromoQuote(promoCode, subtotal - coveredBasePrice, promoRetry);
  const discount = promo.valid ? promo.discount : 0;
  const deliveryFee = selectedSubscription && coveredItem ? 0 : calculateDeliveryFee(subtotal, settings.freeDeliveryThreshold);
  const estimate = { items: savedCartBreakdown(items), subtotal, coveredBasePrice, discount, deliveryFee, total: Math.max(0, subtotal - coveredBasePrice - discount + deliveryFee), promoCode };
  const availability = getAvailability(mealPeriod, serviceDate);
  const selectedAddress = savedAddresses.find((address, index) => addressKey(address, index) === selectedAddressId);
  const inputPayload = {
    items: items.map((item) => ({ mealId: item.mealId, quantity: item.quantity, selectedChoices: item.selectedChoices, selectedAddOns: item.selectedAddOns })),
    contact: { name: form.fullName.trim(), phone: form.mobile.replace(/\D/g, ""), email: form.email.trim() },
    deliveryAddress: { ...Object.fromEntries(addressFields.map((field) => [field, form[field].trim()])), ...(form.location ? { location: form.location } : {}) },
    mealPeriod, serviceDate, deliverySlot, notes: form.notes.trim(), promoCode, subscriptionId, coveredMealId, paymentMethod, paymentChannel: paymentMethod === "manual_online" ? paymentChannel : null,
  };
  const inputSignature = JSON.stringify(inputPayload);
  const quoteCurrent = quoteState?.signature === inputSignature;
  const quote = quoteCurrent ? quoteState.quote : null;
  const changes = quoteCurrent ? quoteState.changes : [];
  const needsAcknowledgement = Boolean(quote && (changes.length || quote.requiresAcknowledgement));
  const busy = submitting || quoting;
  useEffect(() => {
    const controller = new AbortController();
    requestScope.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/payment-settings", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("Payment options are unavailable."); return response.json(); }).then((data) => {
      if (controller.signal.aborted) return;
      setPaymentSettings(data.payment); setPaymentSettingsError("");
      setPaymentMethod((current) => current || (data.payment.onlinePaymentEnabled ? "manual_online" : data.payment.codEnabled ? "COD" : ""));
      setPaymentChannel((current) => current || availableChannels(data.payment)[0] || "");
    }).catch((error) => { if (!controller.signal.aborted) setPaymentSettingsError(error.message); });
    return () => controller.abort();
  }, [paymentRetry]);
  useEffect(() => {
    const controller = new AbortController();
    let persisted = null;
    try { persisted = readCheckoutAttempt(window.sessionStorage, user.id); } catch { /* Keep the in-memory recovery when tab storage is blocked. */ }
    const saved = checkoutDraftRef.current?.userId === user.id ? checkoutDraftRef.current : persisted;
    if (checkoutDraftRef.current && !saved) checkoutDraftRef.current = null;
    function restoreSaved() {
      if (saved) { setDeliverySlot(saved.deliverySlot); setPaymentMethod(saved.paymentMethod); setPaymentChannel(saved.paymentChannel); setSubscriptionId(saved.subscriptionId); setCoveredMealId(saved.coveredMealId); setPromoCode(saved.promoCode || ""); setQuoteState(saved.quoteState || null); setReviewedRevision(saved.reviewedRevision || ""); checkoutKey.current = saved.checkoutKey; checkoutSignature.current = saved.signature; attempt.current = saved.attempt; setUnknownOutcome(Boolean(saved.attempt)); }
    }
    fetch("/api/profile", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (response.status === 401 && !controller.signal.aborted) {
        router.replace("/welcome?mode=signin&returnTo=/checkout");
        return null;
      }
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => {
      if (!data || controller.signal.aborted) return;
      const profile = data.user;
      const addresses = profile?.addresses || []; const first = addresses[0];
      setSavedAddresses(addresses); setSelectedAddressId(saved ? "custom" : first ? addressKey(first, 0) : "custom");
      setForm(saved?.form || { ...initialForm, fullName: profile?.name || "", mobile: profile?.phone || "", email: profile?.email || "", ...(first ? addressValues(first) : {}) });
      restoreSaved();
      setEditingContact(!profile?.name || !profile?.phone); setEditingAddress(Boolean(saved) || !first); setProfileLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) { setForm(saved?.form || { ...initialForm, fullName: user.name || "", mobile: user.phone || "", email: user.email || "" }); restoreSaved(); setEditingContact(true); setEditingAddress(true); setProfileLoaded(true); } });
    fetch("/api/subscriptions", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }).then((data) => { if (!controller.signal.aborted) { setSubscriptions(data.subscriptions || []); setSubscriptionError(""); } }).catch(() => { if (!controller.signal.aborted) setSubscriptionError("Existing plan credits could not be loaded. Retry checkout before using a credit."); });
    return () => controller.abort();
  }, [user.id, user.name, user.phone, user.email, checkoutDraftRef, setPromoCode, router]);
  useEffect(() => {
    if (addressQuery.trim().length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => fetch("/api/delivery/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: addressQuery }), signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => { if (!controller.signal.aborted) setSuggestions(data?.suggestions || []); }).catch(() => {}), 400);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [addressQuery]);

  function invalidateAddress() { addressVersion.current += 1; setDeliveryResult(null); setCheckingAddress(false); }
  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value, ...(["street", "area", "city", "pinCode"].includes(name) ? { location: null } : {}) }));
    setErrors((current) => ({ ...current, [name]: "" }));
    if (addressFields.includes(name)) { invalidateAddress(); setSelectedAddressId("custom"); }
  }
  function selectAddress(event) {
    const id = event.target.value; const address = savedAddresses.find((item, index) => addressKey(item, index) === id);
    invalidateAddress(); setSelectedAddressId(id); setAddressQuery(""); setSuggestions([]); setForm((current) => ({ ...current, ...addressValues(address || initialForm) })); setEditingAddress(!address);
  }
  function saveDraft(pendingAttempt = null) {
    const draft = { userId: user.id, form, deliverySlot, paymentMethod, paymentChannel, subscriptionId, coveredMealId, promoCode, quoteState, reviewedRevision, checkoutKey: checkoutKey.current, signature: inputSignature, attempt: pendingAttempt };
    checkoutDraftRef.current = draft;
    try { if (!writeCheckoutAttempt(window.sessionStorage, draft) && pendingAttempt) setRecoveryWarning("Tab storage is unavailable. Keep this page open until the order result is resolved."); }
    catch { if (pendingAttempt) setRecoveryWarning("Tab storage is unavailable. Keep this page open until the order result is resolved."); }
  }
  function validate() {
    const next = {};
    if (form.fullName.trim().length < 2 || form.fullName.length > 80) next.fullName = "Enter your full name (2–80 characters).";
    if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, ""))) next.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address.";
    for (const field of ["house", "street", "area", "city"]) if (!form[field].trim() || form[field].length > 120) next[field] = "Enter this address detail (up to 120 characters).";
    if (!/^\d{6}$/.test(form.pinCode)) next.pinCode = "Enter a valid 6-digit PIN code.";
    if (!deliverySlot || slotExpired(serviceDate, mealPeriod, deliverySlot, new Date(now))) next.deliverySlot = "Choose an available delivery slot.";
    if (!paymentMethod) next.paymentMethod = "Choose a payment method.";
    if (paymentMethod === "manual_online" && !availableChannels(paymentSettings).includes(paymentChannel)) next.paymentChannel = "Choose an available online payment option.";
    if (subscriptionId && (!selectedSubscription || !coveredItem)) next.coveredMealId = "Review the plan and choose an eligible Thali.";
    setErrors(next);
    if (["fullName", "mobile", "email"].some((field) => next[field])) setEditingContact(true);
    if (addressFields.some((field) => next[field])) setEditingAddress(true);
    const first = Object.keys(next)[0];
    if (first) revealValidationTarget(`checkout-${first}-error`, `checkout-${first}`);
    return !first;
  }
  async function fetchQuote(payload, previous = quoteState?.quote) {
    const signal = requestScope.current?.signal;
    if (!signal || signal.aborted) return;
    setQuoting(true); setReviewedRevision("");
    try {
      const response = await fetch("/api/orders/quote", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, previousRevision: previous?.pricingRevision }) });
      const data = await response.json();
      if (signal.aborted) return;
      if (response.status === 401) { saveDraft(); router.push("/welcome?mode=signin&returnTo=/checkout"); return; }
      if (!response.ok) throw new Error(data.message);
      const old = quoteCurrent && previous ? previous : estimate;
      setQuoteState({ signature: inputSignature, quote: data.quote, previous: old, changes: priceBreakdownChanges(old, data.quote) });
      setSubmitError(""); revealValidationTarget("checkout-price-review");
    } catch (error) { if (!signal.aborted) { setSubmitError(error.message || "Unable to validate this order."); revealValidationTarget("checkout-submit-error"); } }
    finally { if (!signal.aborted) setQuoting(false); }
  }
  async function placeOrder(payload) {
    const signal = requestScope.current?.signal;
    if (!signal || signal.aborted) return;
    setSubmitting(true); attempt.current = payload; saveDraft(payload);
    let receivedResponse = false;
    try {
      const response = await fetch("/api/orders", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (signal.aborted) return;
      receivedResponse = true;
      // A 401 on this retry does not prove that an earlier request failed to commit.
      if (response.status === 401) { setUnknownOutcome(true); saveDraft(payload); router.push("/welcome?mode=signin&returnTo=/checkout"); return; }
      if (!response.ok) {
        setUnknownOutcome(response.status >= 500);
        if (response.status < 500) saveDraft();
        if (data.code === "PRICE_REVIEW_REQUIRED") { await fetchQuote(payload, { ...quote, ...(data.previousQuote || {}), pricingRevision: payload.pricingRevision }); return; }
        throw new Error(data.message || "Unable to place this order.");
      }
      setUnknownOutcome(false); completeCheckout(payload); router.push(payload.paymentMethod === "manual_online" ? `/orders/${data.order.orderNumber}/payment` : `/orders/${data.order.orderNumber}`);
    } catch (error) { if (!signal.aborted) { if (!receivedResponse) setUnknownOutcome(true); setSubmitError(!receivedResponse ? "We couldn’t read the order response. Retry the same request to check its result safely." : error.message || "Unable to place this order. Please retry."); revealValidationTarget("checkout-submit-error"); } }
    finally { if (!signal.aborted) setSubmitting(false); }
  }
  async function handleSubmit(event) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (unknownOutcome && attempt.current) { await placeOrder(attempt.current); return; }
      setSubmitError(""); if (!validate()) return;
      if (review.blocked || !availability.available) { setSubmitError(review.error || availability.reason || "Review your meals in the cart before continuing."); revealValidationTarget("checkout-submit-error"); return; }
      if (promoCode && !promo.valid) { revealValidationTarget("checkout-promo-code-message", "checkout-promo-code"); return; }
      if (checkoutSignature.current !== inputSignature) { checkoutKey.current = crypto.randomUUID(); checkoutSignature.current = inputSignature; }
      const payload = { ...inputPayload, checkoutKey: checkoutKey.current };
      if (!quote || quote.expiresAt <= Date.now()) { await fetchQuote(payload); return; }
      if (needsAcknowledgement && reviewedRevision !== quote.pricingRevision) { revealValidationTarget("checkout-price-review", "checkout-price-ack"); return; }
      await placeOrder({ ...payload, pricingRevision: quote.pricingRevision, reviewedRevision: quote.pricingRevision });
    } finally { inFlight.current = false; }
  }
  async function checkAddress() {
    const signal = requestScope.current?.signal;
    if (!signal || signal.aborted) return;
    const version = ++addressVersion.current;
    setCheckingAddress(true); setDeliveryResult(null);
    try {
      const response = await fetch("/api/delivery/check", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: inputPayload.deliveryAddress }) });
      const data = await response.json();
      if (!signal.aborted && version === addressVersion.current) setDeliveryResult(response.ok ? data : { serviceable: false, reason: data.reason || data.message || "Address checking is unavailable. Try again." });
    } catch { if (!signal.aborted && version === addressVersion.current) setDeliveryResult({ serviceable: false, reason: "Unable to verify this address. Please retry." }); }
    finally { if (!signal.aborted && version === addressVersion.current) setCheckingAddress(false); }
  }
  if (!profileLoaded) return <LoadingState label="Loading your checkout details" rows={2} />;
  if (!items.length && !unknownOutcome) return <EmptyCart />;
  if (!items.length) return <section className="container-shell cart-page"><form className="card-surface p-5 space-y-3" onSubmit={handleSubmit}>
    <h2 className="type-section-title">Check your previous order</h2>
    <p>The result is uncertain. Retry the same request to recover it, or check <Link className="underline" href="/orders">your orders</Link>.</p>
    {submitError && <p id="checkout-submit-error" role="alert" tabIndex={-1}>{submitError}</p>}
    <Button type="submit" loading={submitting} loadingText="Checking order…">Retry same request</Button>
  </form></section>;
  const locked = busy || unknownOutcome;
  const slotInvalid = deliverySlot && slotExpired(serviceDate, mealPeriod, deliverySlot, new Date(now));
  return <form onSubmit={handleSubmit} noValidate className="customer-checkout container-shell checkout-grid cart-page">
    <fieldset disabled={locked} className="checkout-fields"><legend className="sr-only">Delivery and payment details</legend>
      <CheckoutSection icon={MapPin} number="1" title="Delivery address">
        {profileState.status === "error" && <p className="checkout-notice">Saved details could not be loaded. Enter your details for this order.</p>}
        {!editingContact ? <div className="checkout-detail-summary"><div><strong>{form.fullName}</strong><p>{form.mobile}</p>{form.email && <p>{form.email}</p>}</div><button type="button" className="checkout-text-action" onClick={() => setEditingContact(true)}>Edit contact</button></div> : <div className="checkout-form-grid"><Field label="Full name" name="fullName" value={form.fullName} onChange={updateField} error={errors.fullName} autoComplete="name" maxLength={80} /><Field label="Mobile number" name="mobile" type="tel" value={form.mobile} onChange={updateField} error={errors.mobile} autoComplete="tel" inputMode="numeric" maxLength={10} /><Field label="Email" optional name="email" type="email" value={form.email} onChange={updateField} error={errors.email} autoComplete="email" /></div>}
        {savedAddresses.length > 0 && <label className="checkout-field-label">Deliver to<CustomSelect value={selectedAddressId} onChange={selectAddress} className="input-field mt-2"><option value="custom">Use another address</option>{savedAddresses.map((address, index) => <option key={addressKey(address, index)} value={addressKey(address, index)}>{address.label || `Address ${index + 1}`} · {address.area}</option>)}</CustomSelect></label>}
        {!editingAddress && selectedAddress ? <div className="checkout-detail-summary"><div><strong>{selectedAddress.label || "Saved address"}</strong><p>{[form.house, form.street, form.area, form.city, form.pinCode].filter(Boolean).join(", ")}</p>{form.landmark && <p>{form.landmark}</p>}</div><button type="button" className="checkout-text-action" onClick={() => setEditingAddress(true)}>Edit address</button></div> : <>
          <LocationPicker compactTrigger location={form.location} onSelect={(choice) => { invalidateAddress(); setForm((current) => ({ ...current, ...choice.address, location: choice.location })); setSelectedAddressId("custom"); setDeliveryResult(choice.result); setAddressQuery(""); setSuggestions([]); }} />
          <label className="checkout-field-label">Search address<input type="search" value={addressQuery} onChange={(event) => { setAddressQuery(event.target.value); setSuggestions([]); }} className="input-field mt-2" placeholder="Street, area or PIN" autoComplete="off" /></label>
          {suggestions.length > 0 && <div className="checkout-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { invalidateAddress(); setAddressQuery(""); setSuggestions([]); setForm((current) => ({ ...current, street: suggestion, location: null })); }}>{suggestion}</button>)}</div>}
          <div className="checkout-form-grid">{[["house", "House / flat", "address-line1"], ["street", "Building / street", "address-line2"], ["area", "Area", "address-level3"], ["landmark", "Landmark", "off"], ["city", "City", "address-level2"], ["pinCode", "PIN code", "postal-code"]].map(([name, label, autoComplete]) => <Field key={name} label={label} name={name} value={form[name]} onChange={updateField} error={errors[name]} autoComplete={autoComplete} optional={name === "landmark"} maxLength={name === "pinCode" ? 6 : 120} inputMode={name === "pinCode" ? "numeric" : undefined} />)}</div>
        </>}
        <Button type="button" variant="outline" className="mt-3" onClick={checkAddress} loading={checkingAddress} loadingText="Checking delivery…">Check delivery</Button>
        {deliveryResult && <p role="status" className={`checkout-notice ${deliveryResult.serviceable ? "" : "checkout-notice--error"}`}>{deliveryResult.reason}</p>}
      </CheckoutSection>
      <CheckoutSection icon={Clock3} number="2" title="Meal & delivery slot">
        <div className="cart-delivery-summary"><span>One delivery</span><strong>{mealPeriod} · {serviceDate}</strong></div>
        {!availability.available && <p className="checkout-notice" role="status">{availability.reason}</p>}
        <fieldset id="checkout-deliverySlot" tabIndex={-1} aria-describedby="checkout-deliverySlot-error" className="mt-3"><legend className="checkout-field-label">Choose a delivery window</legend><div className="checkout-slot-grid">{deliverySlots[mealPeriod].map((slot) => { const unavailable = !availability.available || slotExpired(serviceDate, mealPeriod, slot, new Date(now)); return <label key={slot} className={`checkout-choice ${deliverySlot === slot ? "is-selected" : ""} ${unavailable ? "is-disabled" : ""}`}><input type="radio" name="deliverySlot" value={slot} checked={deliverySlot === slot} disabled={unavailable} onChange={() => { setDeliverySlot(slot); setErrors((current) => ({ ...current, deliverySlot: "" })); }} /><span>{slot}{unavailable && <small>Unavailable</small>}</span>{deliverySlot === slot && <Check size={16} aria-hidden="true" />}</label>; })}</div><p id="checkout-deliverySlot-error" className="checkout-field-error">{errors.deliverySlot || (slotInvalid ? "Your selected window has started. Choose another slot." : "")}</p></fieldset>
        {subscriptionError && <p role="status" className="checkout-notice">{subscriptionError}</p>}
        {(availableSubscriptions.length > 0 || subscriptionId) && <div className="checkout-credit"><h3>Use an existing plan credit</h3><label className="checkout-field-label">Subscription<CustomSelect value={subscriptionId} onChange={(event) => { setSubscriptionId(event.target.value); setCoveredMealId(""); }} className="input-field mt-2"><option value="">Pay without a plan credit</option>{availableSubscriptions.map((item) => <option key={item._id} value={item._id}>{item.planName} · {item.remainingMeals} left</option>)}</CustomSelect></label>{subscriptionId && <label className="checkout-field-label">Cover one Thali base<CustomSelect id="checkout-coveredMealId" value={coveredMealId} onChange={(event) => setCoveredMealId(event.target.value)} className="input-field mt-2" aria-describedby="checkout-coveredMealId-error"><option value="">Choose a Thali</option>{eligibleItems.map((item) => <option key={item.mealId} value={item.mealId}>{item.name}</option>)}</CustomSelect><span id="checkout-coveredMealId-error" className="checkout-field-error">{errors.coveredMealId || (!selectedSubscription ? "This credit is no longer eligible. Choose another plan or pay without a credit." : "")}</span></label>}<p className="checkout-support">One eligible base Thali and delivery are covered. Choices and extras remain payable. Plan purchases remain unavailable.</p></div>}
      </CheckoutSection>
      <CheckoutSection icon={CreditCard} number="3" title="Payment method">
        {paymentSettingsError && <p role="alert" className="checkout-notice checkout-notice--error">{paymentSettingsError} <button type="button" onClick={() => setPaymentRetry((value) => value + 1)} className="checkout-text-action">Retry</button></p>}
        {!paymentSettings && !paymentSettingsError && <p role="status">Loading payment options…</p>}
        {paymentSettings && <fieldset id="checkout-paymentMethod" tabIndex={-1} aria-describedby="checkout-paymentMethod-error"><legend className="sr-only">Payment method</legend><div className="checkout-payment-grid">{paymentSettings.onlinePaymentEnabled && <label className={`checkout-choice ${paymentMethod === "manual_online" ? "is-selected" : ""}`}><input type="radio" name="paymentMethod" checked={paymentMethod === "manual_online"} onChange={() => setPaymentMethod("manual_online")} /><span>Online payment<small>UPI · manually verified</small></span></label>}{paymentSettings.codEnabled && <label className={`checkout-choice ${paymentMethod === "COD" ? "is-selected" : ""}`}><input type="radio" name="paymentMethod" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} /><span>Cash on Delivery<small>Pay when your meal arrives</small></span></label>}</div><p id="checkout-paymentMethod-error" className="checkout-field-error">{errors.paymentMethod || (!paymentSettings.codEnabled && !paymentSettings.onlinePaymentEnabled ? "Payment options are temporarily unavailable." : "")}</p></fieldset>}
        {paymentSettings && paymentMethod === "manual_online" && <fieldset id="checkout-paymentChannel" tabIndex={-1} className="mt-3"><legend className="checkout-field-label">How would you like to pay?</legend><div className="checkout-slot-grid">{availableChannels(paymentSettings).map((channel) => <label key={channel} className={`checkout-choice ${paymentChannel === channel ? "is-selected" : ""}`}><input type="radio" name="paymentChannel" checked={paymentChannel === channel} onChange={() => setPaymentChannel(channel)} /><span>{channelLabels[channel]}</span></label>)}</div><p id="checkout-paymentChannel-error" className="checkout-field-error">{errors.paymentChannel}</p><p className="checkout-support">Payment instructions and your order reference appear after order creation. Submit proof there; your order is confirmed only after manual verification.</p></fieldset>}
      </CheckoutSection>
    </fieldset>
    <aside className="checkout-summary card-surface"><h2><span className="checkout-step">4</span> Review & confirm</h2><Link href="/cart" onClick={() => saveDraft(unknownOutcome ? attempt.current : null)} className="checkout-text-action">Edit cart</Link>
      {storageError || cartNotice ? <p role="status" className="checkout-notice">{storageError || cartNotice}</p> : null}
      {review.error && <p role="alert" className="checkout-notice checkout-notice--error">{review.error} <button type="button" onClick={review.retry} className="checkout-text-action">Retry</button></p>}
      <div className="checkout-review-items">{items.map((item) => <CartItemSummary key={item.key} item={item} review={review.reviews.find((entry) => entry.key === item.key)} />)}</div>
      <div className="checkout-final-details"><p><strong>{mealPeriod} · {serviceDate}</strong>{deliverySlot ? ` · ${deliverySlot}` : " · Choose a slot"}</p><p>{form.fullName} · {form.mobile}</p><p>{[form.house, form.street, form.area, form.city, form.pinCode].filter(Boolean).join(", ")}</p>{form.landmark && <p>{form.landmark}</p>}<p>{paymentMethod === "manual_online" ? `Online payment · ${channelLabels[paymentChannel] || "Choose channel"}` : paymentMethod === "COD" ? "Cash on Delivery" : "Choose payment"}</p></div>
      <fieldset disabled={locked}><legend className="sr-only">Promo and order notes</legend><PromoCodeControl id="checkout-promo-code" code={promoCode} onApply={(code) => { setPromoCode(code); setPromoRetry((value) => value + 1); }} onRemove={() => setPromoCode("")} promo={promo} disabled={locked} /><details className="checkout-notes"><summary>Add order notes (optional)</summary><label className="checkout-field-label">Cooking or delivery instructions<textarea name="notes" value={form.notes} onChange={updateField} className="input-field mt-2" maxLength={300} /></label><p className="checkout-support">Special requests are subject to availability.</p></details></fieldset>
      <div id="checkout-price-review" tabIndex={-1}>
        {quote && needsAcknowledgement && <div className="checkout-price-change"><h3>Review your updated price</h3><ul>{changes.length ? changes.map((change) => <li key={change}>{change}</li>) : <li>A fresh price review is required before continuing.</li>}</ul><details open><summary>Previous breakdown</summary><OrderSummary quote={quoteState.previous} /></details><p className="checkout-field-label">Updated breakdown</p></div>}
        <OrderSummary quote={quote || estimate} label={quote ? "Order total" : "Estimated total"} />
        {quote && needsAcknowledgement && <label className="checkout-price-ack"><input id="checkout-price-ack" type="checkbox" checked={reviewedRevision === quote.pricingRevision} disabled={locked} onChange={(event) => setReviewedRevision(event.target.checked ? quote.pricingRevision : "")} />I’ve reviewed and accept the updated price.</label>}
        {quote && !needsAcknowledgement && <p className="checkout-support" role="status">{unknownOutcome ? "Original quoted amount. Retry checks the result of that same request." : "Price checked. Review your details, then place your order."}</p>}
      </div>
      {unknownOutcome && <p role="alert" className="checkout-notice">The order result is uncertain. Retry the same request to retrieve it safely, or check <Link href="/orders" className="checkout-text-action">your orders</Link>. Your checkout inputs are preserved. Meals or quantities added afterward will remain in your cart.</p>}
      {recoveryWarning && <p role="status" className="checkout-notice">{recoveryWarning}</p>}
      {submitError && <p id="checkout-submit-error" tabIndex={-1} role="alert" className="checkout-notice checkout-notice--error">{submitError}</p>}
      <CheckoutActionBar type="submit" totalLabel={unknownOutcome ? "Original total" : "Total"} total={unknownOutcome ? quoteState?.quote.total : quote?.total ?? estimate.total} label={unknownOutcome ? "Retry same request" : !quote ? "Review order total" : paymentMethod === "manual_online" ? "Place order & pay" : "Place COD order"} loading={busy} loadingText={quoting ? "Validating order…" : "Placing order…"} disabled={!unknownOutcome && (review.blocked || !availability.available || !paymentSettings || Boolean(promoCode && !promo.valid))}>{review.blocked ? "Review your cart selections before continuing." : !quote ? "Your final price is checked before order creation." : paymentMethod === "manual_online" ? "Payment remains pending until verified." : "Pay cash when your meal arrives."}</CheckoutActionBar>
    </aside>
  </form>;
}

function CheckoutSection({ icon: Icon, number, title, children }) { return <section className="checkout-section card-surface"><h2><span className="checkout-step">{number}</span><Icon size={18} aria-hidden="true" />{title}</h2>{children}</section>; }
function Field({ label, optional, error, ...props }) { const id = `checkout-${props.name}`; return <label htmlFor={id} className="checkout-field-label">{label}{optional && <span> (optional)</span>}<input id={id} className="input-field mt-2" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <span id={`${id}-error`} className="checkout-field-error">{error}</span>}</label>; }
