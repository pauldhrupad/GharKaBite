"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ClipboardList, LogOut, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import BrandMark from "./BrandMark";
import { useCart } from "@/context/CartContext";
import { useCustomerOrderSummary } from "@/lib/use-customer-order-summary";
import { useModalFocus } from "@/lib/use-modal-focus";

const primaryLinks = [{ href: "/", label: "Home" }, { href: "/menu", label: "Menu" }, { href: "/plans", label: "Meal Plans" }, { href: "/subscriptions", label: "My Plans" }, { href: "/orders", label: "My Orders" }];
const secondaryLinks = [{ href: "/about", label: "Our kitchen" }, { href: "/contact", label: "Contact" }, { href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }];
const navLinkClass = "flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-text-primary hover:bg-surface-alt hover:text-primary";

function ActiveOrders({ orders, count, onNavigate }) {
  return <section aria-label="Active orders" className="border-t border-border pt-3">
    <div className="flex items-center justify-between gap-2 px-2"><p className="text-xs font-black uppercase tracking-wide text-text-secondary">Active orders</p><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">{count}</span></div>
    {orders.length ? <div className="mt-2 space-y-1">{orders.map((order) => <Link key={order.orderNumber} href={`/orders/${order.orderNumber}`} onClick={onNavigate} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-sm hover:bg-surface-alt"><span className="min-w-0"><span className="block truncate font-bold text-primary">{order.orderNumber}</span><span className="block text-xs capitalize text-text-secondary">{order.mealPeriod} · {order.orderStatus.replaceAll("_", " ")}</span></span><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /></Link>)}</div> : <p className="px-2 py-3 text-sm text-text-secondary">No current or upcoming orders.</p>}
    <Link href="/orders" onClick={onNavigate} className="mt-1 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-primary hover:bg-surface-alt"><ClipboardList className="size-4" aria-hidden="true" />View all orders</Link>
  </section>;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCart();
  const { data: session, status } = useSession();
  const { activeCount, orders } = useCustomerOrderSummary(session?.user?.id);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchTrigger = useRef(null);
  const searchInput = useRef(null);
  const menuTrigger = useRef(null);
  const profileTrigger = useRef(null);
  const profileContainer = useRef(null);
  const searchDialog = useModalFocus(searchOpen, () => setSearchOpen(false), searchInput, searchTrigger);
  const mobileDialog = useModalFocus(mobileOpen, () => setMobileOpen(false), null, menuTrigger);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function dismiss(event) { if (!profileContainer.current?.contains(event.target)) setProfileOpen(false); }
    function escape(event) { if (event.key === "Escape") { setProfileOpen(false); profileTrigger.current?.focus(); } }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [profileOpen]);

  function submitSearch(event) {
    event.preventDefault();
    const term = query.trim();
    setSearchOpen(false);
    router.push(term ? `/menu?q=${encodeURIComponent(term)}` : "/menu");
  }

  function signOutAndClose() {
    setMobileOpen(false);
    setProfileOpen(false);
    signOut({ callbackUrl: "/" });
  }

  return <>
    <header className={`sticky top-0 z-40 border-b border-border bg-surface/97 backdrop-blur-xl transition-shadow duration-200 ${scrolled ? "shadow-[0_6px_18px_rgba(30,40,34,0.1)]" : ""}`}>
      <nav className="container-shell flex h-15 items-center justify-between md:h-16" aria-label="Primary navigation">
        <Link href="/" className="flex shrink-0 items-center" aria-label="GharKaBite home"><BrandMark className="size-15 shrink-0" loading="eager" /></Link>
        <div className="hidden items-center gap-1 lg:flex">{primaryLinks.map((link) => { const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`relative rounded-lg px-3.5 py-2 text-sm font-bold after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-200 ${active ? "bg-primary/10 text-primary after:scale-x-100" : "text-text-primary after:scale-x-0 hover:bg-surface-alt hover:text-primary hover:after:scale-x-100"}`}>{link.label}</Link>; })}</div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button ref={searchTrigger} type="button" onClick={() => setSearchOpen(true)} aria-label="Search menu" className="ui-action grid size-11 place-items-center rounded-xl border border-border bg-surface text-primary hover:border-primary/40 hover:bg-primary/5"><Search className="size-5" aria-hidden="true" /></button>
          <Link href="/cart" className="ui-action relative grid size-11 place-items-center rounded-xl border border-border bg-surface text-text-primary hover:border-primary/40 hover:text-primary" aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}><ShoppingBag className="size-5" aria-hidden="true" />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-black text-white">{itemCount > 9 ? "9+" : itemCount}</span>}</Link>
          <button ref={menuTrigger} type="button" onClick={() => setMobileOpen(true)} aria-label={`Open menu${session?.user && activeCount ? `, ${activeCount} active ${activeCount === 1 ? "order" : "orders"}` : ""}`} aria-expanded={mobileOpen} className="ui-action relative grid size-11 place-items-center rounded-xl border border-border bg-surface text-primary hover:border-primary/40 hover:bg-primary/5 lg:hidden"><Menu className="size-5" aria-hidden="true" />{session?.user && activeCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-black text-white ring-2 ring-white">{activeCount > 9 ? "9+" : activeCount}</span>}</button>
          {status !== "loading" && session?.user ? <div ref={profileContainer} className="relative hidden lg:block"><button ref={profileTrigger} type="button" onClick={() => setProfileOpen(!profileOpen)} aria-label={`Account menu${activeCount ? `, ${activeCount} active ${activeCount === 1 ? "order" : "orders"}` : ""}`} aria-expanded={profileOpen} aria-controls="customer-profile-menu" className="ui-action relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-extrabold hover:border-primary/40 hover:text-primary"><UserRound className="size-4" aria-hidden="true" /><span className="max-w-24 truncate">{session.user.name?.split(" ")[0] || "Profile"}</span><ChevronDown className="size-4" aria-hidden="true" />{activeCount > 0 && <span aria-hidden="true" className="grid min-h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">{activeCount > 9 ? "9+" : activeCount}</span>}</button>{profileOpen && <div id="customer-profile-menu" className="ui-enter absolute right-0 top-13 z-50 w-72 rounded-2xl border border-border bg-surface p-3 shadow-xl"><p className="truncate px-2 pb-3 text-sm font-black text-text-primary">{session.user.name || "Your account"}</p><ActiveOrders orders={orders} count={activeCount} onNavigate={() => setProfileOpen(false)} /><div className="mt-2 border-t border-border pt-2"><Link href="/profile" onClick={() => setProfileOpen(false)} className={navLinkClass}><UserRound className="mr-2 size-4" aria-hidden="true" />Profile & addresses</Link>{session.user.role === "admin" && <Link href="/admin/dashboard" onClick={() => setProfileOpen(false)} className={navLinkClass}>Admin dashboard</Link>}<button type="button" onClick={signOutAndClose} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-danger hover:bg-danger/5"><LogOut className="size-4" aria-hidden="true" />Sign out</button></div></div>}</div> : <Link href="/login" className="ui-action hidden min-h-11 items-center rounded-xl border border-primary px-4 text-sm font-bold text-primary hover:bg-primary/5 lg:inline-flex">Sign in</Link>}
        </div>
      </nav>
    </header>
    {searchOpen && <div className="ui-modal-backdrop fixed inset-0 z-60 flex items-start justify-center bg-black/45 px-4 pt-[min(18vh,8rem)]" onClick={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div ref={searchDialog} role="dialog" aria-modal="true" aria-labelledby="nav-search-title" className="ui-dialog w-full max-w-xl rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-6"><div className="flex items-center justify-between gap-3"><h2 id="nav-search-title" className="text-xl font-black">Search the menu</h2><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="grid size-11 place-items-center rounded-xl hover:bg-surface-alt"><X className="size-5" aria-hidden="true" /></button></div><form onSubmit={submitSearch} role="search" className="mt-4 flex flex-col gap-2 sm:flex-row"><input ref={searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Thalis and dishes" aria-label="Search Thalis and dishes" className="input-field min-w-0 flex-1" /><button type="submit" className="min-h-11 rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">Search menu</button></form></div></div>}
    {mobileOpen && <div className="ui-modal-backdrop fixed inset-0 z-60 lg:hidden"><button type="button" className="absolute inset-0 bg-black/45" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" /><aside ref={mobileDialog} role="dialog" aria-modal="true" aria-label="More navigation" className="ui-drawer absolute right-0 top-0 flex h-full w-[min(88vw,23rem)] flex-col bg-surface shadow-2xl"><div className="flex h-16 items-center justify-between border-b border-border px-5"><span className="text-lg font-black text-text-primary">Explore GharKaBite</span><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-xl hover:bg-surface-alt"><X className="size-5" aria-hidden="true" /></button></div><div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><p className="px-2 pb-2 text-xs font-black uppercase tracking-wide text-text-secondary">Quick links</p>{primaryLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} aria-current={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined} className={`${navLinkClass} ${(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "bg-primary/10 text-primary" : ""}`}>{link.label}</Link>)}<div className="my-3 border-t border-border" />{secondaryLinks.map(({ href, label }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={navLinkClass}>{label}</Link>)}{session?.user ? <><div className="my-3 border-t border-border" /><ActiveOrders orders={orders} count={activeCount} onNavigate={() => setMobileOpen(false)} /><Link href="/profile" onClick={() => setMobileOpen(false)} className={navLinkClass}><UserRound className="mr-2 size-4" aria-hidden="true" />Profile & addresses</Link>{session.user.role === "admin" && <Link href="/admin/dashboard" onClick={() => setMobileOpen(false)} className={navLinkClass}>Admin dashboard</Link>}<button type="button" onClick={signOutAndClose} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-danger hover:bg-danger/5"><LogOut className="size-4" aria-hidden="true" />Sign out</button></> : <div className="mt-3 border-t border-border pt-3"><Link href="/login" onClick={() => setMobileOpen(false)} className={navLinkClass}>Sign in</Link><Link href="/register" onClick={() => setMobileOpen(false)} className={navLinkClass}>Create account</Link></div>}</div></aside></div>}
  </>;
}
