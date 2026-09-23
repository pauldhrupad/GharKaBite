"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import Badge from "./Badge";
import { kolkataDate } from "@/lib/dates";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

function HomeMealCard({ meal, orderingDisabled, unavailableReason }) {

  return (
    <article className={`meal-card group snap-start overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_38px_rgba(56,45,31,0.07)] ${orderingDisabled ? "is-sold-out" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        <Image
          src={meal.image}
          alt={`${meal.name} with ${meal.description}`}
          fill
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 25vw"
          className="meal-card-image object-cover"
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
          <p className="text-xl font-black">From ₹{meal.price}</p>
          {orderingDisabled ? <span className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-extrabold text-text-secondary">Closed</span> : <Link href={`/menu/${meal.id}?date=${kolkataDate()}`} className="ui-action inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-extrabold text-white">{meal.kind === "dish" ? "View dish" : "Customize"} <ArrowRight className="size-4" aria-hidden="true" /></Link>}
        </div>
        {orderingDisabled && <p className="mt-3 text-xs font-bold text-danger">{unavailableReason}</p>}
      </div>
    </article>
  );
}

export default function HomeMenuSection() {
  const [mealTime, setMealTime] = useState("lunch");
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const { settings, hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const meals = menu.filter((meal) => meal.slots.includes(mealTime === "lunch" ? "Lunch" : "Dinner")).slice(0, 4).map((meal) => ({ ...meal, description: meal.kind === "dish" ? meal.shortDescription : meal.contents.join(" + "), deliveryMealPeriod: mealTime === "lunch" ? "Lunch" : "Dinner" }));
  const selectedPeriod = mealTime === "lunch" ? "Lunch" : "Dinner";
  const periodAvailability = kitchenHydrated ? getAvailability(selectedPeriod) : { available: true, reason: "" };

  useEffect(() => {
    fetch(`/api/menu?date=${kolkataDate()}`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setMenu(data.meals || []); }).catch(() => {}).finally(() => setLoading(false));
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
    <section id="todays-menu" aria-busy={loading} className="container-shell py-14 md:py-20">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Today&apos;s menu</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Fresh from the kitchen</h2>
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
        {loading && [0, 1, 2, 3].map((index) => <div key={index} className="card-surface h-80 animate-pulse snap-start bg-surface-muted" aria-hidden="true" />)}
        {meals.map((meal) => <HomeMealCard key={meal.id} meal={meal} orderingDisabled={!periodAvailability.available || !meal.available} unavailableReason={!meal.available ? "Sold out or unavailable today" : periodAvailability.reason} />)}
      </div>
    </section>
  );
}
