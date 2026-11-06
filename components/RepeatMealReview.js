"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "./Button";
import LoadingState from "./LoadingState";
import CustomerMealsAccess, { MealSignIn } from "./CustomerMealsAccess";
import ThaliCustomizer from "./ThaliCustomizer";
import ThaliOrderDetails from "./ThaliOrderDetails";
import { useCart } from "@/context/CartContext";
import { useKitchen } from "@/context/KitchenContext";
import { allowedOrderDate, kolkataDate } from "@/lib/dates";
import { formatINR } from "@/lib/cart-pricing";
import { mealRequest, usePrivateMeals } from "@/lib/use-private-meals";
import { orderSelections, repeatAvailability, repeatCartConflict, repeatPriceKey, reviewRepeatLine } from "@/lib/repeat-order";

export default function RepeatMealReview({ orderNumber, favoriteId, returnTo }) {
  return <CustomerMealsAccess view={RepeatSource} returnTo={returnTo} orderNumber={orderNumber} favoriteId={favoriteId} />;
}

function RepeatSource({ orderNumber, favoriteId, returnTo }) {
  const url = orderNumber ? `/api/orders/${encodeURIComponent(orderNumber)}?view=reorder` : `/api/favorites/${encodeURIComponent(favoriteId)}`;
  const read = usePrivateMeals(url);
  if (read.loading) return <LoadingState label="Loading your previous selections" rows={2} />;
  if (read.status === 401) return <MealSignIn returnTo={returnTo} />;
  if (read.error) return <div className="card-surface p-5" role="alert"><p>{read.error}</p><Button variant="outline" type="button" className="mt-3" onClick={read.retry}>Try again</Button></div>;
  const { order, favorite } = read.data;
  const source = order || favorite;
  return <RepeatDraft key={url} source={source} fromOrder={Boolean(order)} url={url} returnTo={returnTo} scope={read.scope} />;
}

async function loadCatalog(date, signal) {
  const [{ meals }, { settings }] = await Promise.all([
    mealRequest(`/api/menu?date=${encodeURIComponent(date)}`, { signal }),
    mealRequest("/api/settings", { signal }),
  ]);
  return { meals, settings };
}

