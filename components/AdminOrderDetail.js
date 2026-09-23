"use client";
/* eslint-disable @next/next/no-img-element -- Payment proof is served from an authenticated no-store route. */

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, MapPin, NotebookPen, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { adminStatusOptions } from "@/data/order-statuses";
import { formatOrderTimestamp, isOrderComplete } from "@/lib/order-utils";
import { whatsappUrl } from "@/lib/payment-settings";
import CustomSelect from "./CustomSelect";
import ThaliOrderDetails from "./ThaliOrderDetails";

export default function AdminOrderDetail({ orderId, initialOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [selectedStatus, setSelectedStatus] = useState(initialOrder?.orderStatus || "received");
  const [loading, setLoading] = useState(!initialOrder);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [verificationAction, setVerificationAction] = useState("");
  const [rejectionReason, setRejectionReason] = useState("Transaction not found");
  const [businessWhatsApp, setBusinessWhatsApp] = useState("");

  useEffect(() => { fetch("/api/payment-settings").then((response) => response.ok ? response.json() : null).then((data) => setBusinessWhatsApp(data?.payment?.businessWhatsApp || "")).catch(() => {}); }, []);

  useEffect(() => {
    if (initialOrder) return undefined;
    let active = true;
    fetch(`/api/orders/${encodeURIComponent(orderId)}`).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      if (active) {
        setOrder(data.order);
        setSelectedStatus(data.order.orderStatus);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialOrder, orderId]);

  async function updateStatus() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${order.orderNumber}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: selectedStatus }) });
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        setMessage("Order status updated in the database.");
      } else {
        const data = await response.json();
        setMessage(data.message || "Status could not be updated.");
      }
    } catch {
      setMessage("Status could not be updated right now.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCashReceived() {
    setSavingPayment(true);
    setPaymentMessage("");
    try {
      const response = await fetch(`/api/orders/${order.orderNumber}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_cod_received" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not confirm the cash payment.");
      setOrder(data.order);
      setConfirmingPayment(false);
      setPaymentMessage("Cash received. This order is complete.");
    } catch (error) {
      setPaymentMessage(error.message || "Could not confirm the cash payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function verifyOnlinePayment() {
    setSavingPayment(true); setPaymentMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-verification`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: verificationAction, reason: rejectionReason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not update this payment.");
      setOrder(data.order); setSelectedStatus(data.order.orderStatus); setVerificationAction(""); setPaymentMessage(data.message);
    } catch (error) { setPaymentMessage(error.message || "Could not update this payment."); }
    finally { setSavingPayment(false); }
  }

  if (loading) return <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />;
  if (!order) return <div className="rounded-2xl border border-border bg-white p-10 text-center"><h1 className="text-2xl font-black">Order not found</h1><p className="mt-2 text-sm text-text-secondary">This order is not available in the database.</p><Link href="/admin/orders" className="mt-5 inline-flex font-black text-primary">Return to orders</Link></div>;

  const address = order.deliveryAddress;
  const completed = isOrderComplete(order);
  return (
    <>
      <Link href="/admin/orders" className="inline-flex min-h-10 items-center gap-2 text-sm font-black text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Back to orders</Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Order detail</p><h1 className="mt-1 text-3xl font-black">{order.orderNumber}</h1><p className="mt-1 text-sm text-text-secondary">Placed {formatOrderTimestamp(order.createdAt)}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black capitalize ${completed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{completed ? "Completed" : order.orderStatus.replaceAll("_", " ")}</span></div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_22rem] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Customer & delivery</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Detail icon={UserRound} label="Customer" value={order.customer.name} /><Detail icon={Phone} label="Phone" value={order.customer.phone} /><Detail icon={Clock3} label="Delivery" value={`${order.mealPeriod} · ${order.deliverySlot}`} /><Detail icon={MapPin} label="Address" value={`${address.house}, ${address.street}, ${address.area}, ${address.city} – ${address.pinCode}`} /></div>{address.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address.location.lat},${address.location.lon}`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-bold text-primary underline underline-offset-2">Open delivery pin in maps</a>}</section>
          <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="text-lg font-black">Thalis to prepare</h2></div><div className="divide-y divide-border">{order.items.map((item, index) => <div key={`${item.mealId}-${index}`} className="flex items-start justify-between gap-4 px-5 py-4"><div><p className="font-black">{item.name} ×{item.quantity}</p><p className="text-xs text-text-secondary">{item.category} · Extras shown per Thali</p><ThaliOrderDetails item={item} /></div><p className="shrink-0 font-black">₹{item.price * item.quantity}</p></div>)}</div><div className="space-y-2 border-t border-border bg-surface-muted px-5 py-4 text-sm"><div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>₹{order.subtotal}</span></div>{order.discount > 0 && <div className="flex justify-between gap-3 text-success"><span>{order.promoCode ? `Discounts (incl. ${order.promoCode})` : "Plan credit / discount"}</span><span>−₹{order.discount}</span></div>}<div className="flex justify-between text-text-secondary"><span>Delivery</span><span>₹{order.deliveryFee}</span></div><div className="flex justify-between text-lg font-black"><span>Total</span><span>₹{order.total}</span></div></div></section>
          {order.notes && <section className="rounded-2xl border border-accent/20 bg-accent/7 p-5"><h2 className="flex items-center gap-2 font-black"><NotebookPen className="size-4 text-accent" aria-hidden="true" /> Customer note</h2><p className="mt-2 text-sm leading-6">{order.notes}</p></section>}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Update status</h2><label className="mt-4 block text-sm font-bold">Current stage<CustomSelect value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} disabled={completed} className="input-field mt-2 disabled:opacity-60">{adminStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</CustomSelect></label><button type="button" onClick={updateStatus} disabled={saving || completed || selectedStatus === order.orderStatus} className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{saving ? "Updating…" : "Update order"}</button>{completed && <p className="mt-2 text-xs text-text-secondary">Delivery and payment are complete.</p>}{message && <p className="mt-3 text-xs font-bold text-text-secondary" aria-live="polite">{message}</p>}</section>
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Order timeline</h2><ol className="mt-4 space-y-4">{order.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.timestamp}-${index}`} className="relative flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" /><div><p className="text-sm font-black capitalize">{entry.status.replaceAll("_", " ")}</p><p className="text-xs text-text-secondary">{formatOrderTimestamp(entry.timestamp)}</p></div></li>)}</ol></section>
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-black">{order.paymentMethod === "manual_online" ? "Payment Verification" : "Payment"}</h2><p className="mt-2 text-sm text-text-secondary">{order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"} · <span className={`font-black capitalize ${order.paymentStatus === "paid" ? "text-success" : ""}`}>{order.paymentStatus.replaceAll("_", " ")}</span></p>{order.paymentMethod === "manual_online" && <><dl className="mt-4 space-y-2 text-sm"><div><dt className="font-bold">Order</dt><dd className="break-all">{order.orderNumber}</dd></div><div><dt className="font-bold">Customer</dt><dd>{order.customer.name} · {order.customer.phone}</dd></div><div><dt className="font-bold">Amount</dt><dd>₹{order.total}</dd></div><div><dt className="font-bold">Payment option</dt><dd>{({ qr: "Scan QR", upi_id: "UPI ID", phone: "Phone Number" })[order.paymentChannel] || "Online Payment"}</dd></div><div><dt className="font-bold">Proof method</dt><dd className="capitalize">{order.paymentProofMethod || "Not submitted"}</dd></div>{order.paymentReference && <div><dt className="font-bold">Transaction ID / UTR</dt><dd className="break-all">{order.paymentReference}</dd></div>}{order.paymentSubmittedAt && <div><dt className="font-bold">Submitted</dt><dd>{formatOrderTimestamp(order.paymentSubmittedAt)}</dd></div>}</dl>{order.paymentProofMethod === "website" && <><a href={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-border"><img src={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} alt="Customer payment screenshot" className="max-h-80 w-full object-contain" /></a><a href={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-bold text-primary underline">Open Full Image</a></>}{order.paymentProofMethod === "whatsapp" && <p className="mt-3 text-sm text-text-secondary">Customer reported sending payment proof through WhatsApp. Check your Business WhatsApp before verifying.</p>}{order.paymentNote && <p className="mt-3 text-sm"><strong>Customer note:</strong> {order.paymentNote}</p>}{order.paymentRejectionReason && <p className="mt-3 text-sm text-danger">Rejection reason: {order.paymentRejectionReason}</p>}{order.paymentVerifiedAt && <p className="mt-3 text-xs text-text-secondary">Verified {formatOrderTimestamp(order.paymentVerifiedAt)}</p>}{order.paymentStatus === "verification_pending" && <div className="mt-4 grid gap-2"><button type="button" onClick={() => setVerificationAction("confirm")} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-white">Confirm Payment</button><button type="button" onClick={() => setVerificationAction("reject")} className="min-h-11 rounded-xl border border-danger px-4 text-sm font-black text-danger">Reject Payment</button></div>}</>}{order.paymentReceivedAt && order.paymentMethod === "COD" && <p className="mt-2 text-xs text-text-secondary">Cash received {formatOrderTimestamp(order.paymentReceivedAt)}</p>}{order.paymentMethod === "COD" && order.paymentStatus === "pending" && order.orderStatus !== "cancelled" && (order.orderStatus === "delivered" ? <><p className="mt-3 text-xs text-text-secondary">Confirm only after you have collected ₹{order.total} in cash.</p><button type="button" onClick={() => { setPaymentMessage(""); setConfirmingPayment(true); }} disabled={savingPayment} className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">Record cash received</button></> : <p className="mt-3 text-xs text-text-secondary">Mark the order as delivered before confirming cash received.</p>)}{paymentMessage && <p className="mt-3 text-xs font-bold text-text-secondary" role="status">{paymentMessage}</p>}</section>
          {order.paymentProofMethod === "whatsapp" && (order.paymentDetails?.businessWhatsApp || businessWhatsApp) && <a href={whatsappUrl(order.paymentDetails?.businessWhatsApp || businessWhatsApp, `Hi, I am checking payment proof for GharKaBite order ${order.orderNumber}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-primary bg-white px-4 text-sm font-black text-primary">Open Business WhatsApp</a>}
        </aside>
      </div>
      {confirmingPayment && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="cash-confirm-title" aria-describedby="cash-confirm-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="cash-confirm-title" className="text-xl font-black">Confirm cash received?</h2><p id="cash-confirm-description" className="mt-3 text-sm leading-6 text-text-secondary">Only mark order {order.orderNumber} as paid if you have collected ₹{order.total} in cash. This will complete the order.</p>{paymentMessage && <p className="mt-3 text-sm font-bold text-danger" role="alert">{paymentMessage}</p>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={() => setConfirmingPayment(false)} disabled={savingPayment} className="min-h-11 rounded-xl border border-border px-4 text-sm font-black disabled:opacity-50">Cancel</button><button type="button" onClick={confirmCashReceived} disabled={savingPayment} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">{savingPayment ? "Saving…" : `Yes, ₹${order.total} received`}</button></div></section></div>}
      {verificationAction && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">{verificationAction === "confirm" ? "Confirm Payment?" : "Reject Payment?"}</h2><p className="mt-3 text-sm leading-6 text-text-secondary">{verificationAction === "confirm" ? `Confirm that ₹${order.total} has been received for Order ${order.orderNumber}? Check your bank or UPI account first.` : `Reject payment proof for ${order.orderNumber}? The customer can resubmit.`}</p>{verificationAction === "reject" && <label className="mt-4 block text-sm font-bold">Reason<CustomSelect value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="input-field mt-2">{["Transaction not found", "Wrong amount paid", "Invalid payment proof", "Screenshot unclear", "Duplicate transaction ID", "Other"].map((reason) => <option key={reason}>{reason}</option>)}</CustomSelect></label>}{paymentMessage && <p role="alert" className="mt-3 text-sm font-bold text-danger">{paymentMessage}</p>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={() => setVerificationAction("")} disabled={savingPayment} className="min-h-11 rounded-xl border border-border px-4 text-sm font-black">Cancel</button><button type="button" onClick={verifyOnlinePayment} disabled={savingPayment} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-white disabled:opacity-50">{savingPayment ? "Saving…" : verificationAction === "confirm" ? "Confirm Payment" : "Reject Payment"}</button></div></section></div>}
    </>
  );
}

function Detail({ icon: Icon, label, value }) {
  return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-xs font-bold text-text-secondary">{label}</p><p className="mt-0.5 text-sm font-black leading-5">{value}</p></div></div>;
}
