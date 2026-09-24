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
    <article className={`meal-card group flex h-full min-w-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_4px_14px_rgba(30,40,34,0.07)] ${unavailable ? "is-sold-out" : ""}`}>
      <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-muted sm:aspect-[4/3]" aria-label={`View ${meal.name}`}>
        <Image
          src={meal.image}
          alt={`${meal.name}: ${meal.contents.join(", ")}`}
          fill
          sizes="(max-width: 640px) 288px, (max-width: 1024px) 50vw, 33vw"
          className={`meal-card-image object-cover ${unavailable ? "grayscale-[35%]" : ""}`}
        />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {meal.badges.filter((badge) => badge !== "Limited").slice(0, 2).map((badge) => <Badge key={badge} onImage tone="green">{badge}</Badge>)}
        </div>
        {unavailable && <div className="absolute inset-0 grid place-items-center bg-text-primary/55"><span className="rounded-full bg-white px-4 py-2 text-sm font-black text-text-primary">{orderingDisabled ? "Ordering Closed" : meal.choiceUnavailable ? "Required choice unavailable" : "Currently unavailable"}</span></div>}
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-text-secondary">
          <span className={`size-2.5 rounded-full ${categoryStyles[meal.category]}`} aria-hidden="true" />
          {meal.category} {meal.kind === "dish" ? "Dish" : "Thali"}
        </div>
        <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="mt-1.5 w-fit hover:text-primary sm:mt-2">
          <h2 className="text-base font-black tracking-tight sm:text-lg">{meal.name}</h2>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-secondary sm:line-clamp-none">{meal.kind === "dish" ? meal.shortDescription : meal.contents.join(" + ")}</p>
        <div className="mt-2 flex min-h-5 items-center sm:mt-3">
          {orderingDisabled ? <p className="text-xs font-black text-danger">{unavailableReason}</p> : !unavailable ? <p className="text-xs font-bold text-success">Available for {selectedPeriod}</p> : <p className="text-xs font-black text-danger">Currently unavailable</p>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 sm:gap-3 sm:pt-4">
          <p className="text-lg font-black text-accent sm:text-xl">{meal.addOns.length || meal.choiceGroups.some((group) => group.options.some((option) => option.priceAdjustment)) ? "From " : ""}₹{meal.price}</p>
          {unavailable ? <span className="rounded-xl bg-surface-muted px-3 py-2 text-sm font-extrabold text-text-secondary sm:px-4">{orderingDisabled ? "Closed" : "Unavailable"}</span> : <Link href={`/menu/${meal.id}?date=${serviceDate}`} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-extrabold text-white hover:bg-primary-hover sm:min-h-10 sm:px-4">{meal.kind === "dish" ? "View dish" : <><span className="sm:hidden">Customize</span><span className="hidden sm:inline">Customize Thali</span></>} <ArrowRight className="size-4" aria-hidden="true" /></Link>}
        </div>
      </div>
    </article>
  );
}
