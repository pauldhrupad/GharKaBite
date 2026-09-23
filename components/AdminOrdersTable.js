"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import CustomSelect from "./CustomSelect";
import { filterAdminOrders, normalizePaymentFilter, orderStageFilters, paymentFilters } from "@/lib/admin-order-filters";
import { isOrderComplete } from "@/lib/order-utils";

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
  const [paymentFilter, setPaymentFilter] = useState(() => normalizePaymentFilter(initialPaymentFilter));
  const [filtersOpen, setFiltersOpen] = useState(() => normalizePaymentFilter(initialPaymentFilter) !== "all");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(paymentFilter === "all" ? "/api/orders" : `/api/orders?paymentStatus=${encodeURIComponent(paymentFilter)}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load orders.");
      const databaseOrders = (await response.json()).orders || [];
      if (active) { setOrders(databaseOrders); setLoadError(""); setLoading(false); }
    }).catch(() => { if (active) { setOrders([]); setLoadError("Orders could not be loaded. Refresh the page to try again."); setLoading(false); } });
    return () => { active = false; };
  }, [paymentFilter]);

  const filteredOrders = useMemo(() => filterAdminOrders(orders, { query, status, period, paymentFilter }), [orders, period, query, status, paymentFilter]);
  const activeFilters = [
    ...(period !== "All" ? [{ key: "period", label: `Meal: ${period}`, clear: () => setPeriod("All") }] : []),
    ...(status !== "all" ? [{ key: "status", label: `Stage: ${orderStageFilters.find((option) => option.value === status)?.label}`, clear: () => setStatus("all") }] : []),
    ...(paymentFilter !== "all" ? [{ key: "payment", label: `Payment: ${paymentFilters.find((option) => option.value === paymentFilter)?.label}`, clear: () => changePaymentFilter("all") }] : []),
  ];

  function changePaymentFilter(value) {
    const next = normalizePaymentFilter(value);
    if (next !== paymentFilter) {
      setLoading(true);
      setPaymentFilter(next);
    }
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("paymentStatus");
    else url.searchParams.set("paymentStatus", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function clearFilters() {
    setPeriod("All");
    setStatus("all");
    changePaymentFilter("all");
    setFiltersOpen(false);
  }

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-border bg-white">
      <div className="space-y-3 border-b border-border p-4 sm:p-5">
        <label className="relative block min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><span className="sr-only">Search by order ID, customer or phone</span><input type="search" name="orderSearch" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field with-leading-icon" placeholder="Search by order ID, customer or phone" autoComplete="off" enterKeyHint="search" /></label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
          <CustomSelect aria-label="Meal period" value={period} onChange={(event) => setPeriod(event.target.value)} className="input-field min-w-0 py-2 text-sm font-bold sm:w-48"><option value="All">All meals</option><option value="Lunch">Lunch</option><option value="Dinner">Dinner</option></CustomSelect>
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen} aria-controls={filtersOpen ? "order-advanced-filters" : undefined} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black sm:px-4 ${filtersOpen || activeFilters.length > 0 ? "border-primary bg-primary/5 text-primary" : "border-border text-text-primary hover:bg-surface-muted"}`}><SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />Filters{activeFilters.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-white" aria-label={`${activeFilters.length} active filters`}>{activeFilters.length}</span>}<ChevronDown className={`size-4 shrink-0 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
        </div>
        {activeFilters.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Active filters">{activeFilters.map((filter) => <button key={filter.key} type="button" onClick={filter.clear} aria-label={`Remove ${filter.label} filter`} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 text-xs font-bold text-primary hover:bg-primary/10"><span className="truncate">{filter.label}</span><X className="size-3.5 shrink-0" aria-hidden="true" /></button>)}</div>}
        {filtersOpen && <div id="order-advanced-filters" className="grid gap-3 rounded-xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-2 sm:p-4">
          <label className="min-w-0 text-sm font-bold">Order stage<CustomSelect value={status} onChange={(event) => setStatus(event.target.value)} className="input-field mt-1.5 text-sm font-semibold">{orderStageFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CustomSelect></label>
          <label className="min-w-0 text-sm font-bold">Payment<CustomSelect value={paymentFilter} onChange={(event) => changePaymentFilter(event.target.value)} className="input-field mt-1.5 text-sm font-semibold">{paymentFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CustomSelect></label>
          {activeFilters.length > 0 && <button type="button" onClick={clearFilters} className="min-h-10 justify-self-start rounded-lg px-2 text-sm font-bold text-primary hover:underline sm:col-span-2">Clear filters</button>}
        </div>}
      </div>

      <div className="space-y-3 bg-surface-muted/40 p-3 sm:p-4">
        {loading && <div className="rounded-xl bg-white p-8 text-center text-sm font-bold text-text-secondary" role="status">Loading orders…</div>}
        {!loading && loadError && <div className="rounded-xl bg-white p-8 text-center text-sm font-bold text-danger" role="alert">{loadError}</div>}
        {!loading && !loadError && filteredOrders.map((order) => (
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
        {!loading && !loadError && filteredOrders.length === 0 && <div className="rounded-xl bg-white p-10 text-center"><p className="font-black">No matching orders</p><p className="mt-1 text-sm text-text-secondary">Change the filters or search term.</p></div>}
      </div>
    </section>
  );
}
