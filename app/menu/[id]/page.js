import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import MealCard from "@/components/MealCard";
import ThaliCustomizer from "@/components/ThaliCustomizer";
import SectionHeading from "@/components/SectionHeading";
import { getMenu } from "@/lib/catalog";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";
import { validMealPeriod } from "@/lib/meal-period";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const meal = (await getMenu()).find((item) => item.id === id);
  if (!meal) return { title: "Menu Item Not Found" };
  return { title: meal.name, description: meal.shortDescription };
}

export default async function MealDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const date = allowedOrderDate(query?.date) ? query.date : kolkataDate();
  const meals = await getMenu(date);
  const meal = meals.find((item) => item.id === id);
  if (!meal) notFound();
  const period = validMealPeriod(query?.period, meal.slots) || meal.slots[0];
  const recommendations = meals.filter((candidate) => candidate.id !== meal.id && (candidate.category === meal.category || candidate.slots.some((slot) => meal.slots.includes(slot)))).slice(0, 3);

  return <>
    <section className="container-shell thali-detail">
      <Button href={`/menu?${new URLSearchParams({ date, period })}`} variant="ghost" className="thali-back"><ArrowLeft className="size-4" aria-hidden="true" /> Back to menu</Button>
      <header className="thali-detail-intro"><div><Badge tone={meal.category === "Veg" ? "green" : "informational"}>{meal.category}</Badge><span className="thali-kicker">{meal.kind === "dish" ? "Make it a meal" : "Build your Thali"}</span></div><h1>{meal.name}</h1><p>{meal.shortDescription}</p><span className="thali-base-price">From ₹{meal.price} <small>per {meal.kind === "dish" ? "dish" : "Thali"}</small></span></header>
      <ThaliCustomizer key={`${meal.id}:${date}:${period}`} meal={meal} serviceDate={date} initialPeriod={period} editKey={query?.edit || ""} restore={query?.restore === "1"} />
    </section>
    {recommendations.length > 0 && <section className="border-t border-border bg-surface-alt py-8 md:py-12"><div className="container-shell"><SectionHeading eyebrow="More from the kitchen" title="You May Also Like" /><div role="region" aria-label="Recommended menu items" tabIndex={0} className="-mx-4 mt-4 grid auto-cols-[min(80vw,18rem)] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 scroll-px-4 snap-x snap-mandatory sm:mx-0 sm:grid-flow-row sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-3">{recommendations.map((item) => <MealCard key={item.id} meal={item} deliveryMealPeriod={validMealPeriod(period, item.slots) || item.slots[0]} serviceDate={date} />)}</div></div></section>}
  </>;
}
