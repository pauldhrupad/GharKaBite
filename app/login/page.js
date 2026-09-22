import LoginForm from "@/components/LoginForm";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign In | GharKaBite" };

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const callback = String(query?.callbackUrl || "");
  if (/^(?:https?:\/\/[^/]+)?\/admin(?:\/|$|\?)/.test(callback)) redirect("/owner/login");
  return <LoginForm callbackUrl={query?.callbackUrl || "/profile"} />;
}
