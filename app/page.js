import Image from "next/image";
import {
  ArrowRight,
  Bike,
  CalendarCheck2,
  Check,
  ChevronDown,
  Clock3,
  CookingPot,
  House,
  Leaf,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import Button from "@/components/Button";
import DeliveryChecker from "@/components/DeliveryChecker";
import HomeMenuSection from "@/components/HomeMenuSection";
import SectionHeading from "@/components/SectionHeading";
import { getMenu, seedCatalog } from "@/lib/catalog";
import { kolkataDate } from "@/lib/dates";
import SubscriptionPlan from "@/models/SubscriptionPlan";

const trustIndicators = [
  { label: "Fresh Ingredients", icon: Leaf },
  { label: "Home Kitchen", icon: House },
  { label: "Limited Daily Batches", icon: Clock3 },
  { label: "Local Delivery", icon: MapPin },
];

const benefits = [
  { title: "Home-Cooked Everyday", description: "Familiar meals made for regular eating.", icon: House },
  { title: "Freshly Prepared", description: "Cooked in small batches for the day.", icon: CookingPot },
  { title: "Balanced Cooking", description: "Simple spices, sensible oil and complete meals.", icon: ShieldCheck },
  { title: "Hyperlocal Delivery", description: "A focused service area for dependable delivery.", icon: Bike },
];

const steps = [
  { title: "Choose Your Meal", description: "See what is available from today’s kitchen.", icon: Utensils },
  { title: "Select Lunch or Dinner", description: "Pick the meal window that fits your day.", icon: CalendarCheck2 },
  { title: "Enter Delivery Details", description: "Add your local address and contact details.", icon: MapPin },
  { title: "Receive Fresh Food", description: "We cook, pack and deliver your meal locally.", icon: PackageCheck },
];

const faqs = [
  { question: "Is the food cooked daily?", answer: "Yes. The service is designed around fresh daily cooking in limited batches, subject to menu availability." },
  { question: "Can I order without a subscription?", answer: "Yes. You can place a one-time lunch or dinner order whenever meals are available." },
  { question: "Do you provide lunch and dinner?", answer: "Yes. Lunch and dinner menus can differ, and each has its own ordering cutoff." },
  { question: "How far do you deliver?", answer: "We currently plan to serve selected locations within approximately 5 km of the kitchen. The exact kitchen address is not displayed." },
  { question: "Can I pause a subscription?", answer: "The kitchen admin can pause an active plan. Its expiry moves forward by the paused time when it resumes." },
  { question: "Do you offer vegetarian options?", answer: "Yes. Vegetarian meals are included in both daily menus and meal-plan choices." },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const tomorrowDate = kolkataDate(1);
  const tomorrowMeals = (await getMenu(tomorrowDate)).filter((meal) => meal.available).slice(0, 3).map((meal) => ({ name: meal.name, detail: meal.contents.join(", "), image: meal.image }));
  await seedCatalog();
  const homepagePlans = (await SubscriptionPlan.find({ active: true }).sort({ mealCount: 1 }).lean()).map((plan) => ({ name: plan.name, meals: plan.mealCount, price: plan.price, perMeal: (plan.price / plan.mealCount).toFixed(2), validity: `Valid for ${plan.validityDays} days`, featured: plan.slug === "monthly", modes: [["Lunch", plan.lunchAllowed], ["Dinner", plan.dinnerAllowed], ["Mixed", plan.mixedAllowed]].filter(([, allowed]) => allowed).map(([mode]) => mode) }));
  const schema = { "@context": "https://schema.org", "@type": "FoodEstablishment", name: "GharKaBite", url: process.env.SITE_URL || "http://localhost:3000", servesCuisine: "Homemade Indian food", areaServed: { "@type": "City", name: "Kolkata" }, hasMenu: `${process.env.SITE_URL || "http://localhost:3000"}/menu` };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }} />
      <section className="overflow-hidden border-b border-border bg-[radial-gradient(circle_at_82%_12%,rgba(201,103,67,0.13),transparent_30%),linear-gradient(180deg,#fffdf8_0%,#fbf8f1_100%)] py-9 md:py-14">
        <div className="container-shell grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-extrabold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" /> Freshly Cooked Every Day
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.07] tracking-[-0.055em] sm:text-5xl md:text-6xl">
              Home-Cooked Food for Days You Don&apos;t Have Time to Cook.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary md:text-lg">
              Fresh lunch and dinner prepared in our home kitchen and delivered locally. Simple food, balanced spices and familiar flavours.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button href="#todays-menu">View Menu <ArrowRight className="size-4" aria-hidden="true" /></Button>
              <Button href="/plans" variant="secondary">Explore Meal Plans</Button>
            </div>
            <DeliveryChecker />
          </div>

          <div className="relative lg:pl-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border-[6px] border-surface shadow-[0_30px_80px_rgba(56,45,31,0.17)]">
              <Image
                src="/images/kolkata-home-meal.png"
                alt="Bengali home lunch with rice, dal, aloo bhaja, vegetables and fish curry"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 48vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-6 pt-24 text-white">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">Small batches · familiar flavours</p>
                <p className="mt-1 text-xl font-black">Today&apos;s food, cooked like home.</p>
              </div>
            </div>
            <div className="absolute -bottom-5 left-3 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:left-[-0.5rem]">
              <p className="text-xs font-bold text-text-secondary">Meals from</p>
              <p className="text-2xl font-black text-primary">₹109</p>
            </div>
          </div>
        </div>

        <div className="container-shell mt-12 grid grid-cols-2 gap-2 md:grid-cols-4 lg:mt-10">
          {trustIndicators.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-border/75 bg-surface/75 px-3 py-3 text-xs font-extrabold text-text-secondary backdrop-blur sm:text-sm">
              <Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" /> {label}
            </div>
          ))}
        </div>
      </section>

      <HomeMenuSection />

      <section className="border-y border-border bg-surface-muted/70 py-10 md:py-12">
        <div className="container-shell">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Plan one day ahead</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Tomorrow&apos;s Menu</h2>
            </div>
            <Button href={`/menu?date=${tomorrowDate}`} variant="secondary">Pre-order Tomorrow <ArrowRight className="size-4" aria-hidden="true" /></Button>
          </div>
          <div className="-mx-4 mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {tomorrowMeals.length === 0 && <p className="col-span-full rounded-xl bg-surface p-5 text-sm font-bold text-text-secondary">Tomorrow&apos;s menu is being prepared. Check back later.</p>}
            {tomorrowMeals.map((meal) => (
              <article key={meal.name} className="flex snap-start items-center gap-4 rounded-2xl border border-border bg-surface p-3">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                  <Image src={meal.image} alt={`${meal.name} preview`} fill sizes="80px" className="object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black">{meal.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{meal.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell py-14 md:py-20">
        <SectionHeading eyebrow="Flexible meal plans" title="Make everyday meals easier" description="Start small or plan the month. Choose lunch, dinner or a mix when you select a plan." />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {homepagePlans.map((plan) => (
            <article key={plan.name} className={`relative rounded-2xl border p-6 ${plan.featured ? "border-primary bg-primary text-white shadow-[0_22px_55px_rgba(39,99,61,0.2)]" : "border-border bg-surface shadow-[0_14px_38px_rgba(56,45,31,0.06)]"}`}>
              {plan.featured && <span className="absolute -top-3 left-5 rounded-full bg-accent px-3 py-1 text-xs font-black text-white">Best Value</span>}
              <p className={`text-sm font-extrabold ${plan.featured ? "text-white/70" : "text-text-secondary"}`}>{plan.meals} Meals</p>
              <h3 className="mt-1 text-2xl font-black">{plan.name}</h3>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-black">₹{plan.price.toLocaleString("en-IN")}</span>
                <span className={`pb-1 text-sm font-bold ${plan.featured ? "text-white/70" : "text-text-secondary"}`}>₹{plan.perMeal} per meal</span>
              </div>
              <p className={`mt-2 text-sm ${plan.featured ? "text-white/70" : "text-text-secondary"}`}>{plan.validity}</p>
              <div className="mt-6 flex flex-wrap gap-2" aria-label="Available meal timing options">
                {plan.modes.map((option) => (
                  <span key={option} className={`rounded-full border px-3 py-1.5 text-xs font-extrabold ${plan.featured ? "border-white/20 bg-white/10" : "border-border bg-surface-muted text-text-secondary"}`}>{option}</span>
                ))}
              </div>
              <Button href="/plans" variant={plan.featured ? "secondary" : "primary"} className={`mt-6 w-full ${plan.featured ? "border-white/20 bg-white text-primary hover:bg-surface-muted" : ""}`}>See plan details</Button>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface py-14 md:py-20">
        <div className="container-shell">
          <SectionHeading eyebrow="Why GharKaBite" title="Built for everyday eating" align="center" />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-border bg-background p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-5 font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell py-14 md:py-20">
        <SectionHeading eyebrow="How it works" title="Four simple steps to fresh food" align="center" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, description, icon: Icon }, index) => (
            <article key={title} className="relative rounded-2xl border border-border bg-surface p-5">
              <span className="absolute right-4 top-4 text-sm font-black text-accent">0{index + 1}</span>
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-8 font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-shell py-14 md:py-20">
        <SectionHeading eyebrow="Common questions" title="Before you order" />
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {faqs.map((item) => (
            <details key={item.question} className="group rounded-2xl border border-border bg-surface px-5 py-4 open:shadow-[0_12px_35px_rgba(56,45,31,0.06)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black">
                {item.question}
                <ChevronDown className="size-5 shrink-0 text-primary transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 pr-8 text-sm leading-6 text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container-shell pb-4">
        <div className="overflow-hidden rounded-[1.75rem] bg-accent px-6 py-10 text-center text-white shadow-[0_24px_65px_rgba(201,103,67,0.2)] md:px-10 md:py-14">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/70">Plan ahead, eat better</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] md:text-4xl">Tomorrow&apos;s meal can already be sorted.</h2>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/menu" variant="light">Browse Menu</Button>
            <Button href="/plans" variant="secondary" className="border-white/25 bg-transparent text-white hover:bg-white/10">See Meal Plans</Button>
          </div>
        </div>
      </section>
    </>
  );
}
