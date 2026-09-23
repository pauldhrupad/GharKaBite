"use client";
/* eslint-disable @next/next/no-img-element -- Preview the uploaded QR without image transformations. */

import { useEffect, useState } from "react";
import { CreditCard, Upload } from "lucide-react";

const empty = { upiDisplayName: "", upiId: "", upiPhoneNumber: "", upiQrImage: "", businessWhatsApp: "", onlinePaymentEnabled: false, codEnabled: true };

export default function PaymentSettingsForm() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/admin/payment-settings").then(async (response) => { if (!response.ok) throw new Error("Unable to load payment settings."); return response.json(); }).then((data) => setForm(data.payment)).catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function uploadQr(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image up to 5 MB.");
      const signatureResponse = await fetch("/api/admin/payment-settings/qr", { cache: "no-store" });
      const signed = await signatureResponse.json();
      if (!signatureResponse.ok) throw new Error(signed.message);
      const body = new FormData(); body.set("file", file); body.set("api_key", signed.apiKey); body.set("timestamp", signed.timestamp); body.set("public_id", signed.publicId); body.set("signature", signed.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloud)}/image/upload`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "QR upload failed.");
      setForm((current) => ({ ...current, upiQrImage: data.secure_url }));
      setMessage("QR uploaded. Save changes to publish it.");
    } catch (error) { setMessage(error.message || "QR upload failed."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/payment-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setForm(data.payment); setMessage("Payment information saved.");
    } catch (error) { setMessage(error.message || "Unable to save."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="mt-7 h-44 animate-pulse rounded-2xl bg-surface-muted" />;
  return <form onSubmit={save} className="mt-8 rounded-2xl border border-border bg-white p-5 md:p-6"><div className="flex items-center gap-3"><CreditCard className="size-6 text-primary" /><div><h2 className="text-xl font-black">Payment Information</h2><p className="text-sm text-text-secondary">Customers see only your enabled payment methods. Verify every online payment yourself.</p></div></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {[["UPI Display Name", "upiDisplayName", "GharKaBite"], ["UPI ID", "upiId", "name@upi"], ["UPI-linked Phone Number", "upiPhoneNumber", "10-digit number"], ["Business WhatsApp Number", "businessWhatsApp", "10-digit number or 91 prefix"]].map(([label, key, placeholder]) => <label key={key} className="text-sm font-bold">{label}<input className="input-field mt-2" value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} maxLength={100} /></label>)}
    </div>
    <div className="mt-5"><p className="text-sm font-bold">Payment QR Image</p>{form.upiQrImage ? <div className="mt-3 flex flex-wrap items-center gap-4"><img src={form.upiQrImage} alt="Current UPI payment QR" className="size-48 rounded-xl border border-border object-contain p-2" /><button type="button" onClick={() => setForm({ ...form, upiQrImage: "" })} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-danger">Remove QR</button></div> : <p className="mt-2 text-sm text-text-secondary">No QR uploaded yet.</p>}<label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-primary px-4 text-sm font-black text-primary"><Upload className="size-4" /> {form.upiQrImage ? "Replace QR" : "Upload QR"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadQr} disabled={busy} className="sr-only" /></label><p className="mt-2 text-xs text-text-secondary">JPG, PNG or WebP, up to 5 MB.</p></div>
    <div className="mt-6 flex flex-wrap gap-5">{[["Online Payment Enabled", "onlinePaymentEnabled"], ["Cash on Delivery Enabled", "codEnabled"]].map(([label, key]) => <label key={key} className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="size-5 accent-primary" />{label}</label>)}</div>
    {message && <p role="status" className="mt-4 text-sm font-bold text-text-secondary">{message}</p>}
    <button type="submit" disabled={busy} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save Changes"}</button>
  </form>;
}
