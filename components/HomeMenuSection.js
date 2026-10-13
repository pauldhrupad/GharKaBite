"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import MealCard from "./MealCard";
import FoodCategoryNav from "./FoodCategoryNav";
import { matchesMenuCategory } from "@/lib/menu-categories";
import { kolkataDate } from "@/lib/dates";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

export default function HomeMenuSection() {
  const [mealTime, setMealTime] = useState("lunch");
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const { settings, hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const meals = menu.filter((meal) => meal.slots.includes(mealTime === "lunch" ? "Lunch" : "Dinner") && matchesMenuCategory(meal, category)).slice(0, 4);
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
    <section id="todays-menu" aria-busy={loading} className="border-b border-border bg-background py-7 md:py-10"><div className="container-shell">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Today&apos;s menu</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Today&apos;s Thalis &amp; Dishes</h2>
          <p className="mt-1 font-bold text-accent">আজকের রান্না</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-text-secondary">
            <Clock3 className="size-4 text-accent" aria-hidden="true" /> {periodAvailability.available ? `${selectedPeriod} orders close at ${formatCutoffTime(mealTime === "lunch" ? settings.lunchCutoff : settings.dinnerCutoff)}` : periodAvailability.reason}
          </p>
          <div className="grid w-full grid-cols-2 rounded-xl border border-border bg-surface-alt p-1 sm:w-auto" role="group" aria-label="Choose meal time">
            {["lunch", "dinner"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseMealTime(option)}
                aria-pressed={mealTime === option}
                className={`min-h-11 rounded-lg px-5 text-sm font-extrabold capitalize transition ${mealTime === option ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:bg-surface hover:text-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <FoodCategoryNav meals={menu} selectedCategory={category} onSelect={setCategory} />
      <p aria-live="polite" className="mt-4 text-sm font-bold text-text-secondary">{loading ? "Loading menu…" : `${category === "All" ? "Today's" : category} ${selectedPeriod.toLowerCase()} menu · ${meals.length} ${meals.length === 1 ? "item" : "items"}`}</p>
      {!loading && !meals.length && <p className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-text-secondary">No matching meals for this period. Try another category or <Link href={`/menu?category=${encodeURIComponent(category)}`} className="font-bold text-primary underline">browse the full menu</Link>.</p>}
      <div className="customer-home-grid -mx-4 mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {loading && [0, 1, 2, 3].map((index) => <div key={index} className="card-surface h-80 animate-pulse snap-start bg-surface-muted" aria-hidden="true" />)}
        {meals.map((meal) => <MealCard key={meal.id} meal={meal} deliveryMealPeriod={selectedPeriod} serviceDate={kolkataDate()} orderingDisabled={!periodAvailability.available || !meal.available} unavailableReason={!meal.available ? "Currently unavailable" : periodAvailability.reason} />)}
      </div>
    </div></section>
  );
}
