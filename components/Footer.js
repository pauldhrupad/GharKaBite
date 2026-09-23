import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import BrandMark from "./BrandMark";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-[#f4f0e7] pb-20 md:mt-20 lg:pb-0">
      <div className="container-shell grid grid-cols-2 gap-x-5 gap-y-6 py-7 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10 md:py-12">
        <div className="col-span-2 md:col-span-1"><div className="flex items-center gap-1.5"><BrandMark className="size-8 shrink-0 md:size-10" /><p className="text-lg font-black tracking-[-0.04em] md:text-xl">GharKa<span className="text-accent">Bite</span></p></div><p className="mt-2 max-w-sm text-xs leading-5 text-text-secondary md:mt-3 md:text-sm md:leading-6">Everyday home-cooked food, delivered locally.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-text-secondary md:mt-5 md:block md:space-y-2 md:text-sm"><p className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" /> About 5 km delivery area</p><p className="flex items-center gap-2"><Clock3 className="size-4 shrink-0 text-primary" aria-hidden="true" /> Lunch & dinner</p></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Explore</p><div className="mt-2 grid gap-2 text-xs text-text-secondary md:mt-4 md:gap-3 md:text-sm"><Link href="/menu" className="hover:text-primary">Today&apos;s menu</Link><Link href="/plans" className="hover:text-primary">Meal plans</Link><Link href="/about" className="hover:text-primary">Our kitchen</Link><Link href="/contact" className="hover:text-primary">Contact</Link></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Policies</p><div className="mt-2 grid gap-2 text-xs text-text-secondary md:mt-4 md:gap-3 md:text-sm"><Link href="/privacy" className="hover:text-primary">Privacy</Link><Link href="/terms" className="hover:text-primary">Terms</Link><Link href="/refund-policy" className="hover:text-primary">Refund policy</Link></div></div>
      </div>
      <div className="border-t border-border px-4 py-3 text-center text-[11px] text-text-secondary md:py-5 md:text-xs">© 2026 GharKaBite. Made for everyday home-food cravings.</div>
    </footer>
  );
}
