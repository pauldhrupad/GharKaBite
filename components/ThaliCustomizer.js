"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Button from "./Button";
import SaveFavorite from "./SaveFavorite";
import ThaliPreview from "./ThaliPreview";
import ThaliChoiceGroup from "./ThaliChoiceGroup";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { calculateThaliPrice, previewThaliPrice, missingChoiceMessage } from "@/lib/thali";
import { reviewThaliSelections, requiredChoiceProgress } from "@/lib/thali-builder";
import { revealValidationTarget } from "@/lib/validation-navigation";
import { validMealPeriod } from "@/lib/meal-period";
import { consumeFavoriteDraft } from "@/lib/favorite-draft";

export default function ThaliCustomizer({ meal, serviceDate, initialPeriod, editKey = "", initialSelection, onReviewSave, favoriteDraft = "" }) {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const { items, addItem, hydrated, storageError } = useCart();
  const { hydrated: kitchenHydrated, loadFailed, getAvailability } = useKitchen();
  const [period, setPeriod] = useState(validMealPeriod(initialPeriod, meal.slots) || meal.slots[0]);
  const [quantity, setQuantity] = useState(initialSelection?.quantity ?? 1);
  const [choices, setChoices] = useState(initialSelection?.selectedChoices || {});
  const [addOns, setAddOns] = useState(initialSelection?.selectedAddOns || {});
  const [error, setError] = useState("");
  const [choiceError, setChoiceError] = useState(null);
  const [added, setAdded] = useState(false);
  const [restored, setRestored] = useState(!editKey);
  const [previous, setPrevious] = useState(initialSelection || null);
  const [draftNotice, setDraftNotice] = useState("");
  const [periodIssue, setPeriodIssue] = useState("");
  const [reviewedPrice, setReviewedPrice] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [purchaseHeight, setPurchaseHeight] = useState(96);
  const [previewFits, setPreviewFits] = useState(false);
  const purchaseRef = useRef(null);
  const previewRef = useRef(null);
  const editing = editKey ? items.find((item) => item.key === editKey) : null;
  const ready = hydrated && restored && !(favoriteDraft && !editKey && authStatus !== "unauthenticated" && !draftNotice);
  const missingEdit = hydrated && Boolean(editKey) && !editing;
  const itemLabel = meal.kind === "dish" ? "dish" : "Thali";
  const availability = getAvailability(period, serviceDate);

  useEffect(() => {
    if (!favoriteDraft || editKey || authStatus !== "authenticated") return;
    const timer = window.setTimeout(() => {
      let source = null;
      try { source = consumeFavoriteDraft(window.sessionStorage, favoriteDraft, meal.id, serviceDate, initialPeriod); } catch { /* Storage may be unavailable. */ }
      if (source) {
        setChoices(source.selectedChoices); setAddOns(source.selectedAddOns); setQuantity(source.quantity); setPeriod(source.preferredPeriod); setPrevious(source);
      }
      setDraftNotice(source ? "Your Thali choices were restored. Select Save favorite when you’re ready." : "Your earlier selections couldn’t be restored. Review this Thali and choose your options again.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [favoriteDraft, editKey, authStatus, meal.id, serviceDate, initialPeriod]);

  useEffect(() => {
    if (!hydrated || !editKey) return;
    const timer = window.setTimeout(() => {
      const source = editing;
      if (source) {
        setChoices(source.selectedChoices || {});
        setAddOns(source.selectedAddOns || {});
        setQuantity(source.quantity ?? 1);
        setPrevious(source);
        const savedPeriod = source.deliveryMealPeriod || source.period;
        if (validMealPeriod(savedPeriod, meal.slots)) setPeriod(savedPeriod);
        else if (savedPeriod) setPeriodIssue(savedPeriod);
      }
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, editing, editKey, meal.slots]);

  useEffect(() => {
    const purchase = purchaseRef.current;
    const preview = previewRef.current;
    function measure() {
      if (purchase) setPurchaseHeight(purchase.getBoundingClientRect().height);
      if (preview) setPreviewFits(preview.getBoundingClientRect().height <= window.innerHeight - 112);
      const viewport = window.visualViewport;
      const typing = document.activeElement?.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"]');
      setKeyboardOpen(Boolean(typing && viewport && viewport.height < window.innerHeight * 0.75));
    }
    const observer = new ResizeObserver(measure);
    if (purchase) observer.observe(purchase);
    if (preview) observer.observe(preview);
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); document.removeEventListener("focusin", measure); document.removeEventListener("focusout", measure); };
  }, []);

  const { quote, pricingError } = useMemo(() => {
    try { return { quote: previewThaliPrice(meal, choices, addOns, quantity), pricingError: "" }; }
    catch (cause) { return { quote: null, pricingError: cause.message }; }
  }, [meal, choices, addOns, quantity]);
  const review = useMemo(() => reviewThaliSelections(meal, choices, addOns, previous || {}), [meal, choices, addOns, previous]);
  const requiredGroups = meal.choiceGroups.filter((group) => (group.minSelections ?? (group.required ? 1 : 0)) > 0);
  const incomplete = quote?.incompleteGroups || [];
  const { completed } = requiredChoiceProgress(meal, choices);
  const priceChanged = Boolean(!onReviewSave && quote && Number.isFinite(previous?.price) && previous.price !== quote.unitTotal);
  const priceNeedsReview = priceChanged && reviewedPrice !== quote.unitTotal;
  const blocked = !ready || missingEdit || (!onReviewSave && (!meal.available || !availability.available)) || !quote || Boolean(periodIssue);

  function changed() { setAdded(false); setError(""); setChoiceError(null); }
  function select(group, optionId) {
    changed();
    setChoices((current) => {
      const selected = Array.isArray(current[group.id]) ? current[group.id] : [];
      const next = (group.maxSelections ?? 1) === 1 && selected.length <= 1 ? [optionId] : selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
      return { ...current, [group.id]: next };
    });
  }
  function addToCart() {
    if (added) { router.push("/cart"); return; }
    if (blocked) return;
    if (incomplete.length) {
      const group = meal.choiceGroups.find((entry) => entry.id === incomplete[0]);
      setChoiceError({ id: group.id, message: missingChoiceMessage(group) });
      revealValidationTarget(`choice-error-${group.id}`, `choice-group-${group.id}`);
      return;
    }
    if (priceNeedsReview) { revealValidationTarget("thali-price-review"); return; }
    try {
      calculateThaliPrice(meal, choices, addOns, quantity);
      if (onReviewSave) { onReviewSave({ quantity, selectedChoices: choices, selectedAddOns: addOns }); return; }
      const result = addItem(meal, period, quantity, serviceDate, { selectedChoices: choices, selectedAddOns: addOns }, editKey || null);
      if (result.status === "added") { setAdded(true); if (editKey) router.push("/cart"); }
    } catch (cause) { setError(cause.message); revealValidationTarget("thali-customizer-error"); }
  }

  return <div className={`thali-builder${onReviewSave ? " repeat-line-builder" : ""}`} data-keyboard-open={keyboardOpen} style={{ "--builder-purchase-height": `${purchaseHeight}px` }}>
    <div ref={previewRef} className={`thali-preview-column ${previewFits ? "can-stick" : ""}`}><ThaliPreview meal={meal} choices={choices} addOns={addOns} quantity={quantity} /></div>
    <div className="thali-controls-column">
      {missingEdit && <p role="alert" className="thali-notice">This cart item is no longer present. <Link href="/cart">Return to your cart</Link>.</p>}
      {!ready && <p role="status" className="thali-notice">Restoring your meal…</p>}
      {draftNotice && <p role="status" className="thali-notice">{draftNotice}</p>}
      {previous && <p className="thali-restored-note">Your previous choices are restored. Review them before {editKey || onReviewSave ? "saving" : "adding this meal"}.</p>}
      {review.issues.length > 0 && <section className="thali-notice" aria-label="Selections needing review"><h2>Some selections have changed</h2><ul>{review.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul><button type="button" className="thali-text-action" onClick={() => { setChoices(review.cleanChoices); setAddOns(review.cleanAddOns); changed(); }}>Remove unavailable selections</button><p>Your other choices will be kept.</p></section>}
      {periodIssue && <div className="thali-notice">Your previous {periodIssue} period is no longer supported by this meal. <button type="button" className="thali-text-action" onClick={() => setPeriodIssue("")}>Use {period} instead</button></div>}
      <fieldset disabled={!ready || missingEdit} className="thali-controls"><legend className="sr-only">Customize {meal.name}</legend>
        {!onReviewSave && <fieldset className="thali-period"><legend>Delivery period <span>{serviceDate}</span></legend><div>{meal.slots.map((slot) => <label key={slot} className={period === slot ? "is-selected" : ""}><input type="radio" name="thaliPeriod" checked={period === slot} onChange={() => { setPeriod(slot); setPeriodIssue(""); changed(); }} />{slot}</label>)}</div></fieldset>}
        {!onReviewSave && !availability.available && <p className="thali-notice" role="status">{availability.reason}</p>}
        {!meal.available && <p className="thali-notice">{meal.choiceUnavailable ? "A required choice is unavailable. This meal cannot currently be ordered." : "This meal is currently unavailable for this date."}</p>}
        {requiredGroups.length > 0 && <div className="thali-progress"><span>{completed} of {requiredGroups.length} required groups complete</span><span aria-hidden="true">{completed === requiredGroups.length ? "Ready to review" : "Make it yours"}</span><progress value={completed} max={requiredGroups.length} aria-label="Required choices completed" /></div>}
        {meal.choiceGroups.map((group) => <ThaliChoiceGroup key={group.id} group={group} selected={Array.isArray(choices[group.id]) ? choices[group.id] : []} onSelect={select} onClear={(id) => { setChoices((current) => ({ ...current, [id]: [] })); changed(); }} error={choiceError?.id === group.id ? choiceError.message : ""} />)}
        {!meal.choiceGroups.length && <p className="thali-ready-note"><Check aria-hidden="true" />All included items are set. Add extras if you like.</p>}
        {meal.addOns.length > 0 && <section className="thali-extras"><div className="thali-section-heading"><h2>Add a little extra</h2><span>Optional · per {itemLabel}</span></div><div className="thali-extra-list">{meal.addOns.map((extra) => {
          const count = Number(addOns[extra.id]) || 0;
          return <div key={extra.id} className={`thali-extra ${count > 0 ? "is-selected" : ""}`}><div><h3>{extra.name} {count > 0 && <Check aria-hidden="true" />}</h3><p>+₹{extra.price} each{extra.active === false ? " · Unavailable" : ` · Up to ${extra.maxQuantity}`}</p>{extra.description && <p>{extra.description}</p>}{count > extra.maxQuantity && <p className="thali-quantity-error">Reduce to {extra.maxQuantity} or fewer.</p>}</div><div className="thali-stepper"><button type="button" disabled={count <= 0} aria-label={`Remove one ${extra.name}`} onClick={() => { setAddOns((current) => ({ ...current, [extra.id]: Math.max(0, count - 1) })); changed(); }}><Minus aria-hidden="true" /></button><output aria-live="off" aria-label={`${extra.name} quantity`}>{count}</output><button type="button" disabled={extra.active === false || count >= extra.maxQuantity} aria-label={`Add one ${extra.name}`} onClick={() => { setAddOns((current) => ({ ...current, [extra.id]: count + 1 })); changed(); }}><Plus aria-hidden="true" /></button></div></div>;
        })}</div></section>}
        <section className="thali-price-panel" aria-label="Meal quantity and price"><div className="thali-quantity-row"><div><h2>How many?</h2><p>Same choices in each {itemLabel}.</p></div><div className="thali-stepper"><button type="button" disabled={quantity <= 1} aria-label={`Decrease ${itemLabel} quantity`} onClick={() => { setQuantity(Math.max(1, Number(quantity) - 1)); changed(); }}><Minus aria-hidden="true" /></button><output aria-live="off" aria-label="Meal quantity">{quantity}</output><button type="button" disabled={quantity >= 10} aria-label={`Increase ${itemLabel} quantity`} onClick={() => { setQuantity(Math.min(10, Number(quantity) + 1)); changed(); }}><Plus aria-hidden="true" /></button></div></div>
          {quote ? <dl className="thali-price-breakdown"><div><dt>Base price</dt><dd>₹{quote.basePrice}</dd></div>{quote.choiceAdjustments > 0 && <div><dt>Choice upgrades</dt><dd>+₹{quote.choiceAdjustments}</dd></div>}{quote.addOnTotal > 0 && <div><dt>Extras per {itemLabel}</dt><dd>+₹{quote.addOnTotal}</dd></div>}<div><dt>₹{quote.unitTotal} × {quantity}</dt><dd>₹{quote.lineTotal}</dd></div><div className="thali-price-total"><dt>{incomplete.length ? "Selections so far" : "Your meal total"}</dt><dd>₹{quote.lineTotal}</dd></div></dl> : <p className="thali-inline-error">{pricingError} Review your selections; no confirmed total is available.</p>}
          {incomplete.length > 0 && <p className="thali-provisional">Provisional amount · Complete {incomplete.length} required {incomplete.length === 1 ? "group" : "groups"} to confirm your meal price.</p>}
          {priceChanged && <div id="thali-price-review" tabIndex={-1} className="thali-notice"><h3>Review your updated price</h3><p>Previously ₹{previous.price} each; now ₹{quote.unitTotal} each with the current menu and selections.</p><label className="thali-price-consent"><input type="checkbox" checked={!priceNeedsReview} onChange={(event) => setReviewedPrice(event.target.checked ? quote.unitTotal : null)} />I’ve reviewed the updated price.</label></div>}
        </section>
      </fieldset>
      {!editKey && !onReviewSave && meal.kind !== "dish" && <SaveFavorite meal={meal} date={serviceDate} selection={{ mealId: meal.id, preferredPeriod: period, quantity, selectedChoices: choices, selectedAddOns: addOns }} disabled={!ready || !quote || Boolean(incomplete.length) || Boolean(periodIssue)} />}
      {error && <p id="thali-customizer-error" tabIndex={-1} role="alert" className="thali-inline-error">{error}</p>}
      {storageError && <p role="alert" className="thali-notice">{storageError}</p>}
      <div ref={purchaseRef} className={onReviewSave ? "repeat-line-action" : "thali-purchase-bar"} aria-label={onReviewSave ? "Save your review changes" : "Add your customized meal"}><div className="thali-purchase-total"><span>{quote ? incomplete.length ? "Selections so far" : `${quantity} ${itemLabel}${quantity > 1 ? "s" : ""}` : "Review selections"}</span><strong>{quote ? `₹${quote.lineTotal}` : "Price unavailable"}</strong></div><Button type="button" onClick={addToCart} disabled={blocked} className="thali-purchase-action">{added ? <Check aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}{!ready ? "Please wait…" : onReviewSave ? "Save to review" : !kitchenHydrated ? "Checking kitchen…" : loadFailed ? "Unavailable" : !meal.available ? "Unavailable" : !availability.available ? "Ordering closed" : added ? "Added to cart" : editKey ? "Save changes" : "Add to Cart"}</Button>{added && <Link href="/cart" className="thali-view-cart">View cart</Link>}</div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{added ? `${meal.name} added to cart.` : quote ? `${incomplete.length ? "Provisional" : "Current"} total ₹${quote.lineTotal} for ${quantity}.` : "Price unavailable. Review your selections."}</span>
    </div>
  </div>;
}
