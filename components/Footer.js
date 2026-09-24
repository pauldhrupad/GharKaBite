import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import BrandMark from "./BrandMark";

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-primary-hover bg-primary pb-[calc(5rem+env(safe-area-inset-bottom))] text-surface md:mt-12 lg:pb-0">
      <div className="container-shell grid grid-cols-2 gap-x-5 gap-y-6 py-7 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10 md:py-10">
        <div className="col-span-2 md:col-span-1"><span className="inline-flex rounded-xl bg-surface p-1"><BrandMark className="size-14 md:size-16" /></span><p className="mt-2 max-w-sm text-sm leading-5 text-disabled-bg md:mt-3 md:leading-6">Everyday home-cooked food, delivered locally.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-disabled-bg md:mt-4 md:block md:space-y-2 md:text-sm"><p className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden="true" /> About 5 km delivery area</p><p className="flex items-center gap-2"><Clock3 className="size-4 shrink-0" aria-hidden="true" /> Lunch & dinner</p></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Explore</p><div className="mt-2 grid gap-2 text-sm text-surface md:mt-4 md:gap-3"><Link href="/menu" className="hover:text-accent-orange">Menu</Link><Link href="/plans" className="hover:text-accent-orange">Meal plans</Link><Link href="/about" className="hover:text-accent-orange">Our kitchen</Link><Link href="/contact" className="hover:text-accent-orange">Contact</Link></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Policies</p><div className="mt-2 grid gap-2 text-sm text-surface md:mt-4 md:gap-3"><Link href="/privacy" className="hover:text-accent-orange">Privacy</Link><Link href="/terms" className="hover:text-accent-orange">Terms</Link><Link href="/refund-policy" className="hover:text-accent-orange">Refund policy</Link></div></div>
      </div>
      <div className="border-t border-surface/20 px-4 py-3 text-center text-xs text-disabled-bg md:py-4">© 2026 GharKaBite. Made for everyday home-food cravings.</div>
    </footer>
  );
}
