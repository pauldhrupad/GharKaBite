import PageIntro from "@/components/PageIntro";
import PlansCatalog from "@/components/PlansCatalog";

export const metadata = { title: "Meal Plans | GharKaBite" };
export default function PlansPage() {
  return <><PageIntro eyebrow="Flexible meal plans" title="Choose your plan" description="Pick lunch, dinner or a mix. Demo payments collect no money." /><PlansCatalog /></>;
}
