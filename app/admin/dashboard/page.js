import Link from "next/link";
import { ArrowRight, ChefHat, Clock3, IndianRupee, ShoppingBag, Soup, Tag, UtensilsCrossed } from "lucide-react";
import { defaultKitchenSettings, formatCutoffTime, isPastCutoff } from "@/lib/kitchen-operations";
import { kolkataDate } from "@/lib/dates";
import { summarizePreparation } from "@/lib/preparation";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import KitchenSettings from "@/models/KitchenSettings";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await dbConnect();
  const today = kolkataDate();
  const [orders, storedSettings, paymentsToVerify] = await Promise.all([
    Order.find({ serviceDate: today }).lean(),
    KitchenSettings.findOne({ key: "primary" }).lean(),
    Order.countDocuments({ paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending" }),
  ]);
  const settings = { ...defaultKitchenSettings, ...storedSettings };
  const lunch = summarizePreparation(orders, { date: today, mealPeriod: "Lunch" });
  const dinner = summarizePreparation(orders, { date: today, mealPeriod: "Dinner" });
  const activeOrders = orders.filter((order) => order.orderStatus !== "cancelled");
  const pendingOrders = activeOrders.filter((order) => !["payment_pending", "delivered", "cancelled"].includes(order.orderStatus));
  const revenue = activeOrders.filter((order) => order.paymentMethod === "COD" || order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  const metrics = [
    { label: "Today's Confirmed Orders", value: lunch.confirmedOrders + dinner.confirmedOrders, note: "Counted for cooking", icon: ShoppingBag },
    { label: "Lunch Orders", value: lunch.confirmedOrders, note: "Confirmed for cooking", icon: Soup },
    { label: "Dinner Orders", value: dinner.confirmedOrders, note: "Confirmed for cooking", icon: UtensilsCrossed },
    { label: "Revenue", value: `₹${revenue.toLocaleString("en-IN")}`, note: "Excludes cancelled", icon: IndianRupee },
    { label: "Pending Orders", value: pendingOrders.length, note: "Needs kitchen action", icon: Clock3 },
  ];

  return <>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Today’s operations</p><h1 className="mt-1 text-3xl font-black tracking-tight">Kitchen overview</h1><p className="mt-1 text-sm text-text-secondary">Cook according to confirmed orders received before cutoff.</p></div><span className={`inline-flex self-start rounded-full px-3 py-1.5 text-xs font-black ${settings.acceptingOrders === false ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{settings.acceptingOrders === false ? "Ordering paused" : "Kitchen accepting orders"}</span></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Today’s metrics">{metrics.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-2xl border border-border bg-white p-5"><Icon className="size-5 text-primary" aria-hidden="true" /><p className="mt-5 text-2xl font-black">{value}</p><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs text-text-secondary">{note}</p></article>)}<Link href="/admin/orders?paymentStatus=verification_pending" className="rounded-2xl border border-warning/40 bg-warning/10 p-5 hover:border-primary"><Clock3 className="size-5 text-warning" aria-hidden="true" /><p className="mt-5 text-2xl font-black">{paymentsToVerify}</p><p className="text-sm font-black">Payments to Verify</p><p className="mt-1 text-xs text-text-secondary">Not counted for cooking yet</p></Link></section>
    <section className="mt-6 rounded-2xl border border-border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-black"><ChefHat className="size-5 text-primary" aria-hidden="true" /> Preparation summary</h2><p className="mt-1 text-xs text-text-secondary">Live quantities from valid confirmed orders</p></div><Link href="/admin/preparation" className="inline-flex min-h-11 items-center gap-1 text-sm font-black text-primary hover:underline">View preparation sheet <ArrowRight className="size-4" aria-hidden="true" /></Link></div><div className="mt-4 grid gap-3 md:grid-cols-2">{[["Lunch", lunch], ["Dinner", dinner]].map(([period, summary]) => <div key={period} className="rounded-xl bg-surface-muted p-4"><p className="text-xs font-black uppercase tracking-wide text-primary">{isPastCutoff(period, settings) ? `${period} orders closed · Final` : `${period} closes at ${formatCutoffTime(period === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff)}`}</p><p className="mt-2 text-2xl font-black">{summary.confirmedOrders} confirmed orders</p><div className="mt-3 flex flex-wrap gap-2">{summary.thalis.map((item) => <span key={item.name} className="rounded-full bg-white px-3 py-1 text-xs font-bold">{item.name} ×{item.quantity}</span>)}</div><Link href={`/admin/preparation?date=${today}&period=${period}`} className="mt-3 inline-flex text-sm font-black text-primary underline underline-offset-2">{isPastCutoff(period, settings) ? "View final preparation sheet" : "View live preparation sheet"}</Link></div>)}</div></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-black">Kitchen queue</h2><p className="text-xs text-text-secondary">Orders needing attention</p></div><Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-black text-primary">View all <ArrowRight className="size-4" aria-hidden="true" /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-text-secondary"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Period</th><th className="px-5 py-3">Slot</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{pendingOrders.map((order) => <tr key={order.orderNumber} className="border-t border-border/70"><td className="px-5 py-4 font-black"><Link href={`/admin/orders/${order.orderNumber}`} className="text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-5 py-4 text-text-secondary">{order.customer.name}</td><td className="px-5 py-4 text-text-secondary">{order.mealPeriod}</td><td className="px-5 py-4 text-text-secondary">{order.deliverySlot}</td><td className="px-5 py-4"><span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-black capitalize text-warning">{order.orderStatus.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></section>
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Tag className="size-5" aria-hidden="true" /></span><div><h2 className="font-black">Offers & delivery</h2><p className="text-xs text-text-secondary">Free delivery from ₹{settings.freeDeliveryThreshold}. Create and manage one-use-per-account promo codes.</p></div></div><Link href="/admin/settings#promotions" className="inline-flex min-h-10 items-center text-sm font-black text-primary">Manage promo codes <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link></section>
  </>;
}
