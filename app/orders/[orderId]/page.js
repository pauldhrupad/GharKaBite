import OrderTracking from "@/components/OrderTracking";

export async function generateMetadata({ params }) {
  const { orderId } = await params;
  return { title: `${orderId} | GharKaBite` };
}

export default async function OrderTrackingPage({ params }) {
  const { orderId } = await params;
  return <OrderTracking orderId={orderId} />;
}
