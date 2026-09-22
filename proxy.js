export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/profile/:path*", "/orders", "/subscriptions/:path*", "/admin/:path*"],
};
