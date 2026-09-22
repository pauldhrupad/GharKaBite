import CheckoutForm from "@/components/CheckoutForm";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Checkout | GharKaBite" };

export default function CheckoutPage() {
  return (
    <>
      <PageIntro eyebrow="Fast checkout" title="Complete your order" description="Review your contact and delivery details, choose a convenient slot, and place your order." />
      <CheckoutForm />
    </>
  );
}
