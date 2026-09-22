"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Button from "./Button";

export default function LoginForm({ callbackUrl }) {
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
        setError("Email/phone or password is incorrect. If MongoDB is not configured yet, registration and login remain unavailable.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="container-shell grid min-h-[70vh] place-items-center py-12"><div className="card-surface w-full max-w-md p-6 md:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-6" aria-hidden="true" /></div><p className="eyebrow mt-6">Welcome back</p><h1 className="mt-2 text-3xl font-black tracking-tight">Sign in to GharKaBite</h1><p className="mt-2 text-sm leading-6 text-text-secondary">Access orders, saved addresses and meal plans.</p><form onSubmit={handleSubmit} className="mt-7 space-y-4"><label className="block text-sm font-bold">Email or phone<input className="input-field mt-2" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="you@example.com" required /></label><label className="block text-sm font-bold">Password<input className="input-field mt-2" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>{error && <p className="rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger" role="alert">{error}</p>}<Button type="submit" disabled={submitting} className="w-full disabled:opacity-55">{submitting ? "Signing in…" : <>Sign in <ArrowRight className="size-4" aria-hidden="true" /></>}</Button></form><p className="mt-5 text-center text-sm text-text-secondary">New here? <Link href="/register" className="font-black text-primary hover:underline">Create an account</Link></p></div></section>;
}
