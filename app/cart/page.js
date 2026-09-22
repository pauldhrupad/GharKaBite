import CartPageContent from "@/components/CartPageContent";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Your Cart | GharKaBite" };

export default function CartPage() {
  return (
    <>
      <PageIntro eyebrow="Almost there" title="Your cart" description="Review quantities and lunch or dinner selections before checkout." />
      <CartPageContent />
    </>
  );
}
