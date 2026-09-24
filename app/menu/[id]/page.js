import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock3, Layers3, PackageCheck } from "lucide-react";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import MealCard from "@/components/MealCard";
import ThaliCustomizer from "@/components/ThaliCustomizer";
import SectionHeading from "@/components/SectionHeading";
import { getMenu } from "@/lib/catalog";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";

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

  const recommendations = meals
    .filter((candidate) => candidate.id !== meal.id && (candidate.category === meal.category || candidate.slots.some((slot) => meal.slots.includes(slot))))
    .slice(0, 3);

  const unavailable = !meal.available;

  return (
    <>
      <section className="container-shell py-8 md:py-14">
        <Button href="/menu" variant="ghost" className="-ml-3 mb-5"><ArrowLeft className="size-4" aria-hidden="true" /> Back to menu</Button>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="lg:sticky lg:top-24"><div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border bg-surface-muted">
            <Image src={meal.image} alt={`${meal.name}: ${meal.contents.join(", ")}`} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className={`object-cover ${unavailable ? "grayscale-[35%]" : ""}`} />
            {unavailable && <div className="absolute inset-0 grid place-items-center bg-text-primary/55"><span className="rounded-full bg-white px-5 py-2.5 font-black">Currently unavailable</span></div>}
          </div></div>

          <div className="lg:py-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone={meal.category === "Veg" ? "green" : "terracotta"}>{meal.category}</Badge>
              {meal.badges.filter((badge) => badge !== "Limited").map((badge) => <Badge key={badge} tone="muted">{badge}</Badge>)}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] md:text-5xl">{meal.name}</h1>
            {meal.choiceUnavailable && <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm font-bold text-warning">A required choice is currently unavailable, so this item cannot be ordered.</p>}
            <p className="mt-3 text-lg font-bold text-accent">{meal.shortDescription}</p>
            <p className="mt-5 text-base leading-8 text-text-secondary">{meal.description}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-muted p-4"><Layers3 className="size-5 text-primary" aria-hidden="true" /><p className="mt-2 text-xs font-bold text-text-secondary">{meal.kind === "dish" ? "Dish category" : "Thali type"}</p><p className="font-black">{meal.category}</p></div>
              <div className="rounded-xl bg-surface-muted p-4"><Clock3 className="size-5 text-primary" aria-hidden="true" /><p className="mt-2 text-xs font-bold text-text-secondary">Available for</p><p className="font-black">{meal.slots.join(" & ")}</p></div>
              <div className="rounded-xl bg-surface-muted p-4"><PackageCheck className="size-5 text-primary" aria-hidden="true" /><p className="mt-2 text-xs font-bold text-text-secondary">Availability</p><p className={`font-black ${unavailable ? "text-danger" : "text-success"}`}>{unavailable ? "Currently unavailable" : "Available"}</p></div>
            </div>

            {meal.kind !== "dish" && <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-text-secondary">Included in your Thali</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {meal.fixedItems.map((item) => <li key={item.name} className="flex items-center gap-2 text-sm font-bold"><span className="grid size-5 place-items-center rounded-full bg-success/10"><Check className="size-3 text-success" aria-hidden="true" /></span>{item.name}</li>)}
              </ul>
            </div>}

            <ThaliCustomizer meal={meal} serviceDate={date} editKey={query?.edit || ""} restore={query?.restore === "1"} />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted/60 py-12 md:py-16">
        <div className="container-shell">
          <SectionHeading eyebrow="More from today's kitchen" title="You May Also Like" />
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((recommendation) => <MealCard key={recommendation.id} meal={recommendation} deliveryMealPeriod={recommendation.slots[0]} serviceDate={date} />)}
          </div>
        </div>
      </section>
    </>
  );
}
