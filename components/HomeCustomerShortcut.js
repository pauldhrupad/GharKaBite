"use client";

import { useSession } from "next-auth/react";
import { Heart, RotateCcw } from "lucide-react";
import Button from "./Button";
import { usePrivateMeals } from "@/lib/use-private-meals";

export default function HomeCustomerShortcut() {
  const { data, status } = useSession();
  return status === "authenticated" && data?.user?.id ? <Shortcut key={data.user.id} /> : null;
}

function Shortcut() {
  const { data } = usePrivateMeals("/api/customer-shortcut");
  const shortcut = data?.shortcut;
  if (!shortcut) return null;
  const favorite = shortcut.type === "favorite";
  const Icon = favorite ? Heart : RotateCcw;
  const href = `/profile/reorder?${new URLSearchParams({ [favorite ? "favorite" : "order"]: shortcut.id })}`;
  return <section className="home-support container-shell" aria-labelledby="home-saved-meal"><div className="card-surface retention-card retention-row">
    <div><p className="eyebrow inline-flex items-center gap-2"><Icon size={16} aria-hidden="true" />{favorite ? "Your saved favorite" : "Order again"}</p><h2 id="home-saved-meal" className="type-card-title">{shortcut.name}{!favorite && shortcut.count > 1 ? ` + ${shortcut.count - 1} more` : ""}</h2><p className="type-supporting text-text-secondary">{shortcut.mealPeriod} · Review current options before adding</p></div>
    <Button href={href} variant="outline">Review meal{!favorite && shortcut.count > 1 ? "s" : ""}</Button>
  </div></section>;
}
