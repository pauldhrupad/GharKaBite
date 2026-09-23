import OrderPayment from "@/components/OrderPayment";

export default async function PaymentPage({ params }) {
  const { orderId } = await params;
  return <OrderPayment orderId={orderId} />;
}
