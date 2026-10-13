import RegisterForm from "@/components/RegisterForm";

export const metadata = { title: "Create Account | GharKaBite" };

export default async function RegisterPage({ searchParams }) {
  const query = await searchParams;
  return <RegisterForm callbackUrl={typeof query?.callbackUrl === "string" ? query.callbackUrl : "/profile"} />;
}
