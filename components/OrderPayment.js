"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageCircle, Upload } from "lucide-react";
import PaymentOptions, { availableChannels } from "./PaymentOptions";
import { whatsappUrl } from "@/lib/payment-settings";
import { formatOrderTimestamp } from "@/lib/order-utils";

export default function OrderPayment({ orderId }) {
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [showProof, setShowProof] = useState(false);

  useEffect(() => {
    Promise.all([fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" }), fetch("/api/payment-settings", { cache: "no-store" })]).then(async ([orderResponse, paymentResponse]) => {
      if (!orderResponse.ok) throw new Error("Order not found or unavailable.");
      const orderData = await orderResponse.json();
      setOrder(orderData.order);
      if (paymentResponse.ok || orderData.order.paymentDetails) { const data = paymentResponse.ok ? await paymentResponse.json() : null; const details = orderData.order.paymentDetails || data?.payment; setPayment(details); setChannel(availableChannels(details).includes(orderData.order.paymentChannel) ? orderData.order.paymentChannel : availableChannels(details)[0] || ""); }
    }).catch((failure) => setError(failure.message)).finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (order?.paymentStatus !== "verification_pending") return undefined;
    const timer = window.setInterval(() => { fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.order) setOrder(data.order); }).catch(() => {}); }, 15000);
    return () => window.clearInterval(timer);
  }, [order?.paymentStatus, orderId]);

  async function submitWebsite(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!screenshot) throw new Error("Choose a payment screenshot.");
      if (screenshot.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(screenshot.type)) throw new Error("Choose a JPG, PNG or WebP screenshot up to 5 MB.");
      const signatureResponse = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment-proof`, { cache: "no-store" });
      const signed = await signatureResponse.json(); if (!signatureResponse.ok) throw new Error(signed.message);
      const upload = new FormData(); upload.set("file", screenshot); upload.set("api_key", signed.apiKey); upload.set("timestamp", signed.timestamp); upload.set("public_id", signed.publicId); upload.set("type", signed.type); upload.set("signature", signed.signature);
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloud)}/image/upload`, { method: "POST", body: upload });
      const uploaded = await uploadResponse.json(); if (!uploadResponse.ok) throw new Error(uploaded.error?.message || "Screenshot upload failed.");
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "website", paymentReference: reference, paymentNote: note, screenshotUrl: uploaded.secure_url }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setOrder(data.order); setNotice(data.message); setShowProof(false);
    } catch (failure) { setError(failure.message || "Could not submit payment proof."); }
    finally { setBusy(false); }
  }

  async function submitWhatsApp() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment-proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "whatsapp" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setOrder(data.order); setNotice(data.message);
    } catch (failure) { setError(failure.message || "Could not update payment status."); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="container-shell py-10"><div className="h-96 animate-pulse rounded-2xl bg-surface-muted" /></main>;
  if (!order) return <main className="container-shell py-10"><p role="alert">{error || "Order not found."}</p><Link href="/orders" className="mt-4 inline-block font-black text-primary underline">My Orders</Link></main>;
  if (order.paymentMethod !== "manual_online") return <main className="container-shell py-10"><p>This order uses Cash on Delivery.</p><Link href={`/orders/${orderId}`} className="font-black text-primary underline">View order</Link></main>;
  const canSubmit = ["pending", "rejected"].includes(order.paymentStatus) && order.orderStatus !== "cancelled";
  const proofUrl = whatsappUrl(payment?.businessWhatsApp, `Hi GharKaBite,\n\nI have completed payment for my order.\n\nOrder Number: ${order.orderNumber}\nAmount: ₹${order.total}\n\nI am sending the payment screenshot here for verification.`);
  const helpUrl = whatsappUrl(payment?.businessWhatsApp, `Hi GharKaBite, I need help completing payment for Order ${order.orderNumber}.`);
  return <main className="container-shell max-w-5xl py-8 md:py-12"><p className="eyebrow">Online Payment</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">Complete Your Payment</h1><p className="mt-2 break-all text-sm text-text-secondary">Order {order.orderNumber}</p></div><p className="text-4xl font-black text-primary">₹{Number(order.total).toLocaleString("en-IN")}</p></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">{[["Order created", "Complete"], ["Payment submitted", order.paymentStatus === "pending" || order.paymentStatus === "rejected" ? "Waiting" : "Complete"], ["Order confirmed", order.paymentStatus === "paid" ? "Complete" : "Waiting"]].map(([label, state]) => <div key={label} className="rounded-xl border border-border bg-white p-4"><p className="text-sm font-black">{label}</p><p className={`mt-1 text-xs font-bold ${state === "Complete" ? "text-success" : "text-text-secondary"}`}>{state}</p></div>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]"><div className="space-y-6">
      {order.paymentStatus === "paid" ? <section className="card-surface p-6"><CheckCircle2 className="size-8 text-success" /><h2 className="mt-3 text-xl font-black">Payment Verified ✓</h2><p className="mt-2 text-sm text-text-secondary">Your payment has been verified and your order is confirmed.</p><Link href={`/orders/${orderId}`} className="mt-4 inline-flex font-black text-primary underline">Track your order</Link></section> : order.paymentStatus === "verification_pending" ? <section className="card-surface p-6"><Clock3 className="size-8 text-warning" /><h2 className="mt-3 text-xl font-black">Payment Submitted for Verification</h2><p className="mt-2 text-sm text-text-secondary">We&apos;ve received your payment details. Your order will be confirmed after verification.</p><p className="mt-3 text-sm font-bold">Proof: {order.paymentProofMethod === "whatsapp" ? "WhatsApp" : "Website"}{order.paymentReference ? ` · UTR ${order.paymentReference}` : ""}</p>{order.paymentProofMethod === "website" && <a href={`/api/orders/${encodeURIComponent(orderId)}/payment-screenshot`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-primary underline">View submitted screenshot</a>}</section> : order.orderStatus === "cancelled" ? <section className="card-surface p-6"><h2 className="text-xl font-black">Order cancelled</h2><p className="mt-2 text-sm text-text-secondary">Contact us if you need assistance with a payment already sent.</p></section> : <>
        {order.paymentStatus === "rejected" && <section className="rounded-2xl border border-danger/30 bg-danger/8 p-5"><h2 className="font-black text-danger">Payment Could Not Be Verified</h2><p className="mt-2 text-sm">Reason: {order.paymentRejectionReason || "Please contact us for details."}</p><p className="mt-2 text-sm">Resubmit new payment details below or contact us on WhatsApp.</p></section>}
        <section className="card-surface p-5 md:p-7"><PaymentOptions payment={payment} channel={channel} onChange={setChannel} amount={order.total} orderNumber={order.orderNumber} /><p className="mt-4 rounded-xl bg-warning/10 p-3 text-xs font-bold">Do not pay a different amount unless instructed by GharKaBite.</p></section>
        <section className="card-surface p-5 md:p-7"><h2 className="text-xl font-black">Submit Payment Details</h2><p className="mt-2 text-sm text-text-secondary">After paying, keep your screenshot and Transaction ID / UTR. Your order stays payment pending until we verify it.</p><button type="button" onClick={() => setShowProof(true)} className="mt-4 min-h-11 rounded-xl bg-primary px-5 text-sm font-black text-white">{order.paymentStatus === "rejected" ? "Resubmit Payment Details" : "I Have Paid · Send Payment Proof"}</button>{showProof && <form onSubmit={submitWebsite} className="mt-5 space-y-4 rounded-xl border border-border p-4"><label className="block text-sm font-bold">Transaction ID / UTR<input required minLength={6} maxLength={50} value={reference} onChange={(event) => setReference(event.target.value)} className="input-field mt-2" placeholder="Enter the ID shown in your payment app" /></label><label className="block text-sm font-bold">Payment Screenshot<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} className="input-field mt-2" /></label><p className="text-xs text-text-secondary">JPG, PNG or WebP · up to 5 MB</p><label className="block text-sm font-bold">Optional Note<textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="input-field mt-2 min-h-20" /></label><button disabled={busy} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-white disabled:opacity-50"><Upload className="size-4" />{busy ? "Submitting…" : "Submit for verification"}</button></form>}</section>
        {proofUrl && <section className="card-surface p-5 md:p-7"><h2 className="text-lg font-black">Send proof on WhatsApp instead</h2><p className="mt-2 text-sm text-text-secondary">Open the chat and attach your screenshot manually. Then return here and tell us you sent it.</p><a href={proofUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary px-4 text-sm font-black text-primary"><MessageCircle className="size-4" /> Send Payment Proof on WhatsApp</a><button type="button" onClick={submitWhatsApp} disabled={busy} className="mt-3 block min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">I Sent Payment Proof on WhatsApp</button></section>}
      </>}
      {notice && <p role="status" className="rounded-xl bg-success/10 p-4 text-sm font-bold text-success">{notice}</p>}{error && <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm font-bold text-danger">{error}</p>}
    </div><aside className="card-surface h-fit p-5"><h2 className="font-black">Payment summary</h2><p className="mt-3 text-sm">Order: <strong>{order.orderNumber}</strong></p><p className="mt-2 text-sm">Amount: <strong>₹{order.total}</strong></p><p className="mt-2 text-sm">Payment: <strong className="capitalize">{order.paymentStatus.replaceAll("_", " ")}</strong></p><p className="mt-2 text-sm">Order: <strong className="capitalize">{order.orderStatus.replaceAll("_", " ")}</strong></p><p className="mt-2 text-sm">Selected: <strong>{({ qr: "Scan QR", upi_id: "UPI ID", phone: "Phone Number" })[order.paymentChannel] || "Online Payment"}</strong></p><p className="mt-2 text-xs text-text-secondary">Placed {formatOrderTimestamp(order.createdAt)}</p><ol className="mt-5 list-inside list-decimal space-y-2 text-sm leading-6 text-text-secondary"><li>Pay the exact amount.</li><li>Use the QR, UPI ID or phone shown.</li><li>Keep your screenshot and UTR.</li><li>Submit payment details.</li><li>Wait for GharKaBite to verify.</li></ol>{helpUrl && <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-black text-primary underline">Need help with payment? Chat on WhatsApp</a>}<Link href={`/orders/${orderId}`} className="mt-5 block text-sm font-black text-primary underline">View order details</Link></aside></div>
  </main>;
}
