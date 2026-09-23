"use client";

import { Search, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import MealCard from "./MealCard";
import { kolkataDate } from "@/lib/dates";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

const periods = ["Lunch", "Dinner"];
const categories = ["All", "Veg", "Egg", "Chicken", "Fish"];

export default function MenuExplorer({ initialDate }) {
  const [period, setPeriod] = useState("Lunch");
  const [category, setCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState(initialDate || kolkataDate());
  const [meals, setMeals] = useState([]);
  const [loadError, setLoadError] = useState("");
  const { settings, hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const periodAvailability = date === kolkataDate() && kitchenHydrated ? getAvailability(period) : { available: true, reason: "" };

  useEffect(() => {
    let active = true;
    fetch(`/api/menu?date=${date}`).then(async (response) => {
      if (!response.ok) throw new Error("Menu is temporarily unavailable.");
      const result = await response.json();
      if (active) { setMeals(result.meals || []); setLoadError(""); }
    }).catch(() => { if (active) { setMeals([]); setLoadError("Menu is temporarily unavailable."); } });
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    const loadSavedPeriod = window.setTimeout(() => {
      const savedPeriod = window.localStorage.getItem(MEAL_PERIOD_STORAGE_KEY);
      if (periods.includes(savedPeriod)) setPeriod(savedPeriod);
    }, 0);

    return () => window.clearTimeout(loadSavedPeriod);
  }, []);

  function choosePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    window.localStorage.setItem(MEAL_PERIOD_STORAGE_KEY, nextPeriod);
  }

  const filteredMeals = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return meals.filter((meal) => {
      const matchesPeriod = meal.slots.includes(period);
      const matchesCategory = category === "All" || meal.category === category;
      const searchableText = `${meal.name} ${meal.contents.join(" ")} ${meal.choiceGroups.flatMap((group) => group.options.map((option) => option.name)).join(" ")} ${meal.addOns.map((item) => item.name).join(" ")}`.toLowerCase();
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      return matchesPeriod && matchesCategory && matchesSearch;
    });
  }, [category, period, searchQuery, meals]);

  function clearFilters() {
    setCategory("All");
    setSearchQuery("");
  }

  return (
    <section className="container-shell py-9 md:py-12">
      <div className="mb-5 flex gap-2" aria-label="Delivery date">{[0, 1].map((offset) => <button key={offset} type="button" onClick={() => setDate(kolkataDate(offset))} aria-pressed={date === kolkataDate(offset)} className={`rounded-xl px-5 py-2 text-sm font-bold ${date === kolkataDate(offset) ? "bg-primary text-white" : "border border-border bg-surface"}`}>{offset ? "Tomorrow" : "Today"}</button>)}</div>
      {loadError && <p role="alert" className="mb-4 text-sm font-bold text-danger">{loadError}</p>}
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_35px_rgba(56,45,31,0.05)] sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">Choose delivery period</p>
          <div className="mt-2 inline-grid grid-cols-2 rounded-xl border border-border bg-surface-muted p-1" role="group" aria-label="Choose lunch or dinner">
            {periods.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choosePeriod(option)}
                aria-pressed={period === option}
                className={`min-h-10 rounded-lg px-7 text-sm font-extrabold transition ${period === option ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className={`mt-2 text-xs font-bold ${periodAvailability.available ? "text-text-secondary" : "text-danger"}`}>{periodAvailability.available ? `${period} orders close at ${formatCutoffTime(period === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff)}` : periodAvailability.reason}</p>
        </div>

        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Search Thalis</span>
          <Search className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
          <input
            type="search"
            name="mealSearch"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="input-field with-leading-icon"
            placeholder="Search by Thali or ingredient"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Filter Thalis by category">
        <span className="mr-1 inline-flex shrink-0 items-center gap-2 text-sm font-black"><SlidersHorizontal className="size-4" aria-hidden="true" /> Categories</span>
        {categories.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-extrabold transition ${category === option ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary"}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-text-secondary">Showing {filteredMeals.length} {period.toLowerCase()} {filteredMeals.length === 1 ? "Thali" : "Thalis"}</p>
        <p className="hidden text-xs font-bold text-text-secondary sm:block">Availability reflects today&apos;s limited batches.</p>
      </div>

      {filteredMeals.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMeals.map((meal) => <MealCard key={meal.id} meal={meal} deliveryMealPeriod={period} serviceDate={date} orderingDisabled={!periodAvailability.available} unavailableReason={periodAvailability.reason} />)}
        </div>
      ) : (
        <div className="card-surface mt-6 px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><UtensilsCrossed className="size-6" aria-hidden="true" /></span>
          <h2 className="mt-5 text-xl font-black">No matching Thalis</h2>
          <p className="mt-2 text-sm text-text-secondary">Try another category, meal period or search term.</p>
          <button type="button" onClick={clearFilters} className="mt-5 min-h-10 rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-hover">Clear filters</button>
        </div>
      )}
    </section>
  );
}
