"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { adminStatusOptions } from "@/data/order-statuses";
import { isOrderComplete } from "@/lib/order-utils";

const statusFilters = [{ value: "all", label: "All" }, ...adminStatusOptions];

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
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><span className="sr-only">Search by order ID, customer or phone</span><input type="search" name="orderSearch" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field with-leading-icon" placeholder="Search by order ID, customer or phone" autoComplete="off" enterKeyHint="search" /></label>
          <div className="inline-grid grid-cols-3 rounded-xl border border-border bg-surface-muted p-1" aria-label="Filter by meal period">{["All", "Lunch", "Dinner"].map((option) => <button key={option} type="button" onClick={() => setPeriod(option)} className={`min-h-10 rounded-lg px-4 text-sm font-black ${period === option ? "bg-white text-primary shadow-sm" : "text-text-secondary"}`}>{option}</button>)}</div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filter by order status">{statusFilters.map((option) => <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-black ${status === option.value ? "bg-primary text-white" : "border border-border text-text-secondary"}`}>{option.label}</button>)}</div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filter by payment status">{[["all", "All payments"], ["pending", "Payment Pending"], ["verification_pending", "Verification Pending"], ["paid", "Paid"], ["rejected", "Rejected"], ["COD", "COD"]].map(([value, label]) => <button key={value} type="button" onClick={() => setPaymentFilter(value)} className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-black ${paymentFilter === value ? "bg-primary text-white" : "border border-border text-text-secondary"}`}>{label}</button>)}</div>
      </div>

      <div className="overflow-x-auto"><table className="w-full min-w-[78rem] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-text-secondary"><tr>{["Order ID", "Created", "Customer", "Phone", "Meals", "Period", "Delivery slot", "Amount", "Method", "Payment", "Status"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.orderNumber} className="border-t border-border/70 align-top"><td className="px-4 py-4 font-black"><Link href={`/admin/orders/${order.orderNumber}`} className="text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-4 py-4 text-text-secondary">{new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td><td className="px-4 py-4 font-bold">{order.customer.name}</td><td className="px-4 py-4 text-text-secondary">{order.customer.phone}</td><td className="max-w-64 px-4 py-4 text-text-secondary">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</td><td className="px-4 py-4 text-text-secondary">{order.mealPeriod}</td><td className="px-4 py-4 text-text-secondary">{order.deliverySlot}</td><td className="px-4 py-4 font-black">₹{order.total}</td><td className="px-4 py-4 text-text-secondary">{order.paymentMethod === "COD" ? "COD" : "Online Payment"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${order.paymentStatus === "paid" ? "bg-success/10 text-success" : order.paymentStatus === "rejected" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{order.paymentStatus.replaceAll("_", " ")}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${order.orderStatus === "cancelled" ? "bg-danger/10 text-danger" : order.orderStatus === "delivered" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{isOrderComplete(order) ? "Completed" : order.orderStatus.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div>
      {filteredOrders.length === 0 && <div className="p-10 text-center"><p className="font-black">No matching orders</p><p className="mt-1 text-sm text-text-secondary">Change the filters or search term.</p></div>}
    </section>
  );
}
