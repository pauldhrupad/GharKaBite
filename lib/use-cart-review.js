"use client";

import { useEffect, useMemo, useState } from "react";
import { allowedOrderDate } from "./dates";
import { calculateThaliPrice } from "./thali";
import { reviewThaliSelections } from "./thali-builder";

export function reviewCartItems(items, menu) {
  return items.map((item) => {
    const meal = menu.find((entry) => entry.id === item.mealId);
    const issues = [];
    let price = null;
    if (!meal) issues.push("This meal is no longer on the menu. Remove it or choose another meal.");
    else {
      if (!meal.available || !meal.slots.includes(item.deliveryMealPeriod)) issues.push("This meal is unavailable for your delivery date or meal period.");
      issues.push(...reviewThaliSelections(meal, item.selectedChoices, item.selectedAddOns, item).issues);
      try { price = calculateThaliPrice(meal, item.selectedChoices, item.selectedAddOns, item.quantity); }
      catch (error) { if (!issues.includes(error.message)) issues.push(error.message); }
    }
    if (item.needsReview) issues.push("Review this older saved selection in the Thali builder.");
    const priceChanged = Boolean(price && price.unitTotal !== item.price);
    return { key: item.key, meal, issues, priceChanged, price, blocked: Boolean(issues.length || priceChanged) };
  });
}

export function useCartReview(items, date) {
  const [catalog, setCatalog] = useState({ date: "", meals: [], error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!date || !allowedOrderDate(date)) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/menu?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to check your meals.");
        if (!controller.signal.aborted) setCatalog({ date, meals: data.meals, error: "" });
      } catch (error) { if (!controller.signal.aborted) setCatalog({ date, meals: [], error: error.message }); }
    }
    load();
    window.addEventListener("focus", load);
    return () => { controller.abort(); window.removeEventListener("focus", load); };
  }, [date, retry]);
  const current = catalog.date === date;
  const reviews = useMemo(() => current && !catalog.error ? reviewCartItems(items, catalog.meals) : [], [items, current, catalog]);
  const expired = Boolean(date && !allowedOrderDate(date));
  return { reviews, menu: current ? catalog.meals : [], loading: Boolean(date && !expired && !current), error: expired ? "This delivery date has expired. Choose an available date from the menu; your saved choices have not been moved." : current ? catalog.error : "", blocked: expired || !current || Boolean(catalog.error) || reviews.some((item) => item.blocked), retry: () => setRetry((value) => value + 1) };
}
