import CheckoutForm from "@/components/CheckoutForm";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Checkout | GharKaBite" };

export default function CheckoutPage() {
  return (
    <>
      <div className="checkout-page-intro"><PageIntro title="Checkout" description="A few details, then we’ll get cooking." /></div>
      <CheckoutForm />
    </>
  );
}
