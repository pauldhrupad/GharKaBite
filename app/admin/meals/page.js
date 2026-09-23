"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import AdminThaliForm from "@/components/AdminThaliForm";
import CustomSelect from "@/components/CustomSelect";

function dateAt(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(Date.now() + offset * 86400000));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function AdminMealsPage() {
  const [meals, setMeals] = useState([]);
  const [daily, setDaily] = useState([]);
  const [date, setDate] = useState(dateAt());
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const [catalogue, overrides] = await Promise.all([fetch("/api/admin/meals"), fetch(`/api/admin/daily-menu?date=${date}`)]);
    if (!catalogue.ok || !overrides.ok) throw new Error("Unable to load menu items.");
    setMeals((await catalogue.json()).meals || []);
    setDaily((await overrides.json()).overrides || []);
  }, [date]);
  useEffect(() => { const timer = window.setTimeout(() => reload().catch((error) => setMessage(error.message)), 0); return () => window.clearTimeout(timer); }, [reload]);

  async function change(url, method, payload) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      await reload(); setMessage(result.message || "Menu item updated.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  function duplicate(meal) {
    const slug = `${meal.slug}-copy-${crypto.randomUUID().slice(0, 4)}`;
    const copy = { ...meal, _id: undefined, slug, name: `${meal.name} Copy`, active: false, choiceGroups: meal.choiceGroups.map((group) => ({ ...group, options: group.options.map((option) => ({ ...option })) })), addOns: meal.addOns.map((addOn) => ({ ...addOn })) };
    setEditing(null); setForm(copy); setMessage("");
  }

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Kitchen catalogue</p><h1 className="mt-1 text-3xl font-black">Menu items</h1><p className="text-sm text-text-secondary">Manage Thalis and single dishes, choices, add-ons and daily stock.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditing(null); setForm({ kind: "thali" }); }} className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white hover:bg-primary-hover">Create Thali</button><button type="button" onClick={() => { setEditing(null); setForm({ kind: "dish" }); }} className="min-h-11 rounded-xl border border-primary px-4 py-3 text-sm font-black text-primary hover:bg-primary/10">Add single dish</button></div></div>
    <div className="mt-5 flex gap-2">{[0, 1].map((offset) => <button key={offset} type="button" onClick={() => setDate(dateAt(offset))} className={`rounded-xl px-4 py-2 text-sm font-bold ${date === dateAt(offset) ? "bg-primary text-white" : "border border-border bg-white"}`}>{offset ? "Tomorrow" : "Today"}</button>)}</div>
    {message && <p className="mt-4 rounded-xl bg-white p-3 text-sm font-bold" role="status">{message}</p>}
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{meals.map((meal) => {
      const override = daily.find((item) => String(item.meal) === String(meal._id));
      const dayPayload = (patch) => change("/api/admin/daily-menu", "PATCH", { mealId: meal.slug, date, ...patch });
      return <article key={meal.slug} className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex gap-4 p-4"><div className="relative size-24 shrink-0 overflow-hidden rounded-xl"><Image src={meal.image} alt="" fill sizes="96px" className="object-cover" /></div><div className="min-w-0"><h2 className="font-black">{meal.name}</h2><p className="text-sm text-text-secondary">{meal.kind === "dish" ? "Single dish" : "Thali"} · From ₹{meal.price} · {meal.category}</p><p className="text-xs text-text-secondary">{meal.slots.join(" & ")} · Remaining {override?.remaining ?? meal.stockLimit}/{meal.stockLimit}</p><p className="text-xs font-bold">{meal.active ? "Active" : "Inactive"}{override?.soldOut ? " · Sold out" : ""}{meal.featured ? " · Featured" : ""}</p></div></div><div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2"><button disabled={busy} onClick={() => { setEditing(meal.slug); setForm(meal); }} className="admin-meal-action min-h-11 rounded-lg border border-border p-2 text-sm font-bold disabled:opacity-50">Edit</button><button disabled={busy} onClick={() => duplicate(meal)} className="admin-meal-action min-h-11 rounded-lg border border-border p-2 text-sm font-bold disabled:opacity-50">Duplicate</button><button disabled={busy} onClick={() => change(`/api/admin/meals/${meal.slug}`, "PATCH", { active: !meal.active })} className="admin-meal-action min-h-11 rounded-lg border border-border p-2 text-sm font-bold disabled:opacity-50">{meal.active ? "Deactivate" : "Activate"}</button><button disabled={busy} onClick={() => dayPayload({ soldOut: !override?.soldOut })} className="admin-meal-action min-h-11 rounded-lg border border-border p-2 text-sm font-bold disabled:opacity-50">{override?.soldOut ? "Unmark sold out" : "Mark sold out"}</button><CustomSelect aria-label={`${meal.name} availability`} value={override?.availableOverride == null ? "default" : String(override.availableOverride)} onChange={(event) => dayPayload({ availableOverride: event.target.value === "default" ? null : event.target.value === "true" })} className="input-field text-sm"><option value="default">Weekly schedule</option><option value="true">Available</option><option value="false">Unavailable</option></CustomSelect><label className="text-xs font-bold">Remaining stock<input key={`${date}-${override?.remaining}`} type="number" min="0" max={meal.stockLimit} defaultValue={override?.remaining ?? meal.stockLimit} onBlur={(event) => { const value = Number(event.target.value); if (value !== (override?.remaining ?? meal.stockLimit)) dayPayload({ remaining: value }); }} className="input-field mt-1" /></label><button disabled={busy} onClick={() => { if (window.confirm(`Archive ${meal.name}? Past orders will be kept.`)) change(`/api/admin/meals/${meal.slug}`, "DELETE"); }} className="admin-meal-danger min-h-11 rounded-lg border border-danger/30 p-2 text-sm font-bold text-danger disabled:opacity-50 sm:col-span-2">Archive…</button></div></article>;
    })}</div>
    {form && <AdminThaliForm key={editing || form.slug || form.kind} initial={form} editing={editing} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await reload(); setMessage("Menu item saved."); }} />}
  </section>;
}
