"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarRange, ChefHat, ClipboardList, House, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings, ShoppingBag, Users, X } from "lucide-react";
import BrandMark from "./BrandMark";
import { useAdminOrderAlerts } from "./AdminOrderAlertsProvider";
import { useModalFocus } from "@/lib/use-modal-focus";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/preparation", label: "Preparation", icon: ClipboardList },
  { href: "/admin/meals", label: "Menu items", icon: ChefHat },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CalendarRange },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function Navigation({ pathname, collapsed = false, onNavigate, alertCount = 0 }) {
  return <nav className="p-3" aria-label="Admin navigation">{links.map(({ href, label, icon: Icon }) => {
    const active = pathname.startsWith(href);
    const count = href === "/admin/orders" ? alertCount : 0;
    const accessibleLabel = count ? `${label}, ${count} ${count === 1 ? "order needs" : "orders need"} attention` : label;
    return <Link key={href} href={href} onClick={onNavigate} aria-label={collapsed || count ? accessibleLabel : undefined} aria-current={active ? "page" : undefined} title={collapsed ? accessibleLabel : undefined} className={`admin-nav-link relative mb-1 flex min-h-12 items-center rounded-xl py-3 text-sm font-extrabold ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-white text-primary" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><Icon className="size-5 shrink-0" aria-hidden="true" />{!collapsed && <span>{label}</span>}{count > 0 && <span aria-hidden="true" className={`grid min-h-5 min-w-5 place-items-center rounded-full bg-[#d45126] px-1 text-[11px] font-black leading-none text-white ${collapsed ? "absolute -right-0.5 top-0.5" : "ml-auto"}`}>{count > 99 ? "99+" : count}</span>}</Link>;
  })}<div className="mt-4 border-t border-white/15 pt-4">
    {!collapsed && <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/50">Customer view</p>}
    <Link href="/" target="_blank" rel="noopener noreferrer" onClick={onNavigate} aria-label={collapsed ? "View storefront (opens new tab)" : undefined} title={collapsed ? "View storefront (opens new tab)" : undefined} className={`flex min-h-12 items-center rounded-xl text-sm font-extrabold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`}><House className="size-5 shrink-0" aria-hidden="true" />{!collapsed && <><span className="flex-1">View storefront</span><ArrowUpRight className="size-4 shrink-0 text-white/70" aria-hidden="true" /><span className="sr-only">(opens new tab)</span></>}</Link>
  </div></nav>;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { count: alertCount, announcement, clearAnnouncement } = useAdminOrderAlerts();
  const mobileDialogRef = useModalFocus(open, () => setOpen(false));

  useEffect(() => {
    const timer = window.setTimeout(() => setCollapsed(window.localStorage.getItem("gharkabite-admin-sidebar-collapsed") === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleCollapsed() {
    setCollapsed(!collapsed);
    window.localStorage.setItem("gharkabite-admin-sidebar-collapsed", String(!collapsed));
  }

  return <>
    <button type="button" className="fixed left-4 top-3 z-40 grid size-11 place-items-center rounded-xl bg-primary text-white shadow-lg lg:hidden" onClick={() => setOpen(true)} aria-label={alertCount ? `Open admin menu, ${alertCount} ${alertCount === 1 ? "order needs" : "orders need"} attention` : "Open admin menu"}><Menu className="size-5" />{alertCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#d45126] px-1 text-[11px] font-black leading-none text-white ring-2 ring-white">{alertCount > 99 ? "99+" : alertCount}</span>}</button>
    <aside className={`hidden shrink-0 bg-[#173c27] text-white transition-[width] duration-200 lg:block ${collapsed ? "w-20" : "w-64"}`}>
      <div className={`flex h-17 items-center border-b border-white/10 ${collapsed ? "justify-center" : "justify-between px-4"}`}>
        {!collapsed && <Link href="/admin/dashboard" className="flex items-center" aria-label="GharKaBite admin dashboard"><BrandMark className="size-14 shrink-0 rounded-md bg-white" loading="eager" /></Link>}
        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="grid size-9 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button>
      </div>
      <Navigation pathname={pathname} collapsed={collapsed} alertCount={alertCount} />
    </aside>
    {open && <div className="ui-modal-backdrop fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} aria-label="Close admin menu overlay" /><aside ref={mobileDialogRef} role="dialog" aria-modal="true" aria-label="Admin navigation" className="ui-drawer relative h-full w-[min(82vw,18rem)] bg-[#173c27] text-white shadow-2xl"><div className="flex h-17 items-center justify-between border-b border-white/10 px-5"><Link href="/admin/dashboard" onClick={() => setOpen(false)} className="flex items-center" aria-label="GharKaBite admin dashboard"><BrandMark className="size-14 shrink-0 rounded-md bg-white" /></Link><button type="button" className="grid size-11 place-items-center rounded-lg hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close admin menu"><X className="size-5" /></button></div><Navigation pathname={pathname} onNavigate={() => setOpen(false)} alertCount={alertCount} /></aside></div>}
    {announcement && <div role="status" className="fixed bottom-5 right-4 z-40 max-w-[calc(100vw-2rem)] rounded-xl border border-primary/20 bg-white text-sm font-black text-primary shadow-xl lg:bottom-6"><Link href="/admin/orders" className="block rounded-xl px-4 py-3 hover:bg-primary/5" onClick={clearAnnouncement}>{announcement} · View orders</Link></div>}
  </>;
}
