"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { kolkataDate } from "@/lib/dates";

export default function MealDetailActions({ meal, serviceDate }) {
  const [period, setPeriod] = useState(meal.slots[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const timerRef = useRef(null);
  const { addItem } = useCart();
  const { hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const soldOut = !meal.available || meal.stock === 0;
  const periodAvailability = serviceDate === kolkataDate() && kitchenHydrated ? getAvailability(period) : { available: true, reason: "" };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleAdd() {
    if (soldOut || !periodAvailability.available) return;
    const result = addItem(meal, period, quantity, serviceDate);
    if (result.status !== "added") return;
    setAdded(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="mt-7 border-t border-border pt-6">
      <fieldset>
        <legend className="text-sm font-black">Choose meal period</legend>
        <div className="mt-3 inline-flex rounded-xl border border-border bg-surface-muted p-1">
          {meal.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setPeriod(slot)}
              aria-pressed={period === slot}
              className={`min-h-10 rounded-lg px-5 text-sm font-extrabold transition ${period === slot ? "bg-surface text-primary shadow-sm" : "text-text-secondary"}`}
            >
              {slot}
            </button>
          ))}
        </div>
      </fieldset>
      {!periodAvailability.available && <p className="mt-3 rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger">{periodAvailability.reason}</p>}

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-text-secondary">Price per meal</p>
          <p className="text-3xl font-black">₹{meal.price}</p>
        </div>
        <div>
          <p className="mb-2 text-right text-xs font-bold text-text-secondary">Quantity</p>
          <div className="flex items-center rounded-xl border border-border bg-surface p-1">
            <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="grid size-10 place-items-center rounded-lg hover:bg-surface-muted" aria-label="Decrease quantity"><Minus className="size-4" /></button>
            <span className="min-w-9 text-center font-black" aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => setQuantity((current) => Math.min(10, Math.max(meal.stock, 1), current + 1))} disabled={quantity >= Math.min(10, Math.max(meal.stock, 1))} className="grid size-10 place-items-center rounded-lg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35" aria-label="Increase quantity"><Plus className="size-4" /></button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={soldOut || !periodAvailability.available}
        className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold transition ${soldOut || !periodAvailability.available ? "cursor-not-allowed bg-surface-muted text-text-secondary" : added ? "bg-success text-white" : "bg-primary text-white hover:bg-primary-hover"}`}
      >
        {soldOut ? "Sold Out" : !periodAvailability.available ? "Ordering Closed" : added ? <><Check className="size-4" aria-hidden="true" /> Added to Cart</> : <><ShoppingBag className="size-4" aria-hidden="true" /> Add to Cart</>}
      </button>
    </div>
  );
}
