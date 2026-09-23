"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Badge from "./Badge";
import { useCart } from "@/context/CartContext";

const categoryStyles = {
  Veg: "bg-success",
  Egg: "bg-warning",
  Chicken: "bg-accent",
  Fish: "bg-primary",
};

export default function MealCard({ meal, deliveryMealPeriod, serviceDate, orderingDisabled = false, unavailableReason = "" }) {
  const [added, setAdded] = useState(false);
  const timerRef = useRef(null);
  const { addItem } = useCart();
  const selectedPeriod = deliveryMealPeriod || meal.slots[0];
  const soldOut = !meal.available || meal.stock === 0 || orderingDisabled;
  const lowStock = meal.available && meal.stock > 0 && meal.stock <= 3;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleAdd() {
    if (soldOut) return;
    const result = addItem(meal, selectedPeriod, 1, serviceDate);
    if (result.status !== "added") return;
    setAdded(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_38px_rgba(56,45,31,0.07)]">
      <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="relative block aspect-[4/3] overflow-hidden bg-surface-muted" aria-label={`View ${meal.name}`}>
        <Image
          src={meal.image}
          alt={`${meal.name}: ${meal.contents.join(", ")}`}
          fill
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 50vw, 33vw"
          className={`object-cover transition duration-300 group-hover:scale-[1.03] ${soldOut ? "grayscale-[35%]" : ""}`}
        />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {meal.badges.slice(0, 2).map((badge) => <Badge key={badge} onImage tone={badge === "Limited" ? "warning" : "green"}>{badge}</Badge>)}
        </div>
        {soldOut && <div className="absolute inset-0 grid place-items-center bg-text-primary/55"><span className="rounded-full bg-white px-4 py-2 text-sm font-black text-text-primary">{orderingDisabled ? "Ordering Closed" : "Sold Out"}</span></div>}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-text-secondary">
          <span className={`size-2.5 rounded-full ${categoryStyles[meal.category]}`} aria-hidden="true" />
          {meal.category} · {meal.mealType}
        </div>
        <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="mt-2 w-fit hover:text-primary">
          <h2 className="text-lg font-black tracking-tight">{meal.name}</h2>
        </Link>
        <p className="mt-1 text-sm leading-5 text-text-secondary">{meal.contents.join(" + ")}</p>
        <div className="mt-3 flex min-h-5 items-center">
          {orderingDisabled ? <p className="text-xs font-black text-danger">{unavailableReason}</p> : lowStock ? <p className="text-xs font-black text-warning">Only {meal.stock} left</p> : !soldOut ? <p className="text-xs font-bold text-success">Available for {selectedPeriod}</p> : <p className="text-xs font-black text-danger">Unavailable today</p>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xl font-black">₹{meal.price}</p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className={`inline-flex min-h-10 min-w-24 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-extrabold transition ${soldOut ? "cursor-not-allowed bg-surface-muted text-text-secondary" : added ? "bg-success text-white" : "bg-primary text-white hover:bg-primary-hover"}`}
            aria-label={soldOut ? `${meal.name} is unavailable` : `Add ${meal.name} for ${selectedPeriod}`}
          >
            {soldOut ? (orderingDisabled ? "Closed" : "Sold Out") : added ? <><Check className="size-4" aria-hidden="true" /> Added</> : <>Add <Plus className="size-4" aria-hidden="true" /></>}
          </button>
        </div>
      </div>
    </article>
  );
}
