import AdminOrderDetail from "@/components/AdminOrderDetail";

export default async function AdminOrderDetailPage({ params }) {
  const { orderId } = await params;
  return <AdminOrderDetail orderId={orderId} initialOrder={null} />;
}
