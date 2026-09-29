"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingState from "./LoadingState";

export default function SubscriptionDashboard() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/subscriptions");
      if (!response.ok) throw new Error("Unable to load your plans.");
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch { setMessage("Unable to load your plans. Please try again."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, []);
  if (loading) return <LoadingState label="Loading your plans" />;
  if (message) return <section className="container-shell py-8" role="alert"><p className="text-danger">{message}</p><button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl border border-primary px-4 font-bold text-primary">Try again</button></section>;
  return <section className="container-shell space-y-4 py-8 md:py-10">{message && <p role="alert">{message}</p>}{subscriptions.map((item) => <article key={item._id} className="card-surface p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-black">{item.planName}</h2><p className="text-sm text-text-secondary">{item.mode} · {item.status}</p></div><p className="text-2xl font-black text-accent">{item.remainingMeals}/{item.totalMeals} meals left</p></div><p className="mt-3 text-sm">Expires {new Date(item.expiryDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</p><h3 className="mt-5 font-black">Usage history</h3>{item.usageHistory.length ? <ul className="mt-2 space-y-2">{item.usageHistory.map((use) => <li key={use.order} className="text-sm text-text-secondary">{use.mealName} · {new Date(use.usedAt).toLocaleDateString("en-IN")}{use.reversedAt ? " · Returned" : ""}</li>)}</ul> : <p className="mt-2 text-sm text-text-secondary">No meals used yet.</p>}</article>)}{!subscriptions.length && !message && <p>No plans yet. <Link href="/plans" className="font-bold text-primary underline">Browse plans</Link>.</p>}</section>;
}
