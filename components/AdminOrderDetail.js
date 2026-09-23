"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, MapPin, NotebookPen, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { adminStatusOptions } from "@/data/order-statuses";
import { formatOrderTimestamp } from "@/lib/order-utils";

export default function AdminOrderDetail({ orderId, initialOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [selectedStatus, setSelectedStatus] = useState(initialOrder?.orderStatus || "received");
  const [loading, setLoading] = useState(!initialOrder);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  if (loading) return <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />;
  if (!order) return <div className="rounded-2xl border border-border bg-white p-10 text-center"><h1 className="text-2xl font-black">Order not found</h1><p className="mt-2 text-sm text-text-secondary">This order is not available in the demo data or connected database.</p><Link href="/admin/orders" className="mt-5 inline-flex font-black text-primary">Return to orders</Link></div>;

  const address = order.deliveryAddress;
  return (
    <>
      <Link href="/admin/orders" className="inline-flex min-h-10 items-center gap-2 text-sm font-black text-primary"><ArrowLeft className="size-4" aria-hidden="true" /> Back to orders</Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Order detail</p><h1 className="mt-1 text-3xl font-black">{order.orderNumber}</h1><p className="mt-1 text-sm text-text-secondary">Placed {formatOrderTimestamp(order.createdAt)}</p></div><span className="w-fit rounded-full bg-warning/10 px-3 py-1.5 text-xs font-black capitalize text-warning">{order.orderStatus.replaceAll("_", " ")}</span></div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_22rem] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Customer & delivery</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Detail icon={UserRound} label="Customer" value={order.customer.name} /><Detail icon={Phone} label="Phone" value={order.customer.phone} /><Detail icon={Clock3} label="Delivery" value={`${order.mealPeriod} · ${order.deliverySlot}`} /><Detail icon={MapPin} label="Address" value={`${address.house}, ${address.street}, ${address.area}, ${address.city} – ${address.pinCode}`} /></div>{address.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address.location.lat},${address.location.lon}`)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-bold text-primary underline underline-offset-2">Open delivery pin in maps</a>}</section>
          <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="text-lg font-black">Meals</h2></div><div className="divide-y divide-border">{order.items.map((item) => <div key={item.mealId} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-black">{item.name}</p><p className="text-xs text-text-secondary">{item.category} · Quantity {item.quantity}</p></div><p className="font-black">₹{item.price * item.quantity}</p></div>)}</div><div className="space-y-2 border-t border-border bg-surface-muted px-5 py-4 text-sm"><div className="flex justify-between text-text-secondary"><span>Subtotal</span><span>₹{order.subtotal}</span></div><div className="flex justify-between text-text-secondary"><span>Delivery</span><span>₹{order.deliveryFee}</span></div><div className="flex justify-between text-lg font-black"><span>Total</span><span>₹{order.total}</span></div></div></section>
          {order.notes && <section className="rounded-2xl border border-accent/20 bg-accent/7 p-5"><h2 className="flex items-center gap-2 font-black"><NotebookPen className="size-4 text-accent" aria-hidden="true" /> Customer note</h2><p className="mt-2 text-sm leading-6">{order.notes}</p></section>}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Update status</h2><label className="mt-4 block text-sm font-bold">Current stage<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="input-field mt-2">{adminStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><button type="button" onClick={updateStatus} disabled={saving || selectedStatus === order.orderStatus} className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{saving ? "Updating…" : "Update order"}</button>{message && <p className="mt-3 text-xs font-bold text-text-secondary" aria-live="polite">{message}</p>}</section>
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="text-lg font-black">Order timeline</h2><ol className="mt-4 space-y-4">{order.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.timestamp}-${index}`} className="relative flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" /><div><p className="text-sm font-black capitalize">{entry.status.replaceAll("_", " ")}</p><p className="text-xs text-text-secondary">{formatOrderTimestamp(entry.timestamp)}</p></div></li>)}</ol></section>
          <section className="rounded-2xl border border-border bg-white p-5"><h2 className="font-black">Payment</h2><p className="mt-2 text-sm text-text-secondary">{order.paymentMethod} · <span className="capitalize">{order.paymentStatus}</span></p></section>
        </aside>
      </div>
    </>
  );
}

function Detail({ icon: Icon, label, value }) {
  return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-xs font-bold text-text-secondary">{label}</p><p className="mt-0.5 text-sm font-black leading-5">{value}</p></div></div>;
}
