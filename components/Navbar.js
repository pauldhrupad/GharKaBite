"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, ShoppingBag, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Button from "./Button";
import BrandMark from "./BrandMark";
import { useCart } from "@/context/CartContext";

const links = [{ href: "/", label: "Home" }, { href: "/menu", label: "Menu" }, { href: "/plans", label: "Meal Plans" }, { href: "/subscriptions", label: "My Plans" }, { href: "/orders", label: "My Orders" }];

export default function Navbar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { data: session, status } = useSession();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className={`sticky top-0 z-40 border-b border-border bg-surface/97 backdrop-blur-xl transition-shadow duration-200 ${scrolled ? "shadow-[0_6px_18px_rgba(30,40,34,0.1)]" : ""}`}>
      <nav className="container-shell flex h-15 items-center justify-between md:h-16" aria-label="Primary navigation">
        <Link href="/" className="flex shrink-0 items-center" aria-label="GharKaBite home"><BrandMark className="size-15 shrink-0" loading="eager" /></Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => { const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`relative rounded-lg px-3.5 py-2 text-sm font-bold after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-primary after:transition-transform after:duration-200 ${active ? "bg-primary/10 text-primary after:scale-x-100" : "text-text-primary after:scale-x-0 hover:bg-surface-alt hover:text-primary hover:after:scale-x-100"}`}>{link.label}</Link>; })}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cart" className="ui-action relative grid size-11 place-items-center rounded-xl border border-border bg-surface text-text-primary hover:border-primary/40 hover:text-primary" aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}><ShoppingBag className="size-5" aria-hidden="true" />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-black text-white">{itemCount > 9 ? "9+" : itemCount}</span>}</Link>
          {status !== "loading" && session?.user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/profile" className="ui-action inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-extrabold hover:border-primary/40 hover:text-primary"><UserRound className="size-4" aria-hidden="true" /> {session.user.name?.split(" ")[0] || "Profile"}</Link>
              <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="grid size-11 place-items-center rounded-xl text-text-secondary hover:bg-surface-muted" aria-label="Sign out"><LogOut className="size-4" aria-hidden="true" /></button>
            </div>
          ) : <Button href="/login" variant="secondary" className="hidden sm:inline-flex">Sign in</Button>}
        </div>
      </nav>
    </header>
  );
}
