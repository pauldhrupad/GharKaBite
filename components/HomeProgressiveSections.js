"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { kolkataDate } from "@/lib/dates";
import { useKitchen } from "@/context/KitchenContext";

function useNearViewport() {
  const ref = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!ref.current) return undefined;
    if (!window.IntersectionObserver) {
      const timer = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, near };
}

function Retry({ message, onRetry }) {
  return <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-surface p-4 text-sm"><p className="font-bold text-danger">{message}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-bold text-primary">Try again</button></div>;
}

export function TomorrowMenuCards({ date }) {
  const { ref, near } = useNearViewport();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!near) return undefined;
    const controller = new AbortController();
    fetch(`/api/menu?date=${date}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Tomorrow's menu is temporarily unavailable.");
      return response.json();
    }).then((data) => { if (!controller.signal.aborted) { setMeals((data.meals || []).filter((meal) => meal.available).slice(0, 3)); setError(""); } })
      .catch(() => { if (!controller.signal.aborted) setError("Tomorrow's menu is temporarily unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [near, date, attempt]);

  return <div ref={ref} className="mt-6 min-h-32" aria-busy={near && loading}>
    {loading ? <div role="status"><span className="sr-only">{near ? "Loading tomorrow's menu" : "Menu preview loads as you scroll"}</span><div aria-hidden="true" className="loading-skeleton h-28 rounded-2xl" /></div> : error ? <Retry message={error} onRetry={() => { setLoading(true); setAttempt((current) => current + 1); }} /> :
      <div className="-mx-4 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {meals.length === 0 && <p className="col-span-full rounded-xl bg-surface p-5 text-sm font-bold text-text-secondary">Tomorrow&apos;s menu is being prepared. Check back later.</p>}
        {meals.map((meal) => <article key={meal.id} className="flex snap-start items-center gap-4 rounded-2xl border border-border bg-surface p-3"><div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted"><Image src={meal.image} alt={`${meal.name} preview`} fill sizes="80px" className="object-cover" /></div><div className="min-w-0"><h3 className="font-black">{meal.name}</h3><p className="mt-1 text-xs leading-5 text-text-secondary">{meal.contents.join(", ")}</p></div></article>)}
      </div>}
  </div>;
}

export function HomepageTomorrowPreview() {
  const { now } = useKitchen();
  const date = kolkataDate(1, new Date(now));
  return <div className="home-tomorrow"><Button href={`/menu?date=${date}`} variant="outline">Tomorrow&apos;s menu <ArrowRight size={16} aria-hidden="true" /></Button><details><summary>Preview tomorrow&apos;s meals</summary><TomorrowMenuCards date={date} /></details></div>;
}

export function HomepagePlanCards() {
  const { ref, near } = useNearViewport();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!near) return undefined;
    const controller = new AbortController();
    fetch("/api/plans", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Meal plans are temporarily unavailable.");
      return response.json();
    }).then((data) => { if (!controller.signal.aborted) { setPlans((data.plans || []).slice(0, 3)); setError(""); } })
      .catch(() => { if (!controller.signal.aborted) setError("Meal plans are temporarily unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [near, attempt]);

  return <div ref={ref} className="home-plan-preview" aria-busy={near && loading}>
    {loading ? <div role="status"><span className="sr-only">{near ? "Loading meal plans" : "Meal plans load as you scroll"}</span><div aria-hidden="true" className="home-plan-grid">{[0, 1, 2].map((index) => <div key={index} className="loading-skeleton h-40 rounded-2xl" />)}</div></div> : error ? <Retry message={error} onRetry={() => { setLoading(true); setAttempt((current) => current + 1); }} /> : plans.length === 0 ? <div className="home-plans-unavailable"><p>No plan offerings are currently available for purchase.</p><Link href="/subscriptions" className="home-view-all">Manage an existing plan <ArrowRight size={16} aria-hidden="true" /></Link></div> :
      <div className="home-plan-grid">{plans.map((plan) => {
        const modes = [["Lunch", plan.lunchAllowed], ["Dinner", plan.dinnerAllowed], ["Mixed", plan.mixedAllowed]].filter(([, allowed]) => allowed).map(([mode]) => mode);
        return <article key={plan._id} className="home-plan-card">
          <div><h3 className="type-card-title">{plan.name}</h3><p>{plan.mealCount} meals · {plan.validityDays} days</p></div>
          <p className="home-plan-price">₹{plan.price.toLocaleString("en-IN")} <span>₹{(plan.price / plan.mealCount).toFixed(2)} per meal</span></p>
          <p>{modes.join(" / ")}</p>
          <Button disabled className="w-full">Purchases unavailable</Button>
        </article>;
      })}</div>}
  </div>;
}
