import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import BrandMark from "@/components/BrandMark";
import Button from "@/components/Button";
import { authContinueHref, customerReturnTo } from "@/lib/auth-navigation";

export const metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default async function WelcomePage({ searchParams }) {
  const query = await searchParams;
  const returnTo = customerReturnTo(query?.returnTo);
  const session = await auth();
  if (session?.user?.id) redirect(returnTo);
  const nextHref = authContinueHref(query?.mode, returnTo);

  return <main className="auth-welcome">
    <div className="welcome-photo"><Image src="/images/kolkata-home-meal.png" alt="A comforting Bengali meal with rice, dal, vegetables and fish curry" fill preload sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /></div>
    <section className="welcome-content"><div className="welcome-content-inner">
      <BrandMark className="welcome-logo" loading="eager" />
      <h1>GharKaBite</h1>
      <p className="mt-4 text-xl font-bold leading-relaxed">Homemade Meals<br />Delivered with Love</p>
      <p className="welcome-phrase mt-5">Ghorer Khabar,<br />Ghore Ghore</p>
      <Button href={nextHref} className="welcome-start">Get Started <ArrowRight className="size-4" aria-hidden="true" /></Button>
      <Link href={returnTo === "/profile" ? "/" : returnTo} className="welcome-back"><ArrowLeft className="size-4" aria-hidden="true" /> Back to browsing</Link>
      <p className="mt-7 text-sm">Good Food Brings People Together</p>
    </div></section>
  </main>;
}
