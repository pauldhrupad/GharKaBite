import PageIntro from "@/components/PageIntro";
import MealCalendar from "@/components/MealCalendar";

export const metadata = { title: "My Meal Calendar", robots: { index: false, follow: false } };

export default function MealCalendarPage() {
  return <><PageIntro eyebrow="Your meal routine" title="My Meal Calendar" description="See your recorded meals for the week ahead." /><section className="container-shell retention-page"><MealCalendar /></section></>;
}
