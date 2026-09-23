"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Utensils, CalendarRange, ReceiptText, UserRound } from "lucide-react";

const items = [{ href: "/", label: "Home", icon: House }, { href: "/menu", label: "Menu", icon: Utensils }, { href: "/plans", label: "Plans", icon: CalendarRange }, { href: "/orders", label: "Orders", icon: ReceiptText }, { href: "/profile", label: "Profile", icon: UserRound }];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/96 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-md grid-cols-5">{items.map(({ href, label, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link key={href} href={href} className={`flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-extrabold active:scale-[0.97] focus-visible:z-10 ${active ? "bg-primary/9 text-primary" : "text-text-secondary hover:bg-surface-muted hover:text-primary"}`} aria-current={active ? "page" : undefined}><Icon className={`size-5 transition-transform duration-150 ${active ? "-translate-y-0.5" : ""}`} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />{label}</Link>; })}</div></nav>;
}
