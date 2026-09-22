import { getMenu } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export default async function sitemap() {
  const origin = process.env.SITE_URL || "http://localhost:3000";
  const paths = ["", "/menu", "/plans", "/about", "/contact", "/privacy", "/terms", "/refund-policy"];
  let meals = [];
  try { meals = (await getMenu()).filter((meal) => meal.available); } catch { /* Static routes remain available. */ }
  return [...paths, ...meals.map((meal) => `/menu/${meal.id}`)].map((path) => ({ url: `${origin}${path}`, lastModified: new Date() }));
}
