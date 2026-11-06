"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, CalendarDays, RotateCcw, UtensilsCrossed } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { formatOrderTimestamp, orderStatusLabel, paymentPresentation } from "@/lib/order-utils";
import { canSubmitProof } from "@/lib/payment-settings";
import { formatINR } from "@/lib/cart-pricing";

export default function OrdersHistory() {
  const { data, status } = useSession();
  if (status === "loading") return <LoadingState label="Loading your orders" rows={2} />;
  if (status !== "authenticated" || !data?.user?.id) return <section className="container-shell py-6"><Button href="/welcome?mode=signin&returnTo=/orders">Sign in to view your orders</Button></section>;
  return <OrdersHistoryView key={data.user.id} />;
}

function OrdersHistoryView() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadOrders = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/orders?view=mine", { cache: "no-store", signal: controller.signal });
        if ([401, 403, 404].includes(response.status)) { if (active) { setOrders([]); setExpired(true); setLoading(false); } return; }
        if (!response.ok) throw new Error("ORDERS_UNAVAILABLE");
        const databaseOrders = (await response.json()).orders || [];
        if (active) {
          setOrders(databaseOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
          setLoadError("");
        }
      } catch {
        if (active) setLoadError("Your orders could not be loaded. Please try again.");
      }
      if (active) setLoading(false);
    }, 0);
    return () => { active = false; controller.abort(); window.clearTimeout(loadOrders); };
  }, [retryKey]);

  if (loading) return <LoadingState label="Loading your orders" rows={2} />;
  if (expired) return <section className="container-shell py-6"><Button href="/welcome?mode=signin&returnTo=/orders">Sign in to view your orders</Button></section>;
  if (loadError) return <section className="container-shell py-10" role="alert"><p className="font-bold text-danger">{loadError}</p><button type="button" onClick={() => { setLoading(true); setRetryKey((current) => current + 1); }} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-bold text-primary">Try again</button></section>;
  if (!orders.length) return <section className="container-shell py-12"><EmptyState title="No orders here yet" description="Your first order will appear here with its status, delivery timing and an easy reorder option." /></section>;

  return (
    <section className="container-shell py-8 md:py-10">
      <div className="space-y-5">{orders.map((order) => (
        <article key={order.orderNumber} className="order-card card-surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`/orders/${order.orderNumber}`} className="font-black text-primary hover:underline">{order.orderNumber}</Link><p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary"><CalendarDays className="size-3.5" aria-hidden="true" /> {formatOrderTimestamp(order.createdAt)}</p></div><span data-status={order.orderStatus} className="order-state w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-black capitalize text-primary">{orderStatusLabel(order)}</span></div>
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end md:p-5"><div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-text-secondary"><UtensilsCrossed className="size-4" aria-hidden="true" /> {order.mealPeriod} · {order.deliverySlot}</p><p className="mt-3 font-black">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}</p><p className="mt-2 text-sm text-text-secondary">Total <strong className="text-accent">{formatINR(order.total)}</strong> · {order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod === "manual_online" ? "Online payment" : "Earlier order payment"}</p><p className="mt-2 text-sm font-bold">{paymentPresentation(order).label}</p></div><div className="flex flex-wrap gap-2"><Button href={`/profile/reorder?order=${encodeURIComponent(order.orderNumber)}`} variant="secondary"><RotateCcw className="size-4" aria-hidden="true" /> Order Again</Button>{canSubmitProof(order) && order.total > 0 && <Button href={`/orders/${order.orderNumber}/payment`}>{order.paymentStatus === "rejected" ? "Review or resubmit proof" : "Payment instructions"}</Button>}<Button href={`/orders/${order.orderNumber}`}>View Details <ArrowRight className="size-4" aria-hidden="true" /></Button></div></div>
        </article>
      ))}</div>
    </section>
  );
}
