"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, RotateCcw, UtensilsCrossed } from "lucide-react";
import Button from "./Button";
import EmptyState from "./EmptyState";
import { useCart } from "@/context/CartContext";
import { formatOrderTimestamp } from "@/lib/order-utils";
import { kolkataDate } from "@/lib/dates";

export default function OrdersHistory() {
  const { addOrderItems } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadOrders = window.setTimeout(async () => {
      let databaseOrders = [];
      try {
        const response = await fetch("/api/orders");
        if (response.ok) databaseOrders = (await response.json()).orders || [];
      } catch {
        // The database is the source of truth for orders.
      }
      if (active) {
        setOrders(databaseOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setLoading(false);
      }
    }, 0);
    return () => { active = false; window.clearTimeout(loadOrders); };
  }, []);

  async function reorder(order) {
    const response = await fetch(`/api/menu?date=${kolkataDate()}`);
    if (!response.ok) { setMessage("Today's menu is unavailable. Try again shortly."); return; }
    const meals = (await response.json()).meals || [];
    const selections = order.items.map((item) => ({ item, meal: meals.find((entry) => entry.id === item.mealId) }));
    const missing = selections.filter(({ meal }) => !meal || !meal.available || !meal.slots.includes(order.mealPeriod));
    if (missing.length) {
      setMessage(`${missing.map(({ item }) => item.name).join(", ")} ${missing.length === 1 ? "is" : "are"} not available today. Choose another meal from the menu.`);
      return;
    }
    const result = addOrderItems(selections.map(({ item, meal }) => ({ meal, quantity: item.quantity })), order.mealPeriod, kolkataDate());
    setMessage(result.status === "conflict" ? `Your existing cart uses another meal period. Confirm the switch to reorder this ${order.mealPeriod.toLowerCase()}.` : "Previous meals added to your cart.");
  }

  if (loading) return <section className="container-shell py-10"><div className="h-56 animate-pulse rounded-2xl bg-surface-muted" /></section>;
  if (!orders.length) return <section className="container-shell py-12"><EmptyState title="No orders here yet" description="Your first order will appear here with its status, delivery timing and an easy reorder option." /></section>;

  return (
    <section className="container-shell py-10">
      {message && <p className="mb-5 rounded-xl border border-primary/15 bg-primary/7 p-4 text-sm font-bold text-primary" aria-live="polite">{message}</p>}
      <div className="space-y-5">{orders.map((order) => (
        <article key={order.orderNumber} className="card-surface overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border bg-surface-muted/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={`/orders/${order.orderNumber}`} className="font-black text-primary hover:underline">{order.orderNumber}</Link><p className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary"><CalendarDays className="size-3.5" aria-hidden="true" /> {formatOrderTimestamp(order.createdAt)}</p></div><span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-black capitalize text-primary">{order.orderStatus.replaceAll("_", " ")}</span></div>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end"><div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-text-secondary"><UtensilsCrossed className="size-4" aria-hidden="true" /> {order.mealPeriod} · {order.deliverySlot}</p><p className="mt-3 font-black">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}</p><p className="mt-2 text-sm text-text-secondary">Total ₹{order.total} · {order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}</p><p className="mt-2 text-sm font-bold capitalize">Payment: {order.paymentStatus.replaceAll("_", " ")} · Order: {order.orderStatus.replaceAll("_", " ")}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => reorder(order)}><RotateCcw className="size-4" aria-hidden="true" /> Order Again</Button>{order.paymentMethod === "manual_online" && ["pending", "rejected"].includes(order.paymentStatus) && order.orderStatus !== "cancelled" && <Button href={`/orders/${order.orderNumber}/payment`}>{order.paymentStatus === "rejected" ? "Resubmit Payment" : "Complete Payment"}</Button>}{order.paymentStatus === "verification_pending" && <span className="self-center text-xs font-bold text-warning">Awaiting Verification</span>}<Button href={`/orders/${order.orderNumber}`}>View Details <ArrowRight className="size-4" aria-hidden="true" /></Button></div></div>
        </article>
      ))}</div>
    </section>
  );
}