function RepeatDraft({ source, fromOrder, url, returnTo, scope }) {
  const { items, hydrated, addOrderItems } = useCart();
  const groupId = useId();
  const { now } = useKitchen();
  const router = useRouter();
  const [lines, setLines] = useState(() => fromOrder ? orderSelections(source) : [{ ...source, id: "favorite", name: source.mealName, isFavorite: true }]);
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState(source.mealPeriod || source.preferredPeriod || "");
  const [catalog, setCatalog] = useState(null);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(null);
  const [accepted, setAccepted] = useState("");
  const [replaceItems, setReplaceItems] = useState(null);
  const [message, setMessage] = useState("");
  const [accessError, setAccessError] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const clock = new Date(now);
  const today = kolkataDate(0, clock);
  const tomorrow = kolkataDate(1, clock);
  const validDate = Boolean(date && allowedOrderDate(date, clock));
  useEffect(() => {
    if (!date || !allowedOrderDate(date)) return;
    const controller = new AbortController();
    loadCatalog(date, controller.signal).then((data) => {
      if (!controller.signal.aborted) setCatalog({ date, retry, ...data });
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalog({ date, retry, error: error.message });
    });
    return () => controller.abort();
  }, [date, retry, validDate]);

  const checked = validDate && catalog?.date === date && catalog.retry === retry ? catalog : null;
  const included = lines.filter((line) => !line.excluded);
  const reviews = checked?.meals ? included.map((line) => reviewRepeatLine(line, checked.meals, period)) : [];
  const availability = date ? !validDate ? "That delivery date expired. Choose Today or Tomorrow." : checked?.settings ? repeatAvailability(date, period, checked.settings, clock) : "" : "";
  const priceKey = `${date}:${period}:${repeatPriceKey(reviews)}`;
  const pricesChanged = reviews.some(({ line, price }) => price && Number.isFinite(line.price) && line.price !== price.unitTotal);
  const ingredientsChanged = reviews.some(({ changes }) => changes.length > 0);
  const conflict = date && repeatCartConflict(items, date, period);
  const replace = Boolean(conflict && replaceItems === items);
  const ready = hydrated && !busy && checked?.meals && !availability && included.length > 0 && !reviews.some(({ issues }) => issues.length) && (!(pricesChanged || ingredientsChanged) || accepted === priceKey) && (!conflict || replace);

  function resetConfirmation() { setMessage(""); setAccepted(""); setReplaceItems(null); }
  function editLine(id, patch) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
    resetConfirmation();
  }
  function closeEditor(id) {
    setEditing(null);
    window.requestAnimationFrame(() => document.getElementById(`repeat-edit-${id}`)?.focus());
  }

  async function addReviewed() {
    if (!ready || submitting.current) return;
    const signal = scope.current?.signal;
    if (!signal || signal.aborted) return;
    submitting.current = true; setBusy(true); setMessage("");
    try {
      const [fresh] = await Promise.all([loadCatalog(date, signal), mealRequest(url, { signal })]);
      if (signal.aborted) return;
      const next = included.map((line) => reviewRepeatLine(line, fresh.meals, period));
      const unavailable = repeatAvailability(date, period, fresh.settings);
      setCatalog({ date, retry, ...fresh });
      if (unavailable || next.some(({ issues }) => issues.length) || repeatPriceKey(next) !== repeatPriceKey(reviews)) {
        setAccepted(""); setMessage(unavailable || "Menu details changed. Review the latest selections and prices before adding.");
        return;
      }
      addOrderItems(next, period, date, { ...fresh, menu: fresh.meals, expectedItems: items, replace });
      router.push("/cart");
    } catch (error) {
      if (!signal.aborted) {
        if ([401, 403, 404].includes(error.status)) setAccessError(error.status);
        else { setMessage(error.message); setReplaceItems(null); }
      }
    } finally {
      submitting.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  if (accessError === 401) return <MealSignIn returnTo={returnTo} />;
  if (accessError) return <p role="alert">This saved selection is no longer available.</p>;
  return <div className="retention-stack">
    <p className="type-supporting text-text-secondary">{fromOrder ? `From order ${source.orderNumber}${source.serviceDate ? ` · ${source.serviceDate}` : ""}. Your original order stays unchanged.` : `Saved favorite: ${source.name}`}</p>
    <section className="card-surface retention-card">
      <h2 className="type-section-title">Choose delivery</h2>
      <fieldset className="retention-options" disabled={busy || editing !== null}><legend>Service date</legend>{[[today, "Today"], [tomorrow, "Tomorrow"]].map(([day, label]) => <label className="checkout-choice" key={day}><input name={groupId + "-date"} type="radio" checked={date === day} onChange={() => { setDate(day); resetConfirmation(); }} /><span>{label}<small>{day}</small></span></label>)}</fieldset>
      <fieldset className="retention-options" disabled={busy || editing !== null}><legend>Meal period</legend>{["Lunch", "Dinner"].map((slot) => <label className="checkout-choice" key={slot}><input name={groupId + "-period"} type="radio" checked={period === slot} onChange={() => { setPeriod(slot); resetConfirmation(); }} />{slot}</label>)}</fieldset>
      {validDate && !checked && <p className="mt-2 type-supporting" role="status">Checking the current menu…</p>}
      {checked?.error && <div className="checkout-notice mt-2" role="alert">{checked.error} <button type="button" className="font-bold underline" onClick={() => setRetry(retry + 1)}>Try again</button></div>}
      {availability && <p className="checkout-notice mt-2" role="status">{availability}</p>}
    </section>
    <section aria-label="Meals in this review" className="retention-stack">
      {lines.map((line) => {
        const review = reviews.find(({ line: item }) => item.id === line.id);
        const price = review?.price?.unitTotal;
        return <article key={line.id} className="card-surface retention-card">
          <div className="retention-row"><div><h2 className="type-card-title">{line.name}</h2><p className="type-supporting text-text-secondary">{line.quantity} × {line.excluded ? "Excluded from this review" : price != null && !review.issues.length ? `${formatINR(price)} each` : "Saved selection"}</p></div>
            {!line.excluded && price != null && !review.issues.length && <strong>{formatINR(price * line.quantity)}</strong>}
          </div>
          {!line.excluded && price != null && !review.issues.length && Number.isFinite(line.price) && price !== line.price && <p className="checkout-notice mt-2">Previously {formatINR(line.price)} each · Current {formatINR(price)} each</p>}
          {!line.excluded && <ThaliOrderDetails item={{ fixedItems: review?.price?.fixedItems || line.fixedItems, selectedChoices: review?.price?.selectedChoices || line.choiceSummary, selectedAddOns: review?.price?.selectedAddOns || line.addOnSummary }} />}
          {review?.changes.map((change) => <p className="checkout-notice mt-2" key={change}>{change}</p>)}
          {review?.issues.length > 0 && <ul className="checkout-notice checkout-notice--error mt-2">{review.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
          {editing === line.id && review?.meal ? <>
            <ThaliCustomizer key={`${date}:${period}:${line.id}`} meal={review.meal} serviceDate={date} initialPeriod={period} initialSelection={line} onReviewSave={(patch) => { editLine(line.id, patch); closeEditor(line.id); }} />
            <Button type="button" variant="ghost" onClick={() => closeEditor(line.id)}>Cancel editing</Button>
          </> : <div className="retention-actions">
            {!line.excluded && review?.meal?.available && review.meal.slots.includes(period) && <Button id={`repeat-edit-${line.id}`} type="button" variant="outline" disabled={busy || editing !== null} onClick={() => setEditing(line.id)}>Edit {line.name}</Button>}
            <Button type="button" variant="ghost" disabled={busy || editing !== null} onClick={() => editLine(line.id, { excluded: !line.excluded })}>{line.excluded ? `Restore ${line.name}` : `Exclude ${line.name}`}</Button>
          </div>}
        </article>;
      })}
    </section>
    {editing === null && <section className="card-surface retention-card" aria-label="Apply this review">
      {(pricesChanged || ingredientsChanged) && <label className="checkout-price-ack"><input type="checkbox" checked={accepted === priceKey} onChange={(event) => setAccepted(event.target.checked ? priceKey : "")} disabled={busy} />I’ve reviewed the {ingredientsChanged ? pricesChanged ? "meal and price changes" : "meal changes" : "current meal prices"}.</label>}
      {conflict && <div className="checkout-notice"><p>Your current cart contains {items[0].deliveryMealPeriod} meals for {items[0].serviceDate}. Replacing it removes those meals.</p><label className="checkout-price-ack"><input type="checkbox" checked={replace} onChange={(event) => setReplaceItems(event.target.checked ? items : null)} disabled={busy} />Replace my current cart with the reviewed meals.</label></div>}
      {message && <div className="checkout-notice checkout-notice--error mt-2" role="alert">{message} <Link className="font-bold underline" href="/cart">View cart</Link></div>}
      {!included.length && <p className="type-supporting">Restore at least one meal to continue.</p>}
      <Button type="button" className="mt-3" loading={busy} loadingText="Rechecking menu…" disabled={!ready} onClick={addReviewed}>{replace ? "Replace cart and add meals" : "Add reviewed meals to cart"}</Button>
    </section>}
  </div>;
}
