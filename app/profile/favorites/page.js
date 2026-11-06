import FavoritesList from "@/components/FavoritesList";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "My Favorites", robots: { index: false, follow: false } };

export default function FavoritesPage() {
  return <><PageIntro eyebrow="Familiar meals" title="My Favorites" description="Save the Thalis you like and review the current menu before ordering again." /><section className="container-shell retention-page"><FavoritesList /></section></>;
}
