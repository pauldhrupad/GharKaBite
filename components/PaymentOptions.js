"use client";
/* eslint-disable @next/next/no-img-element -- QR codes must keep their original pixels. */

import { useState } from "react";
import { Check, Copy, QrCode, Smartphone } from "lucide-react";

export function availableChannels(payment) {
  return [payment?.upiQrImage && "qr", payment?.upiId && "upi_id", payment?.upiPhoneNumber && "phone"].filter(Boolean);
}

export default function PaymentOptions({ payment, channel, onChange, amount, orderNumber }) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  if (!payment) return null;
  const channels = availableChannels(payment);
  if (!channels.length) return <p className="rounded-xl bg-warning/10 p-4 text-sm font-bold">Online payment is temporarily unavailable. Please choose another payment method.</p>;
  async function copy(value, key) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setCopyError(""); window.setTimeout(() => setCopied(""), 1800); }
    catch { setCopied(""); setCopyError("Could not copy automatically. Select and copy the details above."); }
  }
  const labels = { qr: "Scan QR", upi_id: "UPI ID", phone: "Phone Number" };
  const icons = { qr: QrCode, upi_id: Copy, phone: Smartphone };
  return <div><h3 className="text-lg font-black">Choose how you want to pay</h3><p className="mt-1 text-sm leading-6 text-text-secondary">Pay using the details below. Your order will be confirmed after payment verification.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">{channels.map((item) => { const Icon = icons[item]; return <button type="button" key={item} onClick={() => onChange(item)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black ${channel === item ? "border-primary bg-primary/8 text-primary shadow-sm" : "border-border hover:border-primary/40 hover:bg-primary/5"}`} aria-pressed={channel === item}><Icon className="size-4" aria-hidden="true" />{labels[item]}{channel === item && <Check className="size-4" aria-hidden="true" />}</button>; })}</div>
    <p className="sr-only" role="status" aria-live="polite">{copied ? "Payment detail copied." : copyError}</p>
    <div className="mt-4 rounded-2xl border border-border bg-surface-muted p-4 text-sm">
      {channel === "qr" && payment.upiQrImage && <div className="flex flex-col items-center text-center"><img src={payment.upiQrImage} alt="GharKaBite UPI payment QR" className="aspect-square w-full max-w-72 rounded-xl bg-white object-contain p-2" /><p className="mt-3 font-bold">UPI Name: {payment.upiDisplayName || "GharKaBite"}</p><a href={payment.upiQrImage} target="_blank" rel="noopener noreferrer" className="mt-2 font-bold text-primary underline">Enlarge QR</a></div>}
      {channel === "upi_id" && payment.upiId && <div><p className="font-bold">UPI ID</p><p className="mt-1 break-all text-lg font-black">{payment.upiId}</p><button type="button" onClick={() => copy(payment.upiId, "upi")} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-black text-primary">{copied === "upi" ? "Copied ✓" : "Copy UPI ID"}</button>{orderNumber && <a href={`upi://pay?pa=${encodeURIComponent(payment.upiId)}&pn=${encodeURIComponent(payment.upiDisplayName || "GharKaBite")}&am=${encodeURIComponent(String(amount))}&cu=INR&tn=${encodeURIComponent(orderNumber)}`} className="ml-3 inline-flex min-h-11 items-center font-black text-primary underline">Open UPI App</a>}</div>}
      {channel === "phone" && payment.upiPhoneNumber && <div><p className="font-bold">UPI-linked Phone Number</p><p className="mt-1 text-lg font-black">+91 {payment.upiPhoneNumber}</p><button type="button" onClick={() => copy(payment.upiPhoneNumber, "phone")} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-black text-primary">{copied === "phone" ? "Copied ✓" : "Copy Number"}</button></div>}
      <p className="mt-4 border-t border-border pt-3 font-black">Amount: ₹{Number(amount || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-text-secondary">Please pay the exact order amount. The stored order total on the next page is final.</p>
    </div>
  </div>;
}
