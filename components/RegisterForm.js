"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, UserPlus } from "lucide-react";
import Button from "./Button";

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ""))) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (form.password.length < 8) { setError("Password must contain at least 8 characters."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) { setError(data.message || "Unable to create your account."); return; }
      const result = await signIn("credentials", { identifier: form.email, password: form.password, redirect: false });
      if (result?.error) { router.push("/login"); return; }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("Registration is temporarily unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="container-shell grid min-h-[70vh] place-items-center py-12"><div className="card-surface w-full max-w-lg p-6 md:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent"><UserPlus className="size-6" aria-hidden="true" /></div><p className="eyebrow mt-6">Start simply</p><h1 className="mt-2 text-3xl font-black tracking-tight">Create your account</h1><p className="mt-2 text-sm leading-6 text-text-secondary">Save time on repeat orders and manage delivery details.</p><form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Full name<input className="input-field mt-2" name="name" value={form.name} onChange={updateField} autoComplete="name" placeholder="Your name" required /></label><label className="text-sm font-bold">Phone<input className="input-field mt-2" name="phone" value={form.phone} onChange={updateField} autoComplete="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" required /></label><label className="text-sm font-bold sm:col-span-2">Email<input className="input-field mt-2" name="email" value={form.email} onChange={updateField} type="email" autoComplete="email" placeholder="you@example.com" required /></label><label className="text-sm font-bold sm:col-span-2">Password<input className="input-field mt-2" name="password" value={form.password} onChange={updateField} type="password" autoComplete="new-password" placeholder="Minimum 8 characters" required /></label>{error && <p className="rounded-xl bg-danger/8 p-3 text-sm font-bold text-danger sm:col-span-2" role="alert">{error}</p>}<Button type="submit" disabled={submitting} className="sm:col-span-2 disabled:opacity-55">{submitting ? "Creating account…" : <>Create account <ArrowRight className="size-4" aria-hidden="true" /></>}</Button></form><p className="mt-5 text-center text-sm text-text-secondary">Already registered? <Link href="/login" className="font-black text-primary hover:underline">Sign in</Link></p></div></section>;
}
