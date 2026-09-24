"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { calculateThaliPrice, missingChoiceMessage } from "@/lib/thali";

export default function ThaliCustomizer({ meal, serviceDate, editKey = "", restore = false }) {
  const router = useRouter();
  const { items, addItem, hydrated } = useCart();
  const { hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const [period, setPeriod] = useState(meal.slots[0]);
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState({});
  const [addOns, setAddOns] = useState({});
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const editing = editKey ? items.find((item) => item.key === editKey) : null;
  const unavailable = !meal.available;
  const itemLabel = meal.kind === "dish" ? "dish" : "Thali";
  const availability = kitchenHydrated ? getAvailability(period, serviceDate) : { available: true, reason: "" };

  useEffect(() => {
    if (!hydrated || !editing) return;
    const timer = window.setTimeout(() => { setPeriod(editing.deliveryMealPeriod); setQuantity(editing.quantity); setChoices(editing.selectedChoices || {}); setAddOns(editing.selectedAddOns || {}); }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, editing]);
  useEffect(() => {
    if (!restore) return;
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.sessionStorage.getItem("gharkabite-restore-thali") || "null");
        if (stored?.mealId === meal.id) { setChoices(stored.selectedChoices || {}); setAddOns(stored.selectedAddOns || {}); setQuantity(stored.quantity || 1); if (meal.slots.includes(stored.period)) setPeriod(stored.period); setError("Some previous selections are no longer available. Please review this item."); }
        window.sessionStorage.removeItem("gharkabite-restore-thali");
      } catch { /* Keep a blank, editable customizer. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [restore, meal.id, meal.slots]);

  let quote;
  try { quote = calculateThaliPrice(meal, choices, addOns, quantity); } catch { quote = null; }
  const previewChoices = meal.choiceGroups.reduce((sum, group) => sum + (choices[group.id] || []).reduce((price, id) => price + (group.options.find((option) => option.id === id)?.priceAdjustment || 0), 0), 0);
  const previewAddOns = meal.addOns.reduce((sum, addOn) => sum + addOn.price * (addOns[addOn.id] || 0), 0);
  const unitTotal = quote?.unitTotal ?? meal.price + previewChoices + previewAddOns;

  function select(group, optionId) {
    setAdded(false);
    setChoices((current) => {
      const selected = current[group.id] || [];
      const next = group.maxSelections === 1 ? selected.includes(optionId) && group.minSelections === 0 ? [] : [optionId] : selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId];
      return { ...current, [group.id]: next };
    });
    setError("");
  }

  function addToCart() {
    if (unavailable || !availability.available) return;
    const missing = meal.choiceGroups.find((group) => (choices[group.id] || []).length < group.minSelections);
    if (missing) { setError(missingChoiceMessage(missing)); document.getElementById(`choice-group-${missing.id}`)?.focus(); return; }
    try {
      calculateThaliPrice(meal, choices, addOns, quantity);
      const result = addItem(meal, period, quantity, serviceDate, { selectedChoices: choices, selectedAddOns: addOns }, editKey || null);
      if (result.status === "added") { setAdded(true); if (editKey) router.push("/cart"); }
    } catch (cause) { setError(cause.message); }
  }

  return <div className="mt-4 space-y-4 border-t border-border pt-4 md:mt-5 md:pt-5">
    <fieldset><legend className="text-sm font-black">Delivery period</legend><div className={`mt-3 grid w-full rounded-xl border border-border bg-surface-alt p-1 sm:inline-grid sm:w-auto ${meal.slots.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>{meal.slots.map((slot) => <label key={slot} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 py-2.5 text-sm font-extrabold transition-colors focus-within:outline-2 focus-within:outline-primary active:scale-[0.99] ${period === slot ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:bg-surface hover:text-primary"}`}><input type="radio" name="thaliPeriod" checked={period === slot} onChange={() => setPeriod(slot)} className="sr-only" />{slot}</label>)}</div></fieldset>
    {!availability.available && <p className="rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger">{availability.reason}</p>}
    {meal.choiceGroups.map((group) => {
      const selected = choices[group.id] || [];
      const single = group.maxSelections === 1;
      return <fieldset key={group.id} id={`choice-group-${group.id}`} tabIndex={-1} className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(30,40,34,0.05)] focus:outline-2 focus:outline-primary sm:p-5"><legend className="px-1 text-lg font-black">{group.name}</legend><p className={`text-xs font-bold ${group.minSelections ? "text-accent" : "text-text-secondary"}`}>{group.minSelections ? "Required" : "Optional"} · {single ? "Choose one" : `Choose ${group.minSelections}–${group.maxSelections}`}</p>{group.description && <p className="mt-1 text-sm text-text-secondary">{group.description}</p>}<div className="mt-4 space-y-2">{group.options.map((option, optionIndex) => {
        const checked = selected.includes(option.id);
        const unavailable = option.active === false;
        const atLimit = !single && selected.length >= group.maxSelections && !checked;
        return <div key={option.id}>{single && optionIndex > 0 && <p className="py-1 text-center text-xs font-black uppercase tracking-widest text-text-secondary">or</p>}<label className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border bg-surface p-3 transition focus-within:outline-2 focus-within:outline-primary ${checked ? "border-2 border-primary bg-primary/8" : "border-border"} ${unavailable && !checked || atLimit ? "cursor-not-allowed opacity-50" : "hover:border-primary"}`}><span className="flex items-center gap-3"><input type={single ? "radio" : "checkbox"} name={`choice-${group.id}`} checked={checked} disabled={unavailable && !checked || atLimit} onChange={() => select(group, option.id)} className="accent-primary" /><span><span className="block text-sm font-black">{option.name}</span>{option.description && <span className="block text-xs text-text-secondary">{option.description}</span>}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-bold">{checked && <Check className="size-4 text-primary" aria-hidden="true" />}{unavailable ? "Unavailable" : atLimit ? "Limit reached" : option.priceAdjustment ? `+₹${option.priceAdjustment}` : "Included"}</span></label></div>;
      })}</div>{single && group.minSelections === 0 && selected.length > 0 && <button type="button" onClick={() => { setChoices((current) => ({ ...current, [group.id]: [] })); setError(""); setAdded(false); }} className="mt-3 text-sm font-bold text-primary underline underline-offset-2">Clear this choice</button>}</fieldset>;
    })}
    {meal.addOns.length > 0 && <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5"><h2 className="text-lg font-black">Add extras</h2><p className="mt-1 text-sm text-text-secondary">Optional, priced per {itemLabel}.</p><div className="mt-4 space-y-3">{meal.addOns.map((addOn) => {
      const max = addOn.maxQuantity;
      const count = addOns[addOn.id] || 0;
      return <div key={addOn.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-black">{addOn.name} <span className="text-primary">+₹{addOn.price}</span></p>{addOn.description && <p className="text-xs text-text-secondary">{addOn.description}</p>}{(addOn.active === false || max === 0) && <p className="text-xs font-bold text-danger">Unavailable</p>}</div><div className="flex items-center rounded-lg border border-border"><button type="button" disabled={!count} onClick={() => { setAddOns((current) => ({ ...current, [addOn.id]: count - 1 })); setError(""); setAdded(false); }} aria-label={`Remove one ${addOn.name}`} className="grid size-11 place-items-center disabled:opacity-35"><Minus className="size-4" /></button><span className="min-w-7 text-center text-sm font-black" aria-live="polite">{count}</span><button type="button" disabled={addOn.active === false || count >= max} onClick={() => { setAddOns((current) => ({ ...current, [addOn.id]: count + 1 })); setError(""); setAdded(false); }} aria-label={`Add one ${addOn.name}`} className="grid size-11 place-items-center disabled:opacity-35"><Plus className="size-4" /></button></div></div>;
    })}</div></section>}
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label={`Your ${itemLabel} summary`}><h2 className="font-black">Your {meal.name}</h2>{meal.kind !== "dish" && <p className="mt-2 text-sm text-text-secondary">Included: {meal.fixedItems.map((item) => item.name).join(", ")}</p>}{meal.choiceGroups.map((group) => <p key={group.id} className="mt-1 text-sm"><span className="font-bold">{group.name}:</span> {(choices[group.id] || []).map((id) => group.options.find((option) => option.id === id)?.name).filter(Boolean).join(", ") || "Not selected"}</p>)}{Object.entries(addOns).filter(([, count]) => count > 0).map(([id, count]) => <p key={id} className="mt-1 text-sm">{meal.addOns.find((item) => item.id === id)?.name} ×{count}</p>)}<div className="mt-3 space-y-1 border-t border-border pt-3 text-sm"><p>Base ₹{meal.price}</p>{previewChoices > 0 && <p>Choice upgrades +₹{previewChoices}</p>}{previewAddOns > 0 && <p>Extras +₹{previewAddOns}</p>}<p className="text-lg font-black text-accent">₹{unitTotal} per {itemLabel}</p></div></section>
    <div className="flex items-center justify-between gap-4"><p className="text-sm font-bold">{itemLabel} quantity</p><div className="flex items-center rounded-xl border border-border bg-surface"><button type="button" disabled={quantity <= 1} onClick={() => { setQuantity(Math.max(1, quantity - 1)); setAdded(false); }} aria-label={`Decrease ${itemLabel} quantity`} className="grid size-11 place-items-center disabled:opacity-35"><Minus className="size-4" /></button><span className="min-w-8 text-center font-black" aria-live="polite">{quantity}</span><button type="button" disabled={quantity >= 10} onClick={() => { setQuantity(Math.min(10, quantity + 1)); setAdded(false); }} aria-label={`Increase ${itemLabel} quantity`} className="grid size-11 place-items-center disabled:opacity-35"><Plus className="size-4" /></button></div></div>
    {error && <p role="alert" className="rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger">{error}</p>}
    <div className="sticky bottom-20 z-20 -mx-4 flex items-center gap-3 border-t border-border bg-surface p-3 shadow-[0_-8px_24px_rgba(30,40,34,0.12)] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><p className="shrink-0 text-lg font-black text-accent sm:hidden">₹{unitTotal * quantity}</p><button type="button" onClick={addToCart} disabled={unavailable || !availability.available} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-extrabold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-5">{added ? <Check className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}{unavailable ? "Currently unavailable" : !availability.available ? "Ordering Closed" : added ? "Added to cart" : <><span className="sm:hidden">{editKey ? "Save changes" : "Add to Cart"}</span><span className="hidden sm:inline">{`${editKey ? "Save customization" : meal.kind === "dish" ? "Add dish to cart" : "Add customized Thali"} · ₹${unitTotal * quantity}`}</span></>}</button><span className="sr-only" role="status" aria-live="polite">{added ? `${meal.name} added to cart.` : ""}</span></div>
  </div>;
}
