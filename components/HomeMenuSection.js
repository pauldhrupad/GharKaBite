"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import MealCard from "./MealCard";
import FoodCategoryNav from "./FoodCategoryNav";
import { matchesMenuCategory } from "@/lib/menu-categories";
import { initialHomePeriod } from "@/lib/meal-period";
import { MEAL_PERIOD_STORAGE_KEY } from "@/lib/constants";
import { useKitchen } from "@/context/KitchenContext";
import { formatCutoffTime } from "@/lib/kitchen-operations";

export default function HomeMenuSection() {
  const [selection, setSelection] = useState(null);
  const [saved, setSaved] = useState(null);
  const [menu, setMenu] = useState({ date: "", meals: [] });
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState("All");
  const { settings, hydrated, getAvailability, now, today } = useKitchen();
  const loading = menu.date !== today;
  const allMeals = loading ? [] : menu.meals;
  const period = selection || initialHomePeriod(saved, settings, allMeals, new Date(now), today);
  const meals = allMeals.filter((meal) => meal.slots.includes(period) && matchesMenuCategory(meal, category)).slice(0, 4);
  const availability = getAvailability(period, today);
  const fullMenuHref = `/menu?${new URLSearchParams({ date: today, period, category })}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/menu?date=${today}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Menu is temporarily unavailable.");
      return response.json();
    }).then((data) => { if (!controller.signal.aborted) { setMenu({ date: today, meals: data.meals || [] }); setLoadError(""); } })
      .catch(() => { if (!controller.signal.aborted) { setMenu({ date: today, meals: [] }); setLoadError("Menu is temporarily unavailable. Please try again."); } });
    return () => controller.abort();
  }, [today, attempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => { try { setSaved(window.localStorage.getItem(MEAL_PERIOD_STORAGE_KEY)); } catch { /* Browsing works without storage. */ } }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function choosePeriod(option) {
    setSelection(option);
    try { window.localStorage.setItem(MEAL_PERIOD_STORAGE_KEY, option); } catch { /* Keep the in-memory selection. */ }
  }

  return <section id="todays-menu" aria-busy={loading} className="home-discovery container-shell">
    <div className="home-menu-heading"><h2 className="type-section-title">Today&apos;s Thalis <span>&amp; dishes</span></h2><Link href={fullMenuHref} className="home-view-all">Full menu <ArrowRight size={15} aria-hidden="true" /></Link></div>
    <div className="home-period-row"><div role="group" aria-label="Choose meal time" className="home-period-control">{["Lunch", "Dinner"].map((option) => <button key={option} type="button" onClick={() => choosePeriod(option)} aria-pressed={period === option}>{option}</button>)}</div><p className="home-cutoff"><Clock3 size={14} aria-hidden="true" />{!hydrated ? "Checking availability…" : availability.available ? `Closes ${formatCutoffTime(settings[`${period.toLowerCase()}Cutoff`])}` : availability.reason}</p></div>
    <FoodCategoryNav meals={allMeals} selectedCategory={category} onSelect={setCategory} />
    <p className="sr-only" aria-live="polite">{loading ? "Loading menu…" : `${meals.length} matching ${period.toLowerCase()} meals`}</p>
    {loadError ? <div role="alert" className="home-menu-empty"><p>{loadError}</p><button type="button" onClick={() => { setMenu({ date: "", meals: [] }); setLoadError(""); setAttempt((value) => value + 1); }} className="food-category-filter">Try again</button></div> : !loading && !meals.length ? <div className="home-menu-empty"><p>No matching meals for this period. Try another category or explore tomorrow&apos;s menu.</p><Link href={fullMenuHref} className="home-view-all">Browse the full menu <ArrowRight size={16} aria-hidden="true" /></Link></div> : null}
    <div className="customer-home-grid">
      {loading && [0, 1, 2, 3].map((index) => <div key={index} className="home-meal-skeleton loading-skeleton" aria-hidden="true" />)}
      {meals.map((meal) => <MealCard key={meal.id} meal={meal} deliveryMealPeriod={period} serviceDate={today} orderingDisabled={!availability.available} unavailableReason={availability.reason} />)}
    </div>
  </section>;
}
