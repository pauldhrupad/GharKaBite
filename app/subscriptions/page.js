import PageIntro from "@/components/PageIntro";
import SubscriptionDashboard from "@/components/SubscriptionDashboard";

export const metadata = { title: "My Subscriptions | GharKaBite", robots: { index: false } };
export default function SubscriptionsPage() { return <><PageIntro eyebrow="Meal plans" title="My subscriptions" description="See your remaining meals, expiry and usage history." /><SubscriptionDashboard /></>; }
