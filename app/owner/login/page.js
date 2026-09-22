import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Owner Sign In", robots: { index: false, follow: false } };

export default async function OwnerLoginPage() {
  const session = await auth();
  if (session?.user?.role === "admin") redirect("/admin/dashboard");
  return <LoginForm callbackUrl="/admin/dashboard" owner />;
}
