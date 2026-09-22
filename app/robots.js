export default function robots() {
  const origin = process.env.SITE_URL || "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/checkout", "/cart", "/login", "/register", "/orders", "/profile", "/subscriptions"] }, sitemap: `${origin}/sitemap.xml` };
}
