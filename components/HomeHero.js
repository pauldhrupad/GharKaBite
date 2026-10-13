"use client";

import Image from "next/image";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import Button from "./Button";
import { useKitchen } from "@/context/KitchenContext";
import { kolkataDate } from "@/lib/dates";
import { formatCutoffTime } from "@/lib/kitchen-operations";

export default function HomeHero() {
  const { hydrated, loadFailed, settings, getAvailability, today } = useKitchen();
  const open = hydrated && !loadFailed ? ["Lunch", "Dinner"].find((period) => getAvailability(period, today).available) : null;
  const tomorrowOpen = hydrated && !loadFailed && ["Lunch", "Dinner"].some((period) => getAvailability(period, kolkataDate(1)).available);
  const href = open ? "#todays-menu" : tomorrowOpen ? `/menu?date=${kolkataDate(1)}` : "/menu";
  const status = !hydrated ? "Checking kitchen availability…" : loadFailed ? "Kitchen availability is temporarily unavailable." : open ? `${open} orders close at ${formatCutoffTime(settings[`${open.toLowerCase()}Cutoff`])}` : settings.acceptingOrders === false ? "Ordering is temporarily paused by the kitchen." : "Today's ordering is closed. Explore the next menu.";
  return <section className="home-hero container-shell" aria-label="Homemade food delivery">
    <div className="home-hero-panel">
      <div className="home-hero-photo"><Image src="/images/kolkata-home-meal.png" alt="Homemade Bengali Thali with rice, dal, vegetables and fish curry" fill loading="eager" fetchPriority="high" sizes="(min-width: 1280px) 1216px, (min-width: 768px) calc(100vw - 48px), calc(100vw - 32px)" className="object-cover" /></div>
      <div className="home-hero-copy">
        <p className="home-hero-eyebrow"><Sparkles size={14} aria-hidden="true" /> Ghorer khabar, made with care</p>
        <h1>Home-Cooked Meals,<br /><span>Delivered to Your Door.</span></h1>
        <p className="home-hero-description">Fresh, comforting and customizable Thalis, prepared with care.</p>
        <div className="home-hero-actions"><Button href={href}>{open ? "Order Now" : tomorrowOpen ? "Explore Tomorrow" : "Browse Menu"}<ArrowRight size={16} aria-hidden="true" /></Button><Button href="/plans" variant="outline">Explore Meal Plans</Button></div>
        <p className="home-hero-status"><Clock3 size={14} aria-hidden="true" />{status}</p>
      </div>
    </div>
  </section>;
}
