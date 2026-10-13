"use client";

import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { whatsappUrl } from "@/lib/payment-settings";
import BrandMark from "./BrandMark";
import KolkataSkyline from "./KolkataSkyline";

export default function Footer({ supportEmail = "" }) {
  const footerRef = useRef(null);
  const [businessWhatsApp, setBusinessWhatsApp] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const loadContact = () => fetch("/api/payment-settings", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setBusinessWhatsApp(data?.payment?.businessWhatsApp || ""); })
      .catch(() => {});
    if (!window.IntersectionObserver) { loadContact(); return () => controller.abort(); }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { loadContact(); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(footerRef.current);
    return () => { observer.disconnect(); controller.abort(); };
  }, []);
  const contactWhatsApp = whatsappUrl(businessWhatsApp, "Hi GharKaBite, I have a question about meals and delivery.");
  const contactDigits = businessWhatsApp.replace(/\D/g, "");
  const contactPhone = contactDigits.length === 10 ? `91${contactDigits}` : contactDigits;
  return (
    <footer ref={footerRef} className="customer-footer mt-8 border-t border-primary-hover pb-[calc(5rem+env(safe-area-inset-bottom))] text-surface md:mt-12 lg:pb-0">
      <div className="container-shell grid grid-cols-2 gap-x-5 gap-y-6 py-7 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10 md:py-10">
        <div className="col-span-2 md:col-span-1"><span className="inline-flex rounded-xl bg-surface px-3 py-1"><BrandMark variant="wordmark" className="h-14 w-44" /></span><p className="mt-2 max-w-sm text-sm leading-5 text-disabled-bg">Every bite feels like home.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-disabled-bg"><p className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden="true" /> Check your address for local delivery</p><p className="flex items-center gap-2"><Clock3 className="size-4 shrink-0" aria-hidden="true" /> Lunch & dinner</p></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Explore</p><div className="mt-2 grid gap-2 text-sm text-surface md:mt-4 md:gap-3"><Link href="/menu" className="hover:text-accent-orange">Menu</Link><Link href="/plans" className="hover:text-accent-orange">Meal plans</Link><Link href="/about" className="hover:text-accent-orange">Our kitchen</Link><Link href="/contact" className="hover:text-accent-orange">Contact</Link></div></div>
        <div><p className="text-xs font-black uppercase tracking-wider md:text-sm">Policies</p><div className="mt-2 grid gap-2 text-sm text-surface md:mt-4 md:gap-3"><Link href="/privacy" className="hover:text-accent-orange">Privacy</Link><Link href="/terms" className="hover:text-accent-orange">Terms</Link><Link href="/refund-policy" className="hover:text-accent-orange">Refund policy</Link></div></div>
      </div>
      {(supportEmail || contactWhatsApp) && <div className="container-shell flex flex-wrap gap-x-6 pb-4 text-sm">{supportEmail && <a href={`mailto:${supportEmail}`}>Email · {supportEmail}</a>}{contactWhatsApp && <><a href={contactWhatsApp} target="_blank" rel="noopener noreferrer">Chat with the kitchen</a><a href={`tel:+${contactPhone}`}>Call the kitchen</a></>}</div>}
      <KolkataSkyline className="kolkata-mark" />
      <div className="border-t border-surface/20 px-4 py-3 text-center text-xs text-disabled-bg md:py-4">© 2026 GharKaBite. Ghorer Khabar, Ghore Ghore.</div>
    </footer>
  );
}
