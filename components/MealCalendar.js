"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "./Badge";
import Button from "./Button";
import CustomerMealsAccess, { MealSignIn } from "./CustomerMealsAccess";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { orderStatusLabel, paymentPresentation } from "@/lib/order-utils";
import { usePrivateMeals } from "@/lib/use-private-meals";

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dateLabel = (date) => weekday.format(new Date(`${date}T12:00:00+05:30`));

export default function MealCalendar() {
  return <CustomerMealsAccess view={Agenda} returnTo="/profile/meal-calendar" />;
}

function Agenda({ returnTo }) {
  const read = usePrivateMeals("/api/orders?view=calendar");
  const [selected, setSelected] = useState("");
  if (read.status === 401) return <MealSignIn returnTo={returnTo} />;
  if (read.loading) return <LoadingState label="Loading your meal calendar" rows={2} />;
  if (read.error) return <div className="card-surface retention-card" role="alert"><p>{read.error}</p><Button type="button" onClick={read.retry} variant="outline">Try again</Button></div>;
  const { days, orders, truncated } = read.data;
  const active = days.includes(selected) ? selected : "";
  const visible = active ? orders.filter((order) => order.serviceDate === active) : orders;
  return <div className="retention-stack">
    <div className="card-surface retention-card">
      <div className="retention-row"><div><h2 className="type-section-title">Next seven days</h2><p className="type-supporting text-text-secondary">Kolkata service dates · Orders already placed</p></div><Button type="button" variant="outline" onClick={read.retry}>Refresh calendar</Button></div>
      <div className="retention-days" role="group" aria-label="Filter by service date">
        <button type="button" aria-pressed={!active} onClick={() => setSelected("")}>All dates</button>
        {days.map((date, index) => <button key={date} type="button" aria-pressed={date === active} onClick={() => setSelected(date)}>{index === 0 ? `Today · ${dateLabel(date)}` : dateLabel(date)}</button>)}
      </div>
      {truncated && <p className="checkout-notice mt-3" role="status">Showing the first 50 orders in this week. <Link href="/orders" className="font-bold underline">See My Orders</Link> for more.</p>}
      <p className="sr-only" role="status">{visible.length} shown{active ? ` for ${dateLabel(active)}` : ""}.</p>
    </div>
    {!visible.length ? <EmptyState title={truncated ? "No entries in this view" : "No orders recorded"} description={truncated ? "This calendar is limited to 50 results. Check My Orders for any additional entries." : active ? "You have no orders recorded for this date." : "Orders with a service date in this week will appear here. Plan credits are not booked meals."} actionLabel="My Orders" href="/orders" /> :
      days.filter((date) => visible.some((order) => order.serviceDate === date)).map((date) => <section key={date} aria-labelledby={`agenda-${date}`} className="retention-stack">
        <h2 id={`agenda-${date}`} className="type-section-title">{dateLabel(date)}</h2>
        <ul className="retention-grid">{visible.filter((order) => order.serviceDate === date).sort((a, b) => (a.mealPeriod === "Lunch" ? 0 : 1) - (b.mealPeriod === "Lunch" ? 0 : 1)).map((order) => {
          const payment = paymentPresentation(order);
          const tone = order.orderStatus === "cancelled" ? "cancelled" : order.orderStatus === "delivered" ? "success" : order.orderStatus === "payment_pending" ? "pending" : order.orderStatus === "confirmed" ? "confirmed" : "informational";
          return <li key={order.orderNumber} className="card-surface retention-card">
            <div className="retention-row"><h3 className="type-card-title">{order.mealPeriod}{order.deliverySlot ? ` · ${order.deliverySlot}` : ""}</h3><Badge tone={tone}>{orderStatusLabel(order)}</Badge></div>
            <p className="type-supporting mt-2">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(" · ")}</p>
            <div className="retention-row mt-3"><Badge tone={payment.tone}>{payment.label}</Badge><Link className="checkout-text-action" href={`/orders/${encodeURIComponent(order.orderNumber)}`}>Track order<span className="sr-only"> {order.orderNumber}</span></Link></div>
          </li>;
        })}</ul>
      </section>)}
  </div>;
}
