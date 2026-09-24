"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Badge from "./Badge";

const categoryStyles = {
  Veg: "bg-success",
  Egg: "bg-warning",
  Chicken: "bg-accent",
  Fish: "bg-primary",
  Special: "bg-accent",
};

export default function MealCard({ meal, deliveryMealPeriod, serviceDate, orderingDisabled = false, unavailableReason = "" }) {
  const selectedPeriod = deliveryMealPeriod || meal.slots[0];
  const unavailable = !meal.available || orderingDisabled;

  return (
    <article className={`meal-card group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_14px_38px_rgba(56,45,31,0.07)] ${unavailable ? "is-sold-out" : ""}`}>
      <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="relative block aspect-[4/3] overflow-hidden bg-surface-muted" aria-label={`View ${meal.name}`}>
        <Image
          src={meal.image}
          alt={`${meal.name}: ${meal.contents.join(", ")}`}
          fill
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 50vw, 33vw"
          className={`meal-card-image object-cover ${unavailable ? "grayscale-[35%]" : ""}`}
        />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {meal.badges.filter((badge) => badge !== "Limited").slice(0, 2).map((badge) => <Badge key={badge} onImage tone="green">{badge}</Badge>)}
        </div>
        {unavailable && <div className="absolute inset-0 grid place-items-center bg-text-primary/55"><span className="rounded-full bg-white px-4 py-2 text-sm font-black text-text-primary">{orderingDisabled ? "Ordering Closed" : meal.choiceUnavailable ? "Required choice unavailable" : "Currently unavailable"}</span></div>}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-text-secondary">
          <span className={`size-2.5 rounded-full ${categoryStyles[meal.category]}`} aria-hidden="true" />
          {meal.category} {meal.kind === "dish" ? "Dish" : "Thali"}
        </div>
        <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="mt-2 w-fit hover:text-primary">
          <h2 className="text-lg font-black tracking-tight">{meal.name}</h2>
        </Link>
        <p className="mt-1 text-sm leading-5 text-text-secondary">{meal.kind === "dish" ? meal.shortDescription : meal.contents.join(" + ")}</p>
        <div className="mt-3 flex min-h-5 items-center">
          {orderingDisabled ? <p className="text-xs font-black text-danger">{unavailableReason}</p> : !unavailable ? <p className="text-xs font-bold text-success">Available for {selectedPeriod}</p> : <p className="text-xs font-black text-danger">Currently unavailable</p>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xl font-black">{meal.addOns.length || meal.choiceGroups.some((group) => group.options.some((option) => option.priceAdjustment)) ? "From " : ""}₹{meal.price}</p>
          {unavailable ? <span className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-extrabold text-text-secondary">{orderingDisabled ? "Closed" : "Unavailable"}</span> : <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-extrabold text-white hover:bg-primary-hover">{meal.kind === "dish" ? "View dish" : "Customize Thali"} <ArrowRight className="size-4" aria-hidden="true" /></Link>}
        </div>
      </div>
    </article>
  );
}
