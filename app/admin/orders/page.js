import AdminOrdersTable from "@/components/AdminOrdersTable";

export default async function AdminOrdersPage({ searchParams }) {
  const { paymentStatus } = await searchParams;
  return <><div><p className="eyebrow">Operations</p><h1 className="mt-1 text-3xl font-black">Orders</h1><p className="mt-1 text-sm text-text-secondary">Search, filter and move every order through the kitchen queue.</p></div><AdminOrdersTable initialPaymentFilter={paymentStatus || "all"} /></>;
}
