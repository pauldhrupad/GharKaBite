"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function allowedModes(plan) {
  return [["Lunch", plan.lunchAllowed], ["Dinner", plan.dinnerAllowed], ["Mixed", plan.mixedAllowed]].filter(([, allowed]) => allowed).map(([mode]) => mode);
}

export default function PlansCatalog() {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [modes, setModes] = useState({});
  const [intent, setIntent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/plans").then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setPlans(data.plans || [])).catch(() => setMessage("Plans are unavailable.")); }, []);

  async function choose(plan) {
    setBusy(true); setMessage("");
    try {
      const key = crypto.randomUUID();
      const response = await fetch("/api/demo-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "subscription", key, payload: { planId: plan._id, mode: modes[plan._id] || allowedModes(plan)[0], purchaseKey: key } }) });
      if (response.status === 401) { router.push("/login?callbackUrl=/plans"); return; }
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setIntent({ ...result, plan });
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function complete(outcome) {
    setBusy(true);
    try {
      const response = await fetch(`/api/demo-payments/${intent.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setIntent(null);
      if (outcome === "success") router.push("/subscriptions");
      else setMessage(result.message);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  return <section className="container-shell py-12"><div className="grid gap-5 lg:grid-cols-3">{plans.map((plan) => <article key={plan._id} className="card-surface p-6"><p className="text-sm font-black text-primary">{plan.mealCount} meals</p><h2 className="mt-2 text-2xl font-black">{plan.name}</h2><p className="mt-2 text-sm text-text-secondary">{plan.description}</p><p className="mt-5 text-3xl font-black">₹{plan.price.toLocaleString("en-IN")}</p><p className="text-sm text-text-secondary">₹{(plan.price / plan.mealCount).toFixed(2)} per meal · Valid {plan.validityDays} days</p><p className="mt-4 text-xs font-bold">Types: {plan.allowedMealTypes.join(", ")}</p><label className="mt-5 block text-sm font-bold">Meal timing<select value={modes[plan._id] || allowedModes(plan)[0]} onChange={(event) => setModes({ ...modes, [plan._id]: event.target.value })} className="input-field mt-2">{allowedModes(plan).map((mode) => <option key={mode}>{mode}</option>)}</select></label><button disabled={busy} onClick={() => choose(plan)} className="mt-5 w-full rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-50">Preview plan purchase</button></article>)}</div>{message && <p role="alert" className="mt-5 text-sm font-bold text-danger">{message}</p>}{intent && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Plan purchase preview · {intent.plan.name}</h2><p className="mt-2 text-sm text-text-secondary">This plan preview collects no money. Choose an outcome to test plan activation. Food-order Online Payment is separate.</p><div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} onClick={() => complete("success")} className="rounded-xl bg-primary px-5 py-3 font-bold text-white">Activate preview plan</button><button disabled={busy} onClick={() => complete("failure")} className="rounded-xl border border-border px-5 py-3 font-bold">Test failed purchase</button></div></div></div>}</section>;
}
