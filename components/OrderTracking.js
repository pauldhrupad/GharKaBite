"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, ChefHat, CircleCheckBig, Clock3, CookingPot, House, MapPin, PackageCheck, ReceiptText, Truck } from "lucide-react";
import Badge from "./Badge";
import Button from "./Button";
import EmptyState from "./EmptyState";
import ThaliOrderDetails from "./ThaliOrderDetails";
import { orderStatuses } from "@/data/order-statuses";
import { formatOrderTimestamp, getStatusIndex } from "@/lib/order-utils";

const statusIcons = [ReceiptText, CircleCheckBig, CookingPot, PackageCheck, Truck, House];

export default function OrderTracking({ orderId }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadOrder = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
        if (response.ok) {
          const data = await response.json();
          if (active) setOrder(data.order);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 0);
    return () => { active = false; window.clearTimeout(loadOrder); };
  }, [orderId]);

  useEffect(() => {
    if (order?.paymentMethod !== "manual_online" || !["pending", "verification_pending", "rejected"].includes(order.paymentStatus)) return undefined;
    const timer = window.setInterval(() => { fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.order) setOrder(data.order); }).catch(() => {}); }, 15000);
    return () => window.clearInterval(timer);
  }, [order?.paymentMethod, order?.paymentStatus, orderId]);

  if (loading) return <main className="container-shell py-12"><div className="h-96 animate-pulse rounded-2xl bg-surface-muted" /></main>;
  if (!order) return <main className="container-shell py-12"><EmptyState title="We couldn’t find this order" description="Check the order number or return to your order history." actionLabel="View My Orders" href="/orders" /></main>;

  const currentIndex = getStatusIndex(order.orderStatus);
  const isCancelled = order.orderStatus === "cancelled";
  const address = order.deliveryAddress;

  return (
    <main className="container-shell py-10 md:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="eyebrow">Order tracking</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{order.orderNumber}</h1><p className="mt-2 text-sm text-text-secondary">Placed {formatOrderTimestamp(order.createdAt)}</p></div>
        <div className="flex items-center gap-2"><Badge tone={isCancelled ? "terracotta" : "green"}>{isCancelled ? "Cancelled" : order.orderStatus === "payment_pending" ? "Payment Pending" : orderStatuses[currentIndex]?.label || "Received"}</Badge>{order.paymentMethod === "manual_online" && <Badge>Online Payment</Badge>}</div>
      </div>

      <section className="card-surface mt-8 overflow-hidden">
        <div className="border-b border-border bg-[linear-gradient(120deg,var(--primary),var(--primary-hover))] px-5 py-6 text-white md:px-8">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white/12"><ChefHat className="size-5" aria-hidden="true" /></span><div><h2 className="text-xl font-black">{isCancelled ? "This order was cancelled" : order.orderStatus === "payment_pending" ? "Order created · awaiting payment verification" : "Your meal is in progress"}</h2><p className="mt-1 text-sm text-white/75">{order.serviceDate || "Today"} · {order.mealPeriod} · {order.deliverySlot}</p></div></div>
        </div>

        {!isCancelled && order.orderStatus === "payment_pending" ? <div className="p-6 text-sm leading-7 text-text-secondary">This order has been created, but cooking and delivery have not started. It will enter the kitchen queue only after GharKaBite verifies your online payment.</div> : !isCancelled ? (
          <ol className="grid gap-0 px-5 py-7 md:grid-cols-6 md:px-8" aria-label="Order progress">
            {orderStatuses.map((status, index) => {
              const Icon = statusIcons[index];
              const complete = index <= currentIndex;
              const timestamp = order.statusHistory?.find((entry) => entry.status === status.value)?.timestamp;
              return (
                <li key={status.value} className="relative flex gap-4 pb-7 last:pb-0 md:block md:pb-0 md:text-center">
                  {index < orderStatuses.length - 1 && <span className={`absolute left-5 top-10 h-[calc(100%-1.5rem)] w-0.5 md:left-1/2 md:top-5 md:h-0.5 md:w-full ${index < currentIndex ? "bg-success" : "bg-border"}`} aria-hidden="true" />}
                  <span className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 ${complete ? "border-success bg-success text-white" : "border-border bg-surface text-text-secondary"}`}>{complete ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}</span>
                  <div className="md:mt-3"><p className={`text-sm font-black ${complete ? "text-text-primary" : "text-text-secondary"}`}>{status.label}</p><p className="mt-1 text-xs text-text-secondary">{timestamp ? formatOrderTimestamp(timestamp) : "Pending"}</p></div>
                </li>
              );
            })}
          </ol>
        ) : <div className="p-6 text-sm leading-7 text-text-secondary">This order will not be prepared. Contact GharKaBite if you need help with the cancellation.</div>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card-surface p-5 md:p-6">
          <h2 className="text-xl font-black">Order details</h2>
          <div className="mt-5 divide-y divide-border">{order.items.map((item, index) => <div key={`${item.mealId}-${index}`} className="flex items-start justify-between gap-4 py-4 first:pt-0"><div><p className="font-black">{item.name}</p><p className="text-xs text-text-secondary">Quantity {item.quantity} · ₹{item.price} each</p><ThaliOrderDetails item={item} /></div><p className="shrink-0 font-black">₹{item.price * item.quantity}</p></div>)}</div>
          {order.notes && <div className="mt-5 rounded-xl bg-surface-muted p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-text-secondary">Order note</p><p className="mt-1 text-sm font-semibold">{order.notes}</p></div>}
        </section>

        <aside className="space-y-5">
          <section className="card-surface p-5"><h2 className="flex items-center gap-2 font-black"><MapPin className="size-4 text-primary" aria-hidden="true" /> Delivery address</h2><address className="mt-3 text-sm not-italic leading-6 text-text-secondary">{address.house}, {address.street}<br />{address.area}{address.landmark ? `, ${address.landmark}` : ""}<br />{address.city} – {address.pinCode}</address></section>
          <section className="card-surface p-5"><h2 className="flex items-center gap-2 font-black"><Clock3 className="size-4 text-primary" aria-hidden="true" /> Payment & total</h2><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-2 text-text-secondary"><span>{order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}</span><span className="font-black capitalize">{order.paymentMethod === "manual_online" && order.paymentStatus === "paid" ? "Payment Verified ✓" : order.paymentStatus.replaceAll("_", " ")}</span></div><div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total</span><span>₹{order.total}</span></div></div>{order.paymentMethod === "manual_online" && <><p className="mt-3 text-sm text-text-secondary">{order.paymentStatus === "paid" ? "Your payment has been verified and your order is confirmed." : order.paymentStatus === "verification_pending" ? "Payment submitted for verification. Your order is not confirmed yet." : order.paymentStatus === "rejected" ? `Payment could not be verified: ${order.paymentRejectionReason || "Contact us."}` : "Complete payment to confirm your order."}</p>{["pending", "rejected"].includes(order.paymentStatus) && order.orderStatus !== "cancelled" && <Button href={`/orders/${order.orderNumber}/payment`} className="mt-4 w-full">{order.paymentStatus === "rejected" ? "Resubmit Payment Details" : "Complete Payment"}</Button>}{order.paymentStatus === "verification_pending" && order.paymentProofMethod === "website" && <a href={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-primary underline">View submitted screenshot</a>}</>}</section>
        </aside>
      </div>

      {order.paymentProofMethod === "website" && <section className="card-surface mt-6 p-5 md:p-6"><h2 className="font-black">Your submitted payment screenshot</h2><a href={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} target="_blank" rel="noopener noreferrer" className="mt-4 block w-fit"><Image unoptimized src={`/api/orders/${encodeURIComponent(order.orderNumber)}/payment-screenshot`} alt="Submitted payment screenshot" width={400} height={300} className="max-h-80 w-full rounded-xl border border-border object-contain" /><span className="mt-2 block text-sm font-bold text-primary underline">Open full image</span></a></section>}
      <div className="mt-8 flex flex-wrap gap-3"><Button href="/menu">Browse Menu</Button><Button href="/orders" variant="secondary">My Orders</Button><Link href="/" className="inline-flex min-h-11 items-center px-3 text-sm font-black text-primary">Back home</Link></div>
    </main>
  );
}
