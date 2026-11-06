"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Badge from "./Badge";
import Button from "./Button";
import CustomerMealsAccess, { MealSignIn } from "./CustomerMealsAccess";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ThaliOrderDetails from "./ThaliOrderDetails";
import { useKitchen } from "@/context/KitchenContext";
import { thaliPreviewImage } from "@/lib/thali-builder";
import { repeatAvailability, reviewRepeatLine } from "@/lib/repeat-order";
import { mealRequest, usePrivateMeals } from "@/lib/use-private-meals";

export default function FavoritesList() {
  return <CustomerMealsAccess view={FavoritesView} returnTo="/profile/favorites" />;
}

function FavoritesView({ returnTo }) {
  const read = usePrivateMeals("/api/favorites");
  const [expired, setExpired] = useState(false);
  if (read.status === 401 || expired) return <MealSignIn returnTo={returnTo} />;
  if (read.loading) return <LoadingState label="Loading favorites" rows={2} />;
  if (read.error) return <div className="card-surface retention-card" role="alert"><p>{read.error}</p><Button type="button" variant="outline" onClick={read.retry}>Try again</Button></div>;
  if (!read.data.favorites.length) return <EmptyState title="No favorites yet" description="Build a Thali you like and save it for next time." actionLabel="Browse Thalis" href="/menu" />;
  return <FavoriteCards initial={read.data.favorites} scope={read.scope} onExpired={() => setExpired(true)} />;
}

function FavoriteCards({ initial, scope, onExpired }) {
  const { today, settings, hydrated, loadFailed, now } = useKitchen();
  const catalog = usePrivateMeals(`/api/menu?date=${encodeURIComponent(today)}`);
  const [favorites, setFavorites] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function change(id, remove) {
    if (pending.current) return;
    const signal = scope.current?.signal;
    if (!signal || signal.aborted) return;
    pending.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await mealRequest(`/api/favorites/${encodeURIComponent(id)}`, { method: remove ? "DELETE" : "PATCH", ...(remove ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }), signal });
      if (signal.aborted) return;
      setFavorites((list) => remove ? list.filter((favorite) => favorite.id !== id) : list.map((favorite) => favorite.id === id ? { ...favorite, name: data.name } : favorite));
      setEditing(null); setRemoving(null); setMessage(data.message);
      window.requestAnimationFrame(() => document.getElementById(remove ? "favorites-feedback" : `favorite-rename-${id}`)?.focus());
    } catch (problem) {
      if (!signal.aborted) {
        if (problem.status === 401) onExpired();
        else setError(problem.message);
      }
    } finally { pending.current = false; if (!signal.aborted) setBusy(false); }
  }

  return <>
    <p id="favorites-feedback" role="status" tabIndex={-1} className="type-supporting">{message}</p>
    {error && <p role="alert" className="checkout-notice checkout-notice--error">{error}</p>}
    {!favorites.length ? <EmptyState title="No favorites yet" description="Build a Thali you like and save it for next time." actionLabel="Browse Thalis" href="/menu" /> :
      <div className="retention-grid">{favorites.map((favorite) => {
        const menu = catalog.data?.meals;
        const review = menu ? reviewRepeatLine({ ...favorite, name: favorite.mealName, isFavorite: true }, menu, favorite.preferredPeriod) : null;
        const available = review && !review.issues.length && hydrated && !loadFailed && !repeatAvailability(today, favorite.preferredPeriod, settings, new Date(now));
        const label = catalog.loading ? "Checking menu…" : !menu ? "Couldn’t check availability" : !review.meal ? "No longer on the menu" : available ? "Available today" : "Needs review for today";
        return <article className="card-surface retention-card" key={favorite.id}>
          <div className="retention-favorite-heading">
            <FavoriteImage meal={review?.meal} />
            <div><h2 className="type-card-title">{favorite.name}</h2><p className="type-supporting text-text-secondary">{review?.meal?.name || favorite.mealName} · {favorite.quantity} × · {favorite.preferredPeriod}</p><Badge tone={available ? "informational" : "muted"}>{label}</Badge></div>
          </div>
          <ThaliOrderDetails item={{ selectedChoices: favorite.choiceSummary, selectedAddOns: favorite.addOnSummary }} />
          {editing === favorite.id ? <form className="mt-3" onSubmit={(event) => { event.preventDefault(); change(favorite.id, false); }}><label className="type-label">Favorite name<input className="input-field mt-1" value={name} maxLength={60} required disabled={busy} onChange={(event) => setName(event.target.value)} /></label><div className="retention-actions"><Button type="submit" disabled={!name.trim()} loading={busy}>Save name</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>Cancel</Button></div></form> :
            removing === favorite.id ? <div className="checkout-notice mt-3"><p>Remove {favorite.name} from your favorites?</p><div className="retention-actions"><Button type="button" variant="destructive" loading={busy} onClick={() => change(favorite.id, true)}>Remove favorite</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setRemoving(null); setError(""); }}>Keep favorite</Button></div></div> :
            <div className="retention-actions"><Button href={`/profile/reorder?favorite=${encodeURIComponent(favorite.id)}`}>Review &amp; customize</Button><Button id={`favorite-rename-${favorite.id}`} type="button" variant="ghost" disabled={busy} onClick={() => { setName(favorite.name); setEditing(favorite.id); setRemoving(null); setError(""); }}>Rename<span className="sr-only"> {favorite.name}</span></Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setRemoving(favorite.id); setEditing(null); setError(""); }}>Remove<span className="sr-only"> {favorite.name}</span></Button></div>}
        </article>;
      })}</div>}
  </>;
}

function FavoriteImage({ meal }) {
  const [failed, setFailed] = useState("");
  const image = meal ? thaliPreviewImage(meal) : {};
  return <div className="retention-favorite-image">{image.src && failed !== image.src ? <Image src={image.src} alt="" fill sizes="72px" className={image.illustration ? "object-contain" : "object-cover"} onError={() => setFailed(image.src)} /> : <span>Thali</span>}</div>;
}
