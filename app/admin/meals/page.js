"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import CustomSelect from "@/components/CustomSelect";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const badges = ["Popular", "Low Oil", "Limited", "Today's Special"];
const images = ["bengali-thali", "veg-meal", "dal-rice", "chicken-meal"].map((name) => `/images/${name}.jpg`).concat("/images/kolkata-home-meal.png");
const blank = { name: "", shortDescription: "", description: "", price: 119, category: "Veg", mealType: "Rice Meal", contents: "", slots: ["Lunch", "Dinner"], availableDays: [0, 1, 2, 3, 4, 5, 6], stockLimit: 10, active: true, featured: false, badges: [], image: images[0] };
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
    const [a, b] = await Promise.all([fetch("/api/admin/meals"), fetch(`/api/admin/daily-menu?date=${date}`)]);
    if (a.ok) setMeals((await a.json()).meals || []);
    if (b.ok) setDaily((await b.json()).overrides || []);
  }, [date]);
  useEffect(() => { const timer = window.setTimeout(() => reload().catch(() => setMessage("Unable to load meals.")), 0); return () => window.clearTimeout(timer); }, [reload]);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggle = (field, value) => setForm((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }));
  function open(meal) { setEditing(meal?.slug || null); setForm(meal ? { ...meal, contents: meal.contents.join("\n") } : { ...blank }); setMessage(""); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const payload = { ...form, contents: form.contents.split("\n").map((value) => value.trim()).filter(Boolean), price: Number(form.price), stockLimit: Number(form.stockLimit) };
      const response = await fetch(editing ? `/api/admin/meals/${editing}` : "/api/admin/meals", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setForm(null); await reload(); setMessage("Meal saved.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function upload(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch("/api/admin/meals/upload", { method: "POST", body: data });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setForm((current) => ({ ...current, image: result.image, imagePublicId: result.imagePublicId }));
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function change(url, method, payload) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      await reload(); setMessage(result.message || "Menu updated.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Kitchen catalogue</p><h1 className="mt-1 text-3xl font-black">Meals</h1><p className="text-sm text-text-secondary">Manage meals, availability and daily stock.</p></div><button onClick={() => open(null)} className="rounded-xl bg-primary px-4 py-3 text-sm font-black text-white">Add meal</button></div>
    <div className="mt-5 flex gap-2">{[0, 1].map((offset) => <button key={offset} onClick={() => setDate(dateAt(offset))} className={`rounded-xl px-4 py-2 text-sm font-bold ${date === dateAt(offset) ? "bg-primary text-white" : "border border-border bg-white"}`}>{offset ? "Tomorrow" : "Today"}</button>)}</div>
    {message && <p className="mt-4 rounded-xl bg-white p-3 text-sm font-bold" role="status">{message}</p>}
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{meals.map((meal) => {
      const override = daily.find((item) => String(item.meal) === String(meal._id));
      const dayPayload = (patch) => change("/api/admin/daily-menu", "PATCH", { mealId: meal.slug, date, ...patch });
      return <article key={meal.slug} className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex gap-4 p-4"><div className="relative size-24 shrink-0 overflow-hidden rounded-xl"><Image src={meal.image} alt="" fill sizes="96px" className="object-cover" /></div><div><h2 className="font-black">{meal.name}</h2><p className="text-sm text-text-secondary">₹{meal.price} · {meal.category}</p><p className="text-xs text-text-secondary">Remaining {override?.remaining ?? meal.stockLimit}/{meal.stockLimit}</p><p className="text-xs font-bold">{meal.active ? "Active" : "Inactive"}{override?.soldOut ? " · Sold out" : ""}</p></div></div><div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2"><button disabled={busy} onClick={() => open(meal)} className="rounded-lg border border-border p-2 text-sm font-bold">Edit</button><button disabled={busy} onClick={() => change(`/api/admin/meals/${meal.slug}`, "PATCH", { active: !meal.active })} className="rounded-lg border border-border p-2 text-sm font-bold">{meal.active ? "Deactivate" : "Activate"}</button><CustomSelect aria-label={`${meal.name} availability`} value={override?.availableOverride === null || override?.availableOverride === undefined ? "default" : String(override.availableOverride)} onChange={(event) => dayPayload({ availableOverride: event.target.value === "default" ? null : event.target.value === "true" })} className="input-field text-sm"><option value="default">Weekly schedule</option><option value="true">Available</option><option value="false">Unavailable</option></CustomSelect><button disabled={busy} onClick={() => dayPayload({ soldOut: !override?.soldOut })} className="rounded-lg border border-border p-2 text-sm font-bold">{override?.soldOut ? "Unmark sold out" : "Mark sold out"}</button><label className="text-xs font-bold">Remaining stock<input key={`${date}-${override?.remaining}`} type="number" name={`remaining-${meal.slug}`} min="0" max={meal.stockLimit} step="1" inputMode="numeric" defaultValue={override?.remaining ?? meal.stockLimit} onBlur={(event) => { const value = Number(event.target.value); if (value !== (override?.remaining ?? meal.stockLimit)) dayPayload({ remaining: value }); }} className="input-field mt-1" /></label><button disabled={busy} onClick={() => { if (window.confirm(`Delete ${meal.name}? Past orders will be kept.`)) change(`/api/admin/meals/${meal.slug}`, "DELETE"); }} className="rounded-lg border border-danger/30 p-2 text-sm font-bold text-danger">Delete…</button></div></article>;
    })}</div>
    {form && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"><form onSubmit={save} className="mx-auto my-5 max-w-3xl space-y-4 rounded-2xl bg-white p-5 sm:p-7"><div className="flex justify-between"><h2 className="text-2xl font-black">{editing ? "Edit meal" : "Add meal"}</h2><button type="button" onClick={() => setForm(null)}>Close</button></div><div className="grid gap-4 sm:grid-cols-2">{[["name", "Meal name", "e.g. Bengali fish thali"], ["shortDescription", "Short description", "e.g. A comforting seasonal lunch"], ["price", "Price (₹)", "e.g. 149"], ["stockLimit", "Daily stock limit", "e.g. 20"]].map(([field, label, placeholder]) => <label key={field} className="text-sm font-bold">{label}<input required name={field} type={["price", "stockLimit"].includes(field) ? "number" : "text"} min={field === "price" ? 1 : 0} step="1" inputMode={["price", "stockLimit"].includes(field) ? "numeric" : undefined} value={form[field]} onChange={(event) => set(field, event.target.value)} placeholder={placeholder} className="input-field mt-1" /></label>)}<label className="text-sm font-bold">Category<CustomSelect name="category" value={form.category} onChange={(event) => set("category", event.target.value)} className="input-field mt-1">{["Veg", "Egg", "Chicken", "Fish"].map((value) => <option key={value}>{value}</option>)}</CustomSelect></label><label className="text-sm font-bold">Meal type<CustomSelect name="mealType" value={form.mealType} onChange={(event) => set("mealType", event.target.value)} className="input-field mt-1">{["Rice Meal", "Roti Meal", "Comfort Meal", "Light Meal"].map((value) => <option key={value}>{value}</option>)}</CustomSelect></label></div><label className="block text-sm font-bold">Full description<textarea required name="description" value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Describe the meal, flavours and serving style" className="input-field mt-1 min-h-24" /></label><label className="block text-sm font-bold">Contents (one per line)<textarea required name="contents" value={form.contents} onChange={(event) => set("contents", event.target.value)} placeholder={"Steamed rice\nDal\nSeasonal vegetable"} className="input-field mt-1 min-h-24" /></label><fieldset><legend className="text-sm font-black">Meal periods</legend><div className="mt-2 flex gap-4">{["Lunch", "Dinner"].map((value) => <label key={value} className="text-sm"><input type="checkbox" checked={form.slots.includes(value)} onChange={() => toggle("slots", value)} /> {value}</label>)}</div></fieldset><fieldset><legend className="text-sm font-black">Available days</legend><div className="mt-2 flex flex-wrap gap-3">{days.map((label, value) => <label key={label} className="text-sm"><input type="checkbox" checked={form.availableDays.includes(value)} onChange={() => toggle("availableDays", value)} /> {label}</label>)}</div></fieldset><fieldset><legend className="text-sm font-black">Badges</legend><div className="mt-2 flex flex-wrap gap-3">{badges.map((value) => <label key={value} className="text-sm"><input type="checkbox" checked={form.badges.includes(value)} onChange={() => toggle("badges", value)} /> {value}</label>)}</div></fieldset><div className="flex gap-5"><label className="text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} /> Active</label><label className="text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => set("featured", event.target.checked)} /> Featured</label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Local image<CustomSelect name="localImage" value={images.includes(form.image) ? form.image : ""} onChange={(event) => { setForm({ ...form, image: event.target.value, imagePublicId: "" }); }} className="input-field mt-1"><option value="" disabled>Uploaded image</option>{images.map((image) => <option key={image} value={image}>{image.split("/").pop()}</option>)}</CustomSelect></label><label className="text-sm font-bold">Or upload image (max 5 MB)<input type="file" name="mealImage" accept="image/jpeg,image/png,image/webp" onChange={upload} className="mt-2 block w-full text-sm" /></label></div><div className="relative h-40 overflow-hidden rounded-xl bg-surface-muted"><Image src={form.image} alt="Meal preview" fill sizes="700px" className="object-cover" /></div><button disabled={busy} type="submit" className="rounded-xl bg-primary px-6 py-3 font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save meal"}</button>{message && <p role="alert" className="text-sm text-danger">{message}</p>}</form></div>}
  </section>;
}
