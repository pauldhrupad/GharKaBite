"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import Button from "./Button";
import { mealDetailHref } from "@/lib/meal-period";
import { writeFavoriteDraft } from "@/lib/favorite-draft";
import { mealRequest } from "@/lib/use-private-meals";

export default function SaveFavorite({ meal, selection, date, disabled }) {
  const { data, status } = useSession();
  if (status === "loading") return null;
  return <FavoriteSaveForm key={data?.user?.id || "guest"} signedIn={status === "authenticated"} meal={meal} selection={selection} date={date} disabled={disabled} />;
}

function FavoriteSaveForm({ signedIn, meal, selection, date, disabled }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(meal.name.slice(0, 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expired, setExpired] = useState(false);
  const task = useRef(null);
  useEffect(() => () => task.current?.abort(), []);
  const builderHref = mealDetailHref(meal.id, date, selection.preferredPeriod);

  function goToWelcome(mode, keepSelections) {
    let returnTo = builderHref;
    if (keepSelections) {
      try {
        const token = crypto.randomUUID();
        returnTo += `&favoriteDraft=${encodeURIComponent(token)}`;
        writeFavoriteDraft(window.sessionStorage, token, selection, date);
      } catch { /* Returning builder explains if restoration failed. */ }
    }
    router.push(`/welcome?mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function save(event) {
    event.preventDefault();
    if (task.current || disabled) return;
    const controller = new AbortController();
    task.current = controller; setBusy(true); setError(""); setNotice("");
    try {
      const data = await mealRequest("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selection, name }), signal: controller.signal });
      if (controller.signal.aborted) return;
      setNotice(data.duplicate ? "This configuration is already saved." : "Favorite saved.");
      setOpen(false);
      window.requestAnimationFrame(() => document.getElementById("save-favorite-trigger")?.focus());
    } catch (problem) {
      if (!controller.signal.aborted) {
        if (problem.status === 401) { setExpired(true); setName(""); setNotice(""); }
        else setError(problem.message);
      }
    } finally { task.current = null; if (!controller.signal.aborted) setBusy(false); }
  }

  return <section className="retention-favorite-save">
    <Button id="save-favorite-trigger" type="button" variant="outline" disabled={disabled || busy} aria-expanded={open} aria-controls="save-favorite-panel" onClick={() => { setOpen(!open); setError(""); }}><Heart size={17} aria-hidden="true" /> Save favorite</Button>
    {disabled && <p className="type-meta mt-1 text-text-secondary">Complete your Thali selections to save a favorite.</p>}
    {notice && <p className="type-supporting mt-2" role="status">{notice} <Link href="/profile/favorites" className="font-bold underline">My Favorites</Link></p>}
    <div id="save-favorite-panel" hidden={!open}>
      {open && (!signedIn || expired ? <div className="checkout-notice mt-2"><p>{expired ? "Your session expired. Sign in to continue." : "Sign in or create an account to save this Thali across devices."}</p><div className="retention-actions"><Button type="button" disabled={disabled} onClick={() => goToWelcome("signin", !expired)}>Sign in</Button>{!expired && <Button type="button" variant="outline" disabled={disabled} onClick={() => goToWelcome("signup", true)}>Create an account</Button>}</div></div> :
        <form onSubmit={save} className="mt-3 grid gap-2">
          <label className="type-label">Favorite name<input className="input-field mt-1" value={name} maxLength={60} required disabled={busy} onChange={(event) => setName(event.target.value)} aria-describedby={error ? "favorite-save-error" : undefined} /></label>
          {error && <p id="favorite-save-error" className="text-danger" role="alert">{error}</p>}
          <div className="retention-actions"><Button type="submit" disabled={disabled || !name.trim()} loading={busy}>Save to My Favorites</Button><Button variant="ghost" type="button" disabled={busy} onClick={() => { setOpen(false); document.getElementById("save-favorite-trigger")?.focus(); }}>Cancel</Button></div>
        </form>)}
    </div>
  </section>;
}
