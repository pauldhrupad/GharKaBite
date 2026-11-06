import { ArrowRight, Bike, CalendarCheck2, ChevronDown, CookingPot, House, MapPin, PackageCheck, Utensils } from "lucide-react";
import Button from "@/components/Button";
import DeliveryChecker from "@/components/DeliveryChecker";
import HomeHero from "@/components/HomeHero";
import HomeMenuSection from "@/components/HomeMenuSection";
import HomeCustomerShortcut from "@/components/HomeCustomerShortcut";
import { HomepagePlanCards, HomepageTomorrowPreview } from "@/components/HomeProgressiveSections";
import KolkataSkyline from "@/components/KolkataSkyline";

const benefits = [
  { title: "Home kitchen", description: "Familiar flavours for everyday eating.", icon: House },
  { title: "Cooked to order", description: "Prepared for confirmed orders before cutoff.", icon: CookingPot },
  { title: "Delivered locally", description: "Your address checked before ordering.", icon: Bike },
];
const steps = [
  { title: "Choose your meal", description: "Explore the kitchen’s current menu.", icon: Utensils },
  { title: "Make it yours", description: "Choose your base, sides and meal period.", icon: CalendarCheck2 },
  { title: "Check delivery", description: "Add your address and contact details.", icon: MapPin },
  { title: "We cook and deliver", description: "Your confirmed meal, prepared locally.", icon: PackageCheck },
];
const faqs = [
  { question: "Is the food cooked daily?", answer: "Meals are freshly prepared to match confirmed orders, subject to menu availability and the ordering cutoff." },
  { question: "Can I order without a subscription?", answer: "Yes. You can place a one-time lunch or dinner order whenever ordering is open. New subscription purchases are currently unavailable." },
  { question: "Do you provide lunch and dinner?", answer: "Yes. Lunch and dinner menus can differ, and each has its own ordering cutoff." },
  { question: "How far do you deliver?", answer: "Use the delivery checker to verify your exact address against the kitchen’s current service area. The exact kitchen address is not displayed." },
  { question: "Can I pause an existing subscription?", answer: "The kitchen admin can pause an active plan. Its expiry moves forward by the paused time when it resumes." },
  { question: "Do you offer vegetarian options?", answer: "Yes. Use Veg Thali to see the current vegetarian Thalis, or browse All meals for individual dishes." },
];
export const dynamic = "force-dynamic";

export default function Home() {
  const schema = { "@context": "https://schema.org", "@type": "FoodEstablishment", name: "GharKaBite", url: process.env.SITE_URL || "http://localhost:3000", servesCuisine: "Homemade Indian food", areaServed: { "@type": "City", name: "Kolkata" }, hasMenu: `${process.env.SITE_URL || "http://localhost:3000"}/menu` };
  return <div className="home-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replaceAll("<", "\\u003c") }} />
    <HomeHero />
    <div className="container-shell"><DeliveryChecker /></div>
    <HomeMenuSection />
    <HomeCustomerShortcut />
    <section className="home-support container-shell" aria-labelledby="home-promo-title">
      <div className="home-brand-banner"><div><p className="eyebrow">A little planning, a comforting meal</p><h2 id="home-promo-title" className="type-section-title">Make tomorrow feel like home.</h2><p>Discover what&apos;s cooking next. Choose your meal before its ordering cutoff.</p></div><HomepageTomorrowPreview /></div>
    </section>
    <section className="home-support container-shell" aria-labelledby="home-plans-title">
      <div className="home-section-heading"><div><p className="eyebrow">Meal plans · information only</p><h2 id="home-plans-title" className="type-section-title">Your everyday meal routine</h2></div><Button href="/plans" variant="outline">Plan information <ArrowRight size={16} aria-hidden="true" /></Button></div>
      <p className="home-support-copy">New plan purchases are unavailable. Existing subscribers can still manage and use their credits.</p>
      <HomepagePlanCards />
    </section>
    <section className="home-support container-shell" aria-labelledby="home-story-title"><div className="home-story"><div><p className="eyebrow">GharKaBite · Ghorer khabar</p><h2 id="home-story-title" className="type-section-title">Every bite feels like home.</h2><p className="home-support-copy">Comforting homemade meals, thoughtful choices and a local kitchen. Familiar food for your everyday rhythm.</p><KolkataSkyline className="home-skyline" /></div><div className="home-benefits">{benefits.map(({ title, description, icon: Icon }) => <article key={title}><Icon size={22} aria-hidden="true" /><div><h3 className="type-card-title">{title}</h3><p>{description}</p></div></article>)}</div></div></section>
    <section className="home-support container-shell" aria-labelledby="home-steps-title"><h2 id="home-steps-title" className="type-section-title">From our kitchen to your table</h2><ol className="home-steps">{steps.map(({ title, description, icon: Icon }, index) => <li key={title}><span className="home-step-number">{index + 1}</span><Icon size={20} aria-hidden="true" /><div><h3 className="type-card-title">{title}</h3><p>{description}</p></div></li>)}</ol></section>
    <section className="home-support container-shell" aria-labelledby="home-faq-title"><h2 id="home-faq-title" className="type-section-title">Before you order</h2><div className="home-faq">{faqs.map(({ question, answer }) => <details key={question} className="faq-item group"><summary>{question}<ChevronDown size={18} className="group-open:rotate-180" aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
  </div>;
}
