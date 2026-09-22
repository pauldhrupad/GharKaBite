import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Order from "@/models/Order";

export const dynamic = "force-dynamic";
export default async function AdminCustomersPage() {
  await dbConnect();
  const customers = await User.find({ role: "customer" }).select("name email phone createdAt").sort({ createdAt: -1 }).limit(100).lean();
  const counts = await Order.aggregate([{ $match: { user: { $in: customers.map((user) => user._id) } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]);
  const byId = new Map(counts.map((item) => [String(item._id), item.count]));
  return <section><p className="eyebrow">Community</p><h1 className="mt-1 text-3xl font-black">Customers</h1><p className="mt-2 text-sm text-text-secondary">{customers.length} registered customers shown</p><div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-white">{customers.map((user) => <article key={String(user._id)} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-black">{user.name}</h2><p className="text-sm text-text-secondary">{user.email} · {user.phone}</p></div><p className="text-sm font-bold">{byId.get(String(user._id)) || 0} orders</p></article>)}{!customers.length && <p className="p-6 text-sm text-text-secondary">No registered customers yet.</p>}</div></section>;
}
