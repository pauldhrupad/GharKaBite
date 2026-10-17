import CartPageContent from "@/components/CartPageContent";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Your Cart | GharKaBite" };

export default function CartPage() {
  return (
    <>
      <div className="checkout-page-intro"><PageIntro title="Your Cart" description="Review your homemade meals." /></div>
      <CartPageContent />
    </>
  );
}
