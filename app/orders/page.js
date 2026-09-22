import OrdersHistory from "@/components/OrdersHistory";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "My Orders | GharKaBite" };

export default function OrdersPage() {
  return <><PageIntro eyebrow="Your meal history" title="My orders" description="Track current deliveries and quickly reorder the meals you enjoyed." /><OrdersHistory /></>;
}
