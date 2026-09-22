import { Clock3 } from "lucide-react";
import MenuExplorer from "@/components/MenuExplorer";
import PageIntro from "@/components/PageIntro";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";

export const metadata = {
  title: "Today's Menu | GharKaBite",
  description: "Browse today's fresh homemade lunch and dinner meals from GharKaBite.",
};

export default async function MenuPage({ searchParams }) {
  const query = await searchParams;
  const initialDate = allowedOrderDate(query?.date) ? query.date : kolkataDate();
  return (
    <>
      <PageIntro eyebrow="আজকের রান্না" title="Today's Menu" description="Freshly prepared in limited quantities.">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-text-secondary">
          <Clock3 className="size-4 text-primary" aria-hidden="true" /> Lunch closes at 11 AM · Dinner at 6 PM
        </div>
      </PageIntro>
      <MenuExplorer initialDate={initialDate} />
    </>
  );
}
