"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShoppingBag, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Button from "./Button";
import BrandMark from "./BrandMark";
import { useCart } from "@/context/CartContext";

const links = [{ href: "/", label: "Home" }, { href: "/menu", label: "Today's Menu" }, { href: "/plans", label: "Meal Plans" }, { href: "/subscriptions", label: "My Plans" }, { href: "/orders", label: "My Orders" }];

export default function Navbar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { data: session, status } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/88 backdrop-blur-xl">
      <nav className="container-shell flex h-17 items-center justify-between" aria-label="Primary navigation">
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="GharKaBite home"><BrandMark className="size-10 shrink-0" /><span className="text-lg font-black tracking-[-0.04em]">GharKa<span className="text-accent">Bite</span></span></Link>
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => { const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${active ? "bg-primary/9 text-primary" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"}`}>{link.label}</Link>; })}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cart" className="relative grid size-11 place-items-center rounded-xl border border-border bg-surface text-text-primary transition hover:border-primary/40" aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}><ShoppingBag className="size-5" aria-hidden="true" />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-black text-white">{itemCount > 9 ? "9+" : itemCount}</span>}</Link>
          {status !== "loading" && session?.user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-extrabold"><UserRound className="size-4" aria-hidden="true" /> {session.user.name?.split(" ")[0] || "Profile"}</Link>
              <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="grid size-11 place-items-center rounded-xl text-text-secondary hover:bg-surface-muted" aria-label="Sign out"><LogOut className="size-4" aria-hidden="true" /></button>
            </div>
          ) : <Button href="/login" variant="secondary" className="hidden sm:inline-flex">Sign in</Button>}
        </div>
      </nav>
    </header>
  );
}
