import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign In | GharKaBite" };

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  return <LoginForm callbackUrl={query?.callbackUrl || "/profile"} />;
}
