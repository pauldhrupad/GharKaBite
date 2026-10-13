import PageIntro from "@/components/PageIntro";
import PlansCatalog from "@/components/PlansCatalog";

export const metadata = { title: "Meal Plans | GharKaBite" };
export default function PlansPage() {
  return <><PageIntro eyebrow="Flexible meal plans" title="Choose your plan" description="Browse lunch, dinner or mixed plans. Purchases are temporarily unavailable; existing plan credits remain usable." /><PlansCatalog /></>;
}
