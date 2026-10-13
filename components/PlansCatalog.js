"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import CustomSelect from "./CustomSelect";

function allowedModes(plan) {
  return [["Lunch", plan.lunchAllowed], ["Dinner", plan.dinnerAllowed], ["Mixed", plan.mixedAllowed]].filter(([, allowed]) => allowed).map(([mode]) => mode);
}

export default function PlansCatalog() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modes, setModes] = useState({});
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/plans").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setPlans(data.plans || [])).catch(() => setMessage("Plans are unavailable.")).finally(() => setLoading(false)); }, []);

  return <section className="container-shell py-8 md:py-12">{loading && <div role="status" aria-label="Loading plans" className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="card-surface h-72 animate-pulse bg-surface-muted" />)}</div>}<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{plans.map((plan) => <article key={plan._id} className={`customer-plan card-surface p-5 transition-colors hover:border-primary/40 focus-within:border-primary md:p-6 ${plan.slug === "monthly" ? "featured" : ""}`}><div className="customer-plan-image"><div><p className="eyebrow">A little planning. A lot of comfort.</p><p className="mt-2 text-sm font-black text-primary">{plan.mealCount} meals · {plan.validityDays} days</p></div><Image src="/images/categories/meal-plans.webp" alt="" width={600} height={600} sizes="84px" /></div><h2 className="mt-2 text-2xl font-black">{plan.name}</h2><p className="mt-2 text-sm text-text-secondary">{plan.description}</p><p className="mt-5 text-3xl font-black text-accent">₹{plan.price.toLocaleString("en-IN")}</p><p className="text-sm text-text-secondary">₹{(plan.price / plan.mealCount).toFixed(2)} per meal · Valid {plan.validityDays} days</p><p className="mt-4 text-xs font-bold">Types: {plan.allowedMealTypes.join(", ")}</p><label className="mt-5 block text-sm font-bold">Meal timing<CustomSelect value={modes[plan._id] || allowedModes(plan)[0]} onChange={(event) => setModes({ ...modes, [plan._id]: event.target.value })} className="input-field mt-2">{allowedModes(plan).map((mode) => <option key={mode}>{mode}</option>)}</CustomSelect></label><button type="button" disabled className="mt-5 min-h-12 w-full rounded-xl border border-border bg-disabled-bg px-5 py-3 font-black text-text-secondary">Purchases unavailable</button></article>)}</div>{message && <p role="alert" className="mt-5 text-sm font-bold text-danger">{message}</p>}</section>;
}
