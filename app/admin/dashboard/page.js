import Link from "next/link";
import { ArrowRight, ChefHat, Clock3, IndianRupee, ShoppingBag, Soup, Tag, UtensilsCrossed } from "lucide-react";
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
  const pendingOrders = activeOrders.filter((order) => !["payment_pending", "delivered", "cancelled"].includes(order.orderStatus));
  const paymentsToVerify = await Order.countDocuments({ paymentMethod: "manual_online", paymentStatus: "verification_pending", orderStatus: "payment_pending" });
  const revenue = activeOrders.filter((order) => order.paymentMethod === "COD" || order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  const kitchenItems = activeOrders.filter((order) => order.orderStatus !== "payment_pending").flatMap((order) => order.items);
  const categories = ["Veg", "Egg", "Chicken", "Fish", "Special"].map((category) => ({ category, quantity: kitchenItems.filter((item) => item.category === category).reduce((sum, item) => sum + item.quantity, 0) })).filter((entry) => entry.quantity > 0);
  const selectedCounts = new Map();
  const addOnCounts = new Map();
  for (const item of kitchenItems) {
    for (const group of item.selectedChoices || []) for (const option of group.options || []) selectedCounts.set(option.name, (selectedCounts.get(option.name) || 0) + item.quantity);
    for (const addOn of item.selectedAddOns || []) addOnCounts.set(addOn.name, (addOnCounts.get(addOn.name) || 0) + addOn.quantity * item.quantity);
  }
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

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Today’s metrics">{metrics.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-2xl border border-border bg-white p-5"><Icon className="size-5 text-primary" aria-hidden="true" /><p className="mt-5 text-2xl font-black">{value}</p><p className="text-sm font-black">{label}</p><p className="mt-1 text-xs text-text-secondary">{note}</p></article>)}<Link href="/admin/orders?paymentStatus=verification_pending" className="rounded-2xl border border-warning/40 bg-warning/10 p-5 hover:border-primary"><Clock3 className="size-5 text-warning" aria-hidden="true" /><p className="mt-5 text-2xl font-black">{paymentsToVerify}</p><p className="text-sm font-black">Payments to Verify</p><p className="mt-1 text-xs text-text-secondary">Open verification queue</p></Link></section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><ChefHat className="size-5" aria-hidden="true" /></span><div><h2 className="font-black">Kitchen preparation summary</h2><p className="text-xs text-text-secondary">Accepted Thalis and selected extras today</p></div></div><div className="mt-5 grid grid-cols-2 gap-3">{categories.map(({ category, quantity }) => <div key={category} className="rounded-xl bg-surface-muted p-4"><p className="text-2xl font-black">{quantity}</p><p className="text-sm font-bold text-text-secondary">{category} Thalis</p></div>)}</div>{selectedCounts.size > 0 && <div className="mt-4"><h3 className="text-sm font-black">Customer choices</h3><div className="mt-2 flex flex-wrap gap-2">{[...selectedCounts].map(([name, count]) => <span key={name} className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold">{name} ×{count}</span>)}</div></div>}{addOnCounts.size > 0 && <div className="mt-4"><h3 className="text-sm font-black">Add-ons to prepare</h3><div className="mt-2 flex flex-wrap gap-2">{[...addOnCounts].map(([name, count]) => <span key={name} className="rounded-full bg-accent/8 px-3 py-1 text-xs font-bold">{name} ×{count}</span>)}</div></div>}</section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-black">Kitchen queue</h2><p className="text-xs text-text-secondary">Orders needing attention</p></div><Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-black text-primary">View all <ArrowRight className="size-4" aria-hidden="true" /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-text-secondary"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Period</th><th className="px-5 py-3">Slot</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{pendingOrders.map((order) => <tr key={order.orderNumber} className="border-t border-border/70"><td className="px-5 py-4 font-black"><Link href={`/admin/orders/${order.orderNumber}`} className="text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-5 py-4 text-text-secondary">{order.customer.name}</td><td className="px-5 py-4 text-text-secondary">{order.mealPeriod}</td><td className="px-5 py-4 text-text-secondary">{order.deliverySlot}</td><td className="px-5 py-4"><span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-black capitalize text-warning">{order.orderStatus.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">Capacity today</h2><p className="text-xs text-text-secondary">Adjust limits from Kitchen Settings.</p></div><Link href="/admin/settings" className="text-sm font-black text-primary">Edit settings</Link></div><div className="mt-5 grid gap-5 md:grid-cols-3">{[["All orders", activeOrders.length, settings.dailyMaximum], ["Lunch", lunchOrders.length, settings.lunchMaximum], ["Dinner", dinnerOrders.length, settings.dinnerMaximum]].map(([label, value, maximum]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{label}</span><span className="text-text-secondary">{value}/{maximum}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (value / maximum) * 100)}%` }} /></div></div>)}</div></section>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Tag className="size-5" aria-hidden="true" /></span><div><h2 className="font-black">Offers & delivery</h2><p className="text-xs text-text-secondary">Free delivery from ₹{settings.freeDeliveryThreshold ?? defaultKitchenSettings.freeDeliveryThreshold}. Create and manage one-use-per-account promo codes.</p></div></div><Link href="/admin/settings#promotions" className="inline-flex min-h-10 items-center text-sm font-black text-primary">Manage promo codes <ArrowRight className="ml-1 size-4" aria-hidden="true" /></Link></section>
    </>
  );
}
