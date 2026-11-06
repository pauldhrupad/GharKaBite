import Link from "next/link";
import PageIntro from "@/components/PageIntro";
import RepeatMealReview from "@/components/RepeatMealReview";

export const metadata = { title: "Review saved meals", robots: { index: false, follow: false } };

export default async function ReorderPage({ searchParams }) {
  const { order, favorite } = await searchParams;
  const orderNumber = typeof order === "string" && /^[a-z0-9-]{1,100}$/i.test(order) ? order : "";
  const favoriteId = typeof favorite === "string" && /^[a-f0-9]{24}$/i.test(favorite) ? favorite : "";
  const valid = Boolean(orderNumber) !== Boolean(favoriteId) && !(order != null && favorite != null);
  const returnTo = valid ? `/profile/reorder?${new URLSearchParams(orderNumber ? { order: orderNumber } : { favorite: favoriteId })}` : "/profile/reorder";
  return <><PageIntro eyebrow="Make it yours again" title="Review saved meals" description="Choose a delivery date and review today’s choices and prices before adding to your cart." />
    <section className="container-shell retention-page">{valid ? <RepeatMealReview orderNumber={orderNumber} favoriteId={favoriteId} returnTo={returnTo} /> : <div className="card-surface retention-card"><p>Choose an order or favorite to review.</p><Link className="checkout-text-action" href="/orders">My orders</Link></div>}</section></>;
}
