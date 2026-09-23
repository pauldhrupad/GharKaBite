"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";

const initialForm = { code: "", type: "percent", value: 10, maxDiscount: 100, minSubtotal: 0, expiresAt: "" };

export default function PromoCodesManager() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/promos", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load promo codes.");
    setPromos(data.promos);
  }

  useEffect(() => {
    fetch("/api/admin/promos", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load promo codes.");
      return data.promos;
    }).then(setPromos).catch((error) => setMessage(error.message));
  }, []);

  async function create(event, generateRandom = false) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/promos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, generateRandom }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create promo code.");
      setForm(initialForm);
      setMessage(`${data.promo.code} created. Share it only with the customers you choose.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function toggle(promo) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/promos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promo.code, active: !promo.active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update promo code.");
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <section id="promotions" className="mt-7 scroll-mt-6 rounded-2xl border border-border bg-white p-5 md:p-6">
    <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Tag className="size-5" /></span><div><h2 className="text-lg font-black">Promo codes</h2><p className="text-xs text-text-secondary">Create a private code. Each account can use each code once.</p></div></div>
    <form onSubmit={(event) => create(event)} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-bold">Your code<input className="input-field mt-2 uppercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="e.g. LUNCH15" maxLength={20} pattern="[A-Za-z0-9-]{4,20}" /></label>
      <label className="text-sm font-bold">Discount type<select className="input-field mt-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></label>
      <label className="text-sm font-bold">{form.type === "percent" ? "Discount (%)" : "Discount (₹)"}<input className="input-field mt-2" type="number" min="1" max={form.type === "percent" ? "100" : "100000"} value={form.value} onChange={(event) => setForm({ ...form, value: Number(event.target.value) })} required /></label>
      {form.type === "percent" && <label className="text-sm font-bold">Maximum discount (₹)<input className="input-field mt-2" type="number" min="1" max="100000" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: Number(event.target.value) })} required /></label>}
      <label className="text-sm font-bold">Minimum meal subtotal (₹)<input className="input-field mt-2" type="number" min="0" max="100000" value={form.minSubtotal} onChange={(event) => setForm({ ...form, minSubtotal: Number(event.target.value) })} required /></label>
      <label className="text-sm font-bold">Expiry date <span className="font-normal text-text-secondary">(optional)</span><input className="input-field mt-2" type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3"><button type="submit" disabled={busy || !form.code} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-50">Create my code</button><button type="button" disabled={busy} onClick={(event) => create(event, true)} className="min-h-11 rounded-xl border border-primary px-5 text-sm font-black text-primary disabled:opacity-50">Generate & save random code</button></div>
    </form>
    {message && <p className="mt-4 text-sm font-bold" role="status">{message}</p>}
    <div className="mt-6 space-y-3"><h3 className="font-black">Saved codes</h3>{promos.length === 0 && <p className="text-sm text-text-secondary">No codes yet.</p>}{promos.map((promo) => <div key={promo.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div className="min-w-0"><p className="break-all font-black text-primary">{promo.code}</p><p className="mt-1 text-xs text-text-secondary">{promo.type === "percent" ? `${promo.value}% off, up to ₹${promo.maxDiscount}` : `₹${promo.value} off`} · Min ₹{promo.minSubtotal} · {promo.uses} used{promo.expiresAt ? ` · Expires ${new Date(promo.expiresAt).toLocaleDateString("en-IN")}` : ""}</p></div><button type="button" disabled={busy} onClick={() => toggle(promo)} className={`min-h-10 rounded-lg px-4 text-xs font-black ${promo.active ? "border border-danger text-danger" : "border border-primary text-primary"}`}>{promo.active ? "Disable" : "Enable"}</button></div>)}</div>
  </section>;
}
