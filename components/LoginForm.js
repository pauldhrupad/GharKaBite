"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Button from "./Button";
import OwnerAuthShell from "./OwnerAuthShell";

function safeCallbackUrl(value, fallback) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Invalid return paths fall back to the appropriate account area.
  }
  return fallback;
}

export default function LoginForm({ callbackUrl, owner = false }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn("credentials", { identifier, password, redirect: false });
      if (result?.error) {
        setError("Email/phone or password is incorrect. Please check your details and try again.");
        return;
      }
      if (owner) {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = response.ok ? await response.json() : null;
        if (session?.user?.role !== "admin") {
          setError("This account does not have owner access. Sign in with your admin account or enable its admin role first.");
          return;
        }
      }
      router.push(safeCallbackUrl(callbackUrl, owner ? "/admin/dashboard" : "/profile"));
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <>
      <div className={`grid size-12 place-items-center rounded-2xl ${owner ? "bg-[#e9efe9] text-[#244c35]" : "bg-primary/10 text-primary"}`}><LockKeyhole className="size-6" aria-hidden="true" /></div>
      <p className={`mt-6 text-xs font-extrabold uppercase tracking-[0.16em] ${owner ? "text-[#5c8067]" : "text-accent"}`}>{owner ? "Owner sign in" : "Welcome back"}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">{owner ? "Your kitchen dashboard" : "Sign in to GharKaBite"}</h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{owner ? "Sign in with your admin account to manage orders, menus and meal plans." : "Access orders, saved addresses and meal plans."}</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <label className="block text-sm font-bold">Email or phone<input className="input-field mt-2" name="identifier" type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="Email address or 10-digit phone" required /></label>
        <label className="block text-sm font-bold">Password<input className="input-field mt-2" name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
        {error && <p className="rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger" role="alert">{error}</p>}
        <Button type="submit" disabled={submitting} className={`w-full disabled:opacity-55 ${owner ? "!bg-[#244c35] hover:!bg-[#193c2c]" : ""}`}>{submitting ? "Signing in…" : <>{owner ? "Open admin dashboard" : "Sign in"} <ArrowRight className="size-4" aria-hidden="true" /></>}</Button>
      </form>
      {owner ? <p className="mt-5 text-center text-xs text-text-secondary">Ordering food? <Link href="/login" className="font-bold text-primary underline underline-offset-2">Customer sign in</Link></p> : <p className="mt-5 text-center text-sm text-text-secondary">New here? <Link href="/register" className="font-black text-primary hover:underline">Create an account</Link></p>}
    </>
  );

  if (owner) return <OwnerAuthShell>{form}</OwnerAuthShell>;
  return <section className="container-shell grid min-h-[70vh] place-items-center py-12"><div className="card-surface w-full max-w-md p-6 md:p-8">{form}</div></section>;
}
