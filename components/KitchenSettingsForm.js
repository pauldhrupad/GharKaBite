"use client";

import { useState } from "react";
import { Clock3, Save, Truck } from "lucide-react";
import Button from "./Button";
import { useKitchen } from "@/context/KitchenContext";

export default function KitchenSettingsForm() {
  const { settings, hydrated, updateSettings } = useKitchen();
  if (!hydrated) return <div className="mt-7 h-64 animate-pulse rounded-2xl bg-surface-muted" />;
  return <KitchenSettingsEditor initialSettings={settings} updateSettings={updateSettings} />;
}

function KitchenSettingsEditor({ initialSettings, updateSettings }) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (response.ok) {
        const data = await response.json();
        updateSettings(data.settings);
        setMessage("Kitchen settings saved to the database.");
      } else setMessage("Unable to save kitchen settings. Please try again.");
    } catch {
      setMessage("Unable to save kitchen settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-white p-5 md:p-6"><h2 className="text-lg font-black">Accepting orders</h2><p className="mt-1 text-xs text-text-secondary">Pause all ordering or one meal period without changing the menu.</p><div className="mt-5 space-y-3">{[["acceptingOrders", "Accepting orders"], ["lunchEnabled", "Lunch orders enabled"], ["dinnerEnabled", "Dinner orders enabled"]].map(([name, label]) => <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm font-bold"><input type="checkbox" name={name} checked={form[name] !== false} onChange={updateField} />{label}</label>)}</div></section>

      <section className="rounded-2xl border border-border bg-white p-5 md:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Clock3 className="size-5" aria-hidden="true" /></span><div><h2 className="text-lg font-black">Order cutoffs</h2><p className="text-xs text-text-secondary">Times use the Asia/Kolkata timezone.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><SettingField label="Lunch ordering cutoff" name="lunchCutoff" type="time" value={form.lunchCutoff} onChange={updateField} /><SettingField label="Dinner ordering cutoff" name="dinnerCutoff" type="time" value={form.dinnerCutoff} onChange={updateField} /></div><p className="mt-4 rounded-xl bg-surface-muted p-3 text-xs font-semibold leading-5 text-text-secondary">Customer menu and checkout availability automatically use these cutoff times.</p></section>

      <section className="rounded-2xl border border-border bg-white p-5 md:p-6 xl:col-span-2"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-success/10 text-success"><Truck className="size-5" aria-hidden="true" /></span><div><h2 className="text-lg font-black">Free delivery</h2><p className="text-xs text-text-secondary">Set the minimum meal subtotal for free local delivery.</p></div></div><div className="mt-5 max-w-xs"><SettingField label="Minimum order amount (₹)" name="freeDeliveryThreshold" type="number" min="0" max="100000" value={form.freeDeliveryThreshold ?? 399} onChange={updateField} /></div><p className="mt-3 text-xs text-text-secondary">Set ₹0 to make delivery free on every order. Meal-plan credit orders remain delivery-free.</p></section>

      <div className="xl:col-span-2"><Button type="submit" disabled={saving} className="min-w-40 disabled:opacity-55"><Save className="size-4" aria-hidden="true" /> {saving ? "Saving…" : "Save settings"}</Button>{message && <p className="ml-0 mt-3 text-sm font-bold text-success sm:ml-4 sm:mt-0 sm:inline">{message}</p>}</div>
    </form>
  );
}

function SettingField({ label, ...props }) {
  return <label className="text-sm font-bold">{label}<input className="input-field mt-2" inputMode={props.type === "number" ? "numeric" : undefined} step={props.type === "number" ? 1 : undefined} required {...props} /></label>;
}
