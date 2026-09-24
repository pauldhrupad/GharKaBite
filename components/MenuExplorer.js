"use client";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MealCard from "./MealCard";
import { kolkataDate } from "@/lib/dates";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

const periods = ["Lunch", "Dinner"];
const categories = ["All", "Veg", "Egg", "Chicken", "Fish", "Special"];

export default function MenuExplorer({ initialDate }) {
  const [period, setPeriod] = useState("Lunch");
  const [category, setCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState(initialDate || kolkataDate());
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const categoryScroller = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { settings, hydrated: kitchenHydrated, getAvailability } = useKitchen();
  const periodAvailability = kitchenHydrated ? getAvailability(period, date) : { available: true, reason: "" };

  useEffect(() => {
    let active = true;
    fetch(`/api/menu?date=${date}`).then(async (response) => {
      if (!response.ok) throw new Error("Menu is temporarily unavailable.");
      const result = await response.json();
      if (active) { setMeals(result.meals || []); setLoadError(""); setLoading(false); }
    }).catch(() => { if (active) { setMeals([]); setLoadError("Menu is temporarily unavailable."); setLoading(false); } });
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    const loadSavedPeriod = window.setTimeout(() => {
      const savedPeriod = window.localStorage.getItem(MEAL_PERIOD_STORAGE_KEY);
      if (periods.includes(savedPeriod)) setPeriod(savedPeriod);
    }, 0);

    return () => window.clearTimeout(loadSavedPeriod);
  }, []);

  const updateCategoryScroll = useCallback(() => {
    const scroller = categoryScroller.current;
    if (!scroller) return;
    setCanScrollLeft(scroller.scrollLeft > 2);
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const scroller = categoryScroller.current;
    if (!scroller) return;
    const observer = new ResizeObserver(updateCategoryScroll);
    observer.observe(scroller);
    const frame = window.requestAnimationFrame(updateCategoryScroll);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [updateCategoryScroll]);

  function scrollCategories(direction) {
    const scroller = categoryScroller.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(160, scroller.clientWidth * 0.75), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

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
    categoryScroller.current?.scrollTo({ left: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return (
    <section className="container-shell py-7 md:py-10">
      <div className="mb-5 flex gap-2" aria-label="Delivery date">{[0, 1].map((offset) => <button key={offset} type="button" onClick={() => { if (date !== kolkataDate(offset)) { setLoading(true); setDate(kolkataDate(offset)); } }} aria-pressed={date === kolkataDate(offset)} className={`min-h-11 rounded-xl px-5 py-2 text-sm font-bold ${date === kolkataDate(offset) ? "bg-primary text-white" : "border border-border bg-surface hover:border-primary/40 hover:text-primary"}`}>{offset ? "Tomorrow" : "Today"}</button>)}</div>
      {loadError && <p role="alert" className="mb-4 text-sm font-bold text-danger">{loadError}</p>}
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_35px_rgba(56,45,31,0.05)] sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">Choose delivery period</p>
          <div className="mt-2 grid w-full grid-cols-2 rounded-xl border border-border bg-surface-alt p-1 sm:w-auto" role="group" aria-label="Choose lunch or dinner">
            {periods.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choosePeriod(option)}
                aria-pressed={period === option}
                className={`min-h-11 rounded-lg px-7 text-sm font-extrabold transition ${period === option ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:bg-surface hover:text-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className={`mt-2 text-xs font-bold ${periodAvailability.available ? "text-text-secondary" : "text-danger"}`}>{periodAvailability.available ? `${period} orders close at ${formatCutoffTime(period === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff)}` : periodAvailability.reason}</p>
        </div>

        <label className="group relative block w-full lg:max-w-sm">
          <span className="sr-only">Search menu</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-text-secondary group-focus-within:text-primary" aria-hidden="true" />
          <input
            type="search"
            name="mealSearch"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className={`input-field with-leading-icon ${searchQuery ? "pr-12" : ""}`}
            placeholder="Search dishes, Thalis or ingredients"
            autoComplete="off"
            enterKeyHint="search"
          />
          {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear menu search" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-text-secondary hover:bg-surface-muted hover:text-primary"><X className="size-4" aria-hidden="true" /></button>}
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-sm font-black"><SlidersHorizontal className="size-4" aria-hidden="true" /> Categories</span><span className="text-xs font-bold text-text-secondary sm:hidden">Swipe to browse</span></div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => scrollCategories(-1)} disabled={!canScrollLeft} aria-label="Scroll categories left" className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-primary disabled:opacity-40 sm:hidden"><ChevronLeft className="size-5" aria-hidden="true" /></button>
          <div ref={categoryScroller} onScroll={updateCategoryScroll} role="group" aria-label="Filter menu by category" tabIndex={0} className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:overflow-visible sm:pb-0">
            {categories.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={category === option}
                className={`min-h-11 shrink-0 snap-start rounded-full px-4 text-sm font-extrabold ${category === option ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => scrollCategories(1)} disabled={!canScrollRight} aria-label="Scroll categories right" className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-primary disabled:opacity-40 sm:hidden"><ChevronRight className="size-5" aria-hidden="true" /></button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-text-secondary" aria-live="polite">{loading ? "Loading menu…" : `Showing ${filteredMeals.length} ${period.toLowerCase()} ${filteredMeals.length === 1 ? "item" : "items"}`}</p>
        {filteredMeals.length > 1 && <p className="shrink-0 text-xs font-bold text-text-secondary sm:hidden">Swipe for more →</p>}
        <p className="hidden text-xs font-bold text-text-secondary sm:block">Made to order before the kitchen cutoff.</p>
      </div>

      {loading ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading menu">{[0, 1, 2, 3].map((index) => <div key={index} className="card-surface h-80 animate-pulse bg-surface-muted" />)}</div> : filteredMeals.length > 0 ? (
        <div role="region" aria-label="Menu items" tabIndex={0} className="-mx-4 mt-5 grid auto-cols-[min(80vw,18rem)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 scroll-px-4 snap-x snap-mandatory [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] sm:mx-0 sm:mt-6 sm:grid-flow-row sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMeals.map((meal) => <MealCard key={meal.id} meal={meal} deliveryMealPeriod={period} serviceDate={date} orderingDisabled={!periodAvailability.available} unavailableReason={periodAvailability.reason} />)}
        </div>
      ) : (
        <div className="card-surface mt-6 px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><UtensilsCrossed className="size-6" aria-hidden="true" /></span>
          <h2 className="mt-5 text-xl font-black">No matching menu items</h2>
          <p className="mt-2 text-sm text-text-secondary">Try another category, meal period or search term.</p>
          <button type="button" onClick={clearFilters} className="mt-5 min-h-10 rounded-xl bg-primary px-5 text-sm font-extrabold text-white hover:bg-primary-hover">Clear filters</button>
        </div>
      )}
    </section>
  );
}
