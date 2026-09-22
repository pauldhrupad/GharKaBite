"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarRange, ChefHat, LayoutDashboard, Menu, Settings, ShoppingBag, Users, X } from "lucide-react";
import BrandMark from "./BrandMark";

const links = [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/admin/orders", label: "Orders", icon: ShoppingBag }, { href: "/admin/meals", label: "Meals", icon: ChefHat }, { href: "/admin/customers", label: "Customers", icon: Users }, { href: "/admin/subscriptions", label: "Subscriptions", icon: CalendarRange }, { href: "/admin/settings", label: "Kitchen Settings", icon: Settings }];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = <><div className="flex h-17 items-center justify-between border-b border-white/10 px-5"><Link href="/admin/dashboard" className="flex items-center gap-1.5 text-lg font-black"><BrandMark className="size-8 shrink-0" light /><span>GharKa<span className="text-[#eda585]">Bite</span></span><span className="hidden text-xs font-bold text-white/50 sm:inline">ADMIN</span></Link><button className="grid size-9 place-items-center rounded-lg hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close admin menu"><X className="size-5" /></button></div><nav className="p-3" aria-label="Admin navigation">{links.map(({ href,label,icon:Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-extrabold transition ${active ? "bg-white text-primary" : "text-white/68 hover:bg-white/8 hover:text-white"}`}><Icon className="size-5" aria-hidden="true" />{label}</Link>; })}</nav></>;
  return <><button className="fixed left-4 top-3 z-40 grid size-11 place-items-center rounded-xl bg-primary text-white shadow-lg lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu"><Menu className="size-5" /></button><aside className="hidden w-64 shrink-0 bg-[#173c27] text-white lg:block">{nav}</aside>{open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} aria-label="Close admin menu overlay" /><aside className="relative h-full w-[min(82vw,18rem)] bg-[#173c27] text-white shadow-2xl">{nav}</aside></div>}</>;
}
