"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";

export default function StickyMobileCartBar() {
  const pathname = usePathname();
  const { hydrated, itemCount, subtotal } = useCart();
  const isOrderDiscoveryPage = pathname === "/" || pathname.startsWith("/menu");
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    if (!isOrderDiscoveryPage) return;
    const footer = document.querySelector("[data-customer-layout] footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -128px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [isOrderDiscoveryPage]);

  if (!hydrated || itemCount === 0 || !isOrderDiscoveryPage || footerVisible) return null;

  return (
    <aside
      className="ui-enter fixed inset-x-0 z-40 px-3 lg:hidden"
      style={{ bottom: "calc(4.65rem + env(safe-area-inset-bottom))" }}
      aria-label="Cart summary"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-white shadow-[0_16px_40px_rgba(31,42,35,0.24)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/12">
            <ShoppingBag className="size-4.5" aria-hidden="true" />
          </span>
          <p className="truncate text-sm font-extrabold">{itemCount} {itemCount === 1 ? "item" : "items"} • ₹{subtotal}</p>
        </div>
        <Link href="/cart" className="ui-action inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-surface px-3.5 text-sm font-black text-primary">
          View Cart <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
