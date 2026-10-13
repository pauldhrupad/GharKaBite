"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Button from "./Button";

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

  return <div ref={ref} className="mt-8 min-h-72" aria-busy={near && loading}>
    {loading ? <div role="status"><span className="sr-only">{near ? "Loading meal plans" : "Meal plans load as you scroll"}</span><div aria-hidden="true" className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="loading-skeleton h-80 rounded-2xl" />)}</div></div> : error ? <Retry message={error} onRetry={() => { setLoading(true); setAttempt((current) => current + 1); }} /> :
      <div className="grid gap-5 lg:grid-cols-3">{plans.map((plan) => {
        const modes = [["Lunch", plan.lunchAllowed], ["Dinner", plan.dinnerAllowed], ["Mixed", plan.mixedAllowed]].filter(([, allowed]) => allowed).map(([mode]) => mode);
        return <article key={plan._id} className={`customer-plan relative rounded-2xl border bg-surface p-5 shadow-[0_4px_14px_rgba(30,40,34,0.07)] md:p-6 ${plan.slug === "monthly" ? "border-2 border-accent" : "border-border"}`}>
          {plan.slug === "monthly" && <span className="absolute -top-3 left-5 rounded-full bg-accent px-3 py-1 text-xs font-black text-white">Plan ahead</span>}
          <p className="text-sm font-extrabold text-text-secondary">{plan.mealCount} Meals</p><h3 className="mt-1 text-2xl font-black">{plan.name}</h3>
          <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black text-accent">₹{plan.price.toLocaleString("en-IN")}</span><span className="pb-1 text-sm font-bold text-text-secondary">₹{(plan.price / plan.mealCount).toFixed(2)} per meal</span></div>
          <p className="mt-2 text-sm text-text-secondary">Valid for {plan.validityDays} days</p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Available meal timing options">{modes.map((mode) => <span key={mode} className="rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-extrabold text-text-secondary">{mode}</span>)}</div>
          <Button href="/plans" className="mt-6 w-full">See plan details</Button>
        </article>;
      })}</div>}
  </div>;
}
