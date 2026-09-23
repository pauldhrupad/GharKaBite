"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Plus } from "lucide-react";
import Badge from "./Badge";
import { kolkataDate } from "@/lib/dates";
import { useCart } from "@/context/CartContext";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

function HomeMealCard({ meal, orderingDisabled, unavailableReason }) {
  const [added, setAdded] = useState(false);
  const timerRef = useRef(null);
  const { addItem } = useCart();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function addMeal() {
    if (orderingDisabled) return;
    const result = addItem(meal, meal.deliveryMealPeriod, 1);
    if (result.status !== "added") return;
    setAdded(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group snap-start overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_38px_rgba(56,45,31,0.07)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        <Image
          src={meal.image}
          alt={`${meal.name} with ${meal.description}`}
          fill
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {meal.badges.slice(0, 2).map((badge) => (
            <Badge key={badge} onImage tone={badge === "Limited" || badge.includes("Left") ? "warning" : badge === "Non-Veg" ? "terracotta" : "green"}>
              {badge}
            </Badge>
          ))}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-black tracking-tight">{meal.name}</h3>
        <p className="mt-1 min-h-11 text-sm leading-5 text-text-secondary">{meal.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xl font-black">₹{meal.price}</p>
          <button
            type="button"
            onClick={addMeal}
            disabled={orderingDisabled}
            className={`inline-flex min-h-10 min-w-24 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-extrabold transition ${orderingDisabled ? "cursor-not-allowed bg-surface-muted text-text-secondary" : added ? "bg-success text-white" : "bg-primary text-white hover:bg-primary-hover"}`}
            aria-label={`Add ${meal.name} to cart`}
          >
            {orderingDisabled ? "Closed" : added ? <><Check className="size-4" aria-hidden="true" /> Added</> : <>Add <Plus className="size-4" aria-hidden="true" /></>}
          </button>
        </div>
        {orderingDisabled && <p className="mt-3 text-xs font-bold text-danger">{unavailableReason}</p>}
      </div>
    </article>
  );
}

export default function HomeMenuSection() {
  const [mealTime, setMealTime] = useState("lunch");
  const [menu, setMenu] = useState([]);
  const { settings, hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const meals = menu.filter((meal) => meal.slots.includes(mealTime === "lunch" ? "Lunch" : "Dinner")).slice(0, 4).map((meal) => ({ ...meal, description: meal.contents.join(" + "), deliveryMealPeriod: mealTime === "lunch" ? "Lunch" : "Dinner" }));
  const selectedPeriod = mealTime === "lunch" ? "Lunch" : "Dinner";
  const periodAvailability = kitchenHydrated ? getAvailability(selectedPeriod) : { available: true, reason: "" };

  useEffect(() => {
    fetch(`/api/menu?date=${kolkataDate()}`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setMenu(data.meals || []); }).catch(() => {});
    const loadSavedPeriod = window.setTimeout(() => {
      const savedPeriod = window.localStorage.getItem(MEAL_PERIOD_STORAGE_KEY);
      if (savedPeriod === "Lunch" || savedPeriod === "Dinner") setMealTime(savedPeriod.toLowerCase());
    }, 0);

    return () => window.clearTimeout(loadSavedPeriod);
  }, []);

  function chooseMealTime(option) {
    setMealTime(option);
    window.localStorage.setItem(MEAL_PERIOD_STORAGE_KEY, option === "lunch" ? "Lunch" : "Dinner");
  }

  return (
    <section id="todays-menu" className="container-shell py-14 md:py-20">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Today&apos;s menu</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">What&apos;s Cooking Today?</h2>
          <p className="mt-1 font-bold text-accent">আজকের রান্না</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary">
            <Clock3 className="size-4 text-accent" aria-hidden="true" /> {selectedPeriod} orders close at {formatCutoffTime(mealTime === "lunch" ? settings.lunchCutoff : settings.dinnerCutoff)}
          </p>
          <div className="inline-grid grid-cols-2 rounded-xl border border-border bg-surface-muted p-1" role="group" aria-label="Choose meal time">
            {["lunch", "dinner"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseMealTime(option)}
                aria-pressed={mealTime === option}
                className={`min-h-10 rounded-lg px-5 text-sm font-extrabold capitalize transition ${mealTime === option ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-4 mt-8 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {meals.map((meal) => <HomeMealCard key={meal.id} meal={meal} orderingDisabled={!periodAvailability.available || !meal.available} unavailableReason={!meal.available ? "Sold out or unavailable today" : periodAvailability.reason} />)}
      </div>
    </section>
  );
}
