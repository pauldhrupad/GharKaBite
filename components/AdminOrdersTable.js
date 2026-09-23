"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { adminStatusOptions } from "@/data/order-statuses";
import { isOrderComplete } from "@/lib/order-utils";

const statusFilters = [{ value: "all", label: "All" }, ...adminStatusOptions];
const paymentFilters = [["all", "All payments"], ["pending", "Payment Pending"], ["verification_pending", "Verification Pending"], ["paid", "Paid"], ["rejected", "Rejected"], ["COD", "COD"]];

function StatusBadge({ value, type }) {
  const label = value.replaceAll("_", " ");
  const color = value === "paid" || value === "delivered" || value === "completed"
    ? "bg-success/10 text-success"
    : value === "rejected" || value === "cancelled"
      ? "bg-danger/10 text-danger"
      : "bg-warning/10 text-warning";

  return <div className="min-w-0"><p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-secondary">{type}</p><span className={`inline-flex max-w-full rounded-full px-3 py-1.5 text-xs font-black capitalize leading-5 ${color}`}>{label}</span></div>;
}

export default function AdminOrdersTable({ initialPaymentFilter = "all" }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState(initialPaymentFilter);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let active = true;
    fetch(paymentFilter === "all" ? "/api/orders" : `/api/orders?paymentStatus=${encodeURIComponent(paymentFilter)}`).then(async (response) => {
      if (!response.ok) return;
      const databaseOrders = (await response.json()).orders || [];
      if (active) setOrders(databaseOrders);
    }).catch(() => {});
    return () => { active = false; };
  }, [paymentFilter]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const searchable = `${order.orderNumber} ${order.customer.name} ${order.customer.phone}`.toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (status === "all" || order.orderStatus === status)
        && (paymentFilter === "all" || (paymentFilter === "COD" ? order.paymentMethod === "COD" : order.paymentStatus === paymentFilter))
        && (period === "All" || order.mealPeriod === period);
    });
  }, [orders, period, query, status, paymentFilter]);

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-border bg-white">
      <div className="space-y-4 border-b border-border p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><span className="sr-only">Search by order ID, customer or phone</span><input type="search" name="orderSearch" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field with-leading-icon" placeholder="Search by order ID, customer or phone" autoComplete="off" enterKeyHint="search" /></label>
          <div className="inline-grid grid-cols-3 rounded-xl border border-border bg-surface-muted p-1" aria-label="Filter by meal period">{["All", "Lunch", "Dinner"].map((option) => <button key={option} type="button" onClick={() => setPeriod(option)} className={`min-h-10 rounded-lg px-4 text-sm font-black ${period === option ? "bg-white text-primary shadow-sm" : "text-text-secondary"}`}>{option}</button>)}</div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by order status">{statusFilters.map((option) => <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`min-h-9 rounded-full px-3.5 text-xs font-black ${status === option.value ? "bg-primary text-white" : "border border-border text-text-secondary"}`}>{option.label}</button>)}</div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by payment status">{paymentFilters.map(([value, label]) => <button key={value} type="button" onClick={() => setPaymentFilter(value)} className={`min-h-9 rounded-full px-3.5 text-xs font-black ${paymentFilter === value ? "bg-primary text-white" : "border border-border text-text-secondary"}`}>{label}</button>)}</div>
      </div>

      <div className="space-y-3 bg-surface-muted/40 p-3 sm:p-4">
        {filteredOrders.map((order) => (
          <article key={order.orderNumber} className="min-w-0 rounded-xl border border-border bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Order</p><Link href={`/admin/orders/${order.orderNumber}`} className="break-all font-black text-primary hover:underline">{order.orderNumber}</Link><p className="mt-1 text-xs text-text-secondary">{new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</p></div>
              <div className="text-left sm:text-right"><p className="text-xl font-black">₹{order.total}</p><p className="text-xs text-text-secondary">{order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}</p></div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 lg:grid-cols-4">
              <div className="min-w-0"><p className="text-xs font-bold text-text-secondary">Customer</p><p className="break-words text-sm font-bold">{order.customer.name}</p></div>
              <div className="min-w-0"><p className="text-xs font-bold text-text-secondary">Phone</p><p className="break-words text-sm">{order.customer.phone}</p></div>
              <div className="min-w-0"><p className="text-xs font-bold text-text-secondary">Meal</p><p className="text-sm">{order.mealPeriod}</p></div>
              <div className="min-w-0"><p className="text-xs font-bold text-text-secondary">Delivery slot</p><p className="text-sm">{order.deliverySlot}</p></div>
            </div>
            <div className="mt-3 min-w-0"><p className="text-xs font-bold text-text-secondary">Items</p><p className="break-words text-sm">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</p></div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
              <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-3"><StatusBadge type="Payment" value={order.paymentStatus} /><StatusBadge type="Order status" value={isOrderComplete(order) ? "completed" : order.orderStatus} /></div>
              <Link href={`/admin/orders/${order.orderNumber}`} className="inline-flex min-h-10 items-center rounded-lg border border-primary px-4 text-sm font-black text-primary hover:bg-primary/5">View order</Link>
            </div>
          </article>
        ))}
        {filteredOrders.length === 0 && <div className="rounded-xl bg-white p-10 text-center"><p className="font-black">No matching orders</p><p className="mt-1 text-sm text-text-secondary">Change the filters or search term.</p></div>}
      </div>
    </section>
  );
}
