import MenuExplorer from "@/components/MenuExplorer";
import PageIntro from "@/components/PageIntro";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";

export const metadata = {
  title: "Menu",
  description: "Browse fresh homemade Thalis and individual dishes for lunch and dinner from GharKaBite.",
};

export default async function MenuPage({ searchParams }) {
  const query = await searchParams;
  const initialDate = allowedOrderDate(query?.date) ? query.date : kolkataDate();
  return (
    <>
      <PageIntro eyebrow="আজকের রান্না" title="Today's Thalis & Dishes" description="Choose lunch or dinner and order before the kitchen cutoff." />
      <MenuExplorer initialDate={initialDate} />
    </>
  );
}
