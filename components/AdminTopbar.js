"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, ChefHat, ClipboardList, House, ListFilter, ShoppingBag } from "lucide-react";
import AdminAvatar from "./AdminAvatar";
import { useAdminOrderAlerts } from "./AdminOrderAlertsProvider";

const shortcuts = [
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/preparation", label: "Preparation", icon: ClipboardList },
  { href: "/admin/meals", label: "Menu items", icon: ChefHat },
];

const titles = {
  dashboard: "Dashboard", orders: "Orders", preparation: "Preparation",
  meals: "Menu items", customers: "Customers", subscriptions: "Subscriptions", settings: "Settings",
};

export default function AdminTopbar() {
  const pathname = usePathname();
  const { count, orders } = useAdminOrderAlerts();
  const [open, setOpen] = useState(null);
  const controlsRef = useRef(null);
  const quickRef = useRef(null);
  const alertsRef = useRef(null);
  const section = pathname.split("/")[2] || "dashboard";
  const title = section === "orders" && pathname.split("/")[3] ? "Order details" : titles[section] || "Kitchen control";

  useEffect(() => {
    if (!open) return undefined;
    function dismiss(event) {
      if (!controlsRef.current?.contains(event.target)) setOpen(null);
    }
    function escape(event) {
      if (event.key === "Escape") {
        setOpen(null);
        (open === "alerts" ? alertsRef : quickRef).current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <header className="sticky top-0 z-30 flex h-17 items-center justify-between gap-2 border-b border-border bg-white/95 px-4 pl-18 shadow-[0_3px_12px_rgba(31,42,35,0.05)] backdrop-blur-xl sm:px-5 sm:pl-18 lg:px-8">
    <div className="min-w-0"><p className="hidden text-xs font-bold text-text-secondary sm:block">GharKaBite Admin</p><p className="truncate text-base font-black text-text-primary sm:text-lg">{title}</p></div>
    <div ref={controlsRef} className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
      <button ref={quickRef} type="button" onClick={() => setOpen(open === "quick" ? null : "quick")} aria-label="Quick admin links" aria-expanded={open === "quick"} aria-controls="admin-quick-links" className="grid size-11 place-items-center rounded-xl border border-border bg-white text-primary hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"><ListFilter className="size-5" aria-hidden="true" /></button>
      <button ref={alertsRef} type="button" onClick={() => setOpen(open === "alerts" ? null : "alerts")} aria-label={`Orders needing attention: ${count}`} aria-expanded={open === "alerts"} aria-controls="admin-order-alerts" className="relative grid size-11 place-items-center rounded-xl border border-border bg-white text-primary hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"><Bell className="size-5" aria-hidden="true" />{count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-white ring-2 ring-white">{count > 99 ? "99+" : count}</span>}</button>
      <AdminAvatar onOpen={() => setOpen(null)} />
      {open === "quick" && <div id="admin-quick-links" className="ui-enter absolute right-0 top-13 z-40 w-56 rounded-2xl border border-border bg-white p-2 shadow-xl" aria-label="Quick admin links"><p className="px-3 py-2 text-xs font-black uppercase tracking-wide text-text-secondary">Jump to</p>{shortcuts.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(null)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-text-primary hover:bg-primary/7 hover:text-primary"><Icon className="size-4" aria-hidden="true" />{label}</Link>)}<div className="mt-1 border-t border-border pt-1"><Link href="/" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(null)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary/7"><House className="size-4" aria-hidden="true" />View storefront <ArrowUpRight className="ml-auto size-4" aria-hidden="true" /><span className="sr-only">(opens new tab)</span></Link></div></div>}
      {open === "alerts" && <div id="admin-order-alerts" className="ui-enter absolute right-0 top-13 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-3 shadow-xl" aria-label="Orders needing attention"><div className="flex items-center justify-between gap-2 px-1 pb-2"><p className="font-black">Kitchen queue</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{count} need attention</span></div>{orders.length ? <div className="max-h-72 space-y-1 overflow-y-auto">{orders.map((order) => <Link key={order.orderNumber} href={`/admin/orders/${order.orderNumber}`} onClick={() => setOpen(null)} className="block rounded-xl border border-transparent p-3 hover:border-border hover:bg-surface-alt"><span className="block truncate text-sm font-black text-primary">{order.orderNumber}</span><span className="block text-xs text-text-secondary">{order.customer?.name || "Customer"} · {order.mealPeriod} · {order.orderStatus.replaceAll("_", " ")}</span></Link>)}</div> : <p className="rounded-xl bg-surface-alt p-3 text-sm text-text-secondary">No orders need attention right now.</p>}<Link href="/admin/orders" onClick={() => setOpen(null)} className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-white hover:bg-primary-hover">View all orders</Link></div>}
    </div>
  </header>;
}
