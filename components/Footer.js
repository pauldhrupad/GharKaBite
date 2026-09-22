import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import BrandMark from "./BrandMark";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-[#f4f0e7]">
      <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div><div className="flex items-center gap-1.5"><BrandMark className="size-10 shrink-0" /><p className="text-xl font-black tracking-[-0.04em]">GharKa<span className="text-accent">Bite</span></p></div><p className="mt-3 max-w-sm text-sm leading-6 text-text-secondary">Everyday food cooked with the care, balance and familiarity of a home kitchen.</p><div className="mt-5 space-y-2 text-sm font-bold text-text-secondary"><p className="flex items-center gap-2"><MapPin className="size-4 text-primary" aria-hidden="true" /> Delivering within about 5 km</p><p className="flex items-center gap-2"><Clock3 className="size-4 text-primary" aria-hidden="true" /> Lunch & dinner, subject to availability</p></div></div>
        <div><p className="text-sm font-black uppercase tracking-wider">Explore</p><div className="mt-4 grid gap-3 text-sm text-text-secondary"><Link href="/menu" className="hover:text-primary">Today&apos;s menu</Link><Link href="/plans" className="hover:text-primary">Meal plans</Link><Link href="/about" className="hover:text-primary">Our kitchen</Link><Link href="/contact" className="hover:text-primary">Contact</Link></div></div>
        <div><p className="text-sm font-black uppercase tracking-wider">Policies</p><div className="mt-4 grid gap-3 text-sm text-text-secondary"><Link href="/privacy" className="hover:text-primary">Privacy</Link><Link href="/terms" className="hover:text-primary">Terms</Link><Link href="/refund-policy" className="hover:text-primary">Refund policy</Link></div></div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-text-secondary">© 2026 GharKaBite. Made for everyday home-food cravings.</div>
    </footer>
  );
}
