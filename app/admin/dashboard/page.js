import Link from "next/link";
import { ArrowRight, ChefHat, Clock3, IndianRupee, ShoppingBag, Soup, UtensilsCrossed } from "lucide-react";
import { defaultKitchenSettings } from "@/lib/kitchen-operations";
import { kolkataDate } from "@/lib/dates";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import KitchenSettings from "@/models/KitchenSettings";

export const dynamic = "force-dynamic";
export default async function AdminDashboardPage() {
  await dbConnect();
  const orders = await Order.find({ serviceDate: kolkataDate(), orderStatus: { $ne: "cancelled" } }).lean();
  const settings = await KitchenSettings.findOne({ key: "primary" }).lean() || defaultKitchenSettings;
  const activeOrders = orders;
  const lunchOrders = activeOrders.filter((order) => order.mealPeriod === "Lunch");
  const dinnerOrders = activeOrders.filter((order) => order.mealPeriod === "Dinner");
  const pendingOrders = activeOrders.filter((order) => !["delivered", "cancelled"].includes(order.orderStatus));
  const revenue = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const categories = ["Veg", "Egg", "Chicken", "Fish"].map((category) => ({ category, quantity: activeOrders.flatMap((order) => order.items).filter((item) => item.category === category).reduce((sum, item) => sum + item.quantity, 0) }));
  const metrics = [
    { label: "Total Orders", value: activeOrders.length, note: "Accepted today", icon: ShoppingBag },
    { label: "Lunch Orders", value: lunchOrders.length, note: `${Math.max(0, settings.lunchMaximum - lunchOrders.length)} slots remaining`, icon: Soup },
    { label: "Dinner Orders", value: dinnerOrders.length, note: `${Math.max(0, settings.dinnerMaximum - dinnerOrders.length)} slots remaining`, icon: UtensilsCrossed },
    { label: "Revenue", value: `₹${revenue.toLocaleString("en-IN")}`, note: "Excludes cancelled", icon: IndianRupee },
    { label: "Pending Orders", value: pendingOrders.length, note: "Needs kitchen action", icon: Clock3 },
  ];

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Today’s operations</p><h1 className="mt-1 text-3xl font-black tracking-tight">Kitchen overview</h1><p className="mt-1 text-sm text-text-secondary">Orders, preparation quantities and delivery workload in one place.</p></div><span className="inline-flex self-start rounded-full bg-success/10 px-3 py-1.5 text-xs font-black text-success">Kitchen accepting orders</span></div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Today’s metrics">{metrics.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-2xl border border-border bg-white p-5"><Icon className="size-5 text-primary" aria-hidden="true" /><p className="mt-5 text-2xl font-black">{value}</p><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs text-text-secondary">{note}</p></article>)}</section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><ChefHat className="size-5" aria-hidden="true" /></span><div><h2 className="font-black">Kitchen preparation summary</h2><p className="text-xs text-text-secondary">Total portions required today</p></div></div><div className="mt-5 grid grid-cols-2 gap-3">{categories.map(({ category, quantity }) => <div key={category} className="rounded-xl bg-surface-muted p-4"><p className="text-2xl font-black">{quantity}</p><p className="text-sm font-bold text-text-secondary">{category} Meals</p></div>)}</div></section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-black">Kitchen queue</h2><p className="text-xs text-text-secondary">Orders needing attention</p></div><Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-black text-primary">View all <ArrowRight className="size-4" aria-hidden="true" /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-text-secondary"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Period</th><th className="px-5 py-3">Slot</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{pendingOrders.map((order) => <tr key={order.orderNumber} className="border-t border-border/70"><td className="px-5 py-4 font-black"><Link href={`/admin/orders/${order.orderNumber}`} className="text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-5 py-4 text-text-secondary">{order.customer.name}</td><td className="px-5 py-4 text-text-secondary">{order.mealPeriod}</td><td className="px-5 py-4 text-text-secondary">{order.deliverySlot}</td><td className="px-5 py-4"><span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-black capitalize text-warning">{order.orderStatus.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">Capacity today</h2><p className="text-xs text-text-secondary">Adjust limits from Kitchen Settings.</p></div><Link href="/admin/settings" className="text-sm font-black text-primary">Edit settings</Link></div><div className="mt-5 grid gap-5 md:grid-cols-3">{[["All orders", activeOrders.length, settings.dailyMaximum], ["Lunch", lunchOrders.length, settings.lunchMaximum], ["Dinner", dinnerOrders.length, settings.dinnerMaximum]].map(([label, value, maximum]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{label}</span><span className="text-text-secondary">{value}/{maximum}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (value / maximum) * 100)}%` }} /></div></div>)}</div></section>
    </>
  );
}
