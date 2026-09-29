"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingState, { LoadingSpinner } from "@/components/LoadingState";

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const [subscriptionsResponse, plansResponse] = await Promise.all([fetch("/api/admin/subscriptions"), fetch("/api/admin/plans")]);
    if (!subscriptionsResponse.ok || !plansResponse.ok) throw new Error("Unable to load subscriptions and plans.");
    const [subscriptionData, planData] = await Promise.all([subscriptionsResponse.json(), plansResponse.json()]);
    setSubscriptions(subscriptionData.subscriptions || []);
    setPlans(planData.plans || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try { await reload(); }
    catch { setLoadError("Unable to load subscriptions and plans."); }
    finally { setLoading(false); }
  }, [reload]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(id, status) {
    if (pendingAction) return;
    setPendingAction(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/subscriptions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Update failed.");
      await reload();
      setMessage(data.message || "Subscription updated.");
    } catch (error) { setMessage(error.message || "Update failed. Please try again."); }
    finally { setPendingAction(""); }
  }

  async function savePlan(event) {
    event.preventDefault();
    if (pendingAction || !editing) return;
    setPendingAction("plan");
    setMessage("");
    try {
      const response = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing, id: editing._id, mealCount: Number(editing.mealCount), price: Number(editing.price), validityDays: Number(editing.validityDays) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Plan update failed.");
      await reload();
      setEditing(null);
      setMessage(data.message || "Plan updated.");
    } catch (error) { setMessage(error.message || "Plan update failed. Please try again."); }
    finally { setPendingAction(""); }
  }

  if (loading) return <LoadingState label="Loading subscriptions and plans" variant="section" className="mt-7" />;
  if (loadError) return <div role="alert" className="mt-7 rounded-xl border border-danger/30 bg-white p-5"><p className="font-bold text-danger">{loadError}</p><button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-bold text-primary">Try again</button></div>;

  return <section>
    <p className="eyebrow">Recurring meals</p><h1 className="mt-1 text-3xl font-black">Subscriptions</h1>
    {message && <p role="status" className="mt-4 text-sm font-bold">{message}</p>}
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white"><table className="w-full min-w-[48rem] text-left text-sm"><thead><tr>{["Customer", "Plan", "Remaining", "Status", "Start", "Expiry", "Action"].map((value) => <th key={value} className="p-3">{value}</th>)}</tr></thead><tbody>{subscriptions.map((item) => <tr key={item._id} className="border-t border-border">
      <td className="p-3">{item.user?.name || "Unknown"}</td><td className="p-3">{item.planName} · {item.mode}</td><td className="p-3">{item.remainingMeals}/{item.totalMeals}</td><td className="p-3 capitalize">{item.status}</td><td className="p-3">{new Date(item.startDate).toLocaleDateString("en-IN")}</td><td className="p-3">{new Date(item.expiryDate).toLocaleDateString("en-IN")}</td>
      <td className="p-3">{item.status === "active" && <button type="button" disabled={Boolean(pendingAction)} onClick={() => setStatus(item._id, "paused")} className="font-bold text-primary disabled:opacity-50">{pendingAction === item._id ? "Updating…" : "Pause"}</button>}{item.status === "paused" && <button type="button" disabled={Boolean(pendingAction)} onClick={() => setStatus(item._id, "active")} className="font-bold text-primary disabled:opacity-50">{pendingAction === item._id ? "Updating…" : "Resume"}</button>}{["active", "paused"].includes(item.status) && <button type="button" disabled={Boolean(pendingAction)} onClick={() => { if (window.confirm("Cancel this subscription?")) setStatus(item._id, "cancelled"); }} className="ml-3 font-bold text-danger disabled:opacity-50">Cancel</button>}</td>
    </tr>)}</tbody></table></div>
    <h2 className="mt-8 text-xl font-black">Plans</h2>
    <div className="mt-4 grid gap-4 md:grid-cols-3">{plans.map((plan) => <article key={plan._id} className="rounded-xl border border-border bg-white p-4"><h3 className="font-black">{plan.name}</h3><p className="text-sm">{plan.mealCount} meals · ₹{plan.price} · {plan.validityDays} days</p><p className="text-sm">{plan.active ? "Active" : "Inactive"}</p><button type="button" disabled={Boolean(pendingAction)} onClick={() => setEditing({ ...plan })} className="mt-3 font-bold text-primary disabled:opacity-50">Edit plan</button></article>)}</div>
    {editing && <form onSubmit={savePlan} aria-busy={pendingAction === "plan"} className="mt-5 grid gap-3 rounded-xl border border-border bg-white p-5 sm:grid-cols-2"><h3 className="sm:col-span-2 font-black">Edit {editing.name}</h3>
      {[["name", "Name", "text", "e.g. Weekly plan"], ["description", "Description", "text", "Describe who this plan is for"], ["mealCount", "Meals", "number", "e.g. 7"], ["price", "Price (₹)", "number", "e.g. 799"], ["validityDays", "Validity days", "number", "e.g. 10"]].map(([field, label, type, placeholder]) => <label key={field} className="text-sm font-bold">{label}<input name={field} type={type} min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} inputMode={type === "number" ? "numeric" : undefined} value={editing[field]} onChange={(event) => setEditing({ ...editing, [field]: event.target.value })} placeholder={placeholder} className="input-field mt-1" required /></label>)}
      <fieldset className="sm:col-span-2"><legend className="font-bold">Allowed meal types</legend>{["Rice Meal", "Roti Meal", "Comfort Meal", "Light Meal"].map((value) => <label key={value} className="mr-4 text-sm"><input type="checkbox" checked={editing.allowedMealTypes.includes(value)} onChange={() => setEditing({ ...editing, allowedMealTypes: editing.allowedMealTypes.includes(value) ? editing.allowedMealTypes.filter((item) => item !== value) : [...editing.allowedMealTypes, value] })} /> {value}</label>)}</fieldset>
      {["lunchAllowed", "dinnerAllowed", "mixedAllowed", "active"].map((field) => <label key={field} className="text-sm"><input type="checkbox" checked={editing[field]} onChange={(event) => setEditing({ ...editing, [field]: event.target.checked })} /> {({ lunchAllowed: "Lunch allowed", dinnerAllowed: "Dinner allowed", mixedAllowed: "Mixed timing allowed", active: "Active" })[field]}</label>)}
      <div className="sm:col-span-2"><button type="submit" disabled={Boolean(pendingAction)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2 font-bold text-white disabled:opacity-50">{pendingAction === "plan" && <LoadingSpinner />}{pendingAction === "plan" ? "Saving…" : "Save plan"}</button><button type="button" disabled={Boolean(pendingAction)} onClick={() => setEditing(null)} className="ml-3 min-h-11 font-bold disabled:opacity-50">Cancel</button></div>
    </form>}
  </section>;
}
