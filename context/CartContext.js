"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";
import { kolkataDate, allowedOrderDate } from "@/lib/dates";
import { calculateThaliPrice } from "@/lib/thali";
import { remainingCartAfterCheckout, writeCheckoutAttempt } from "@/lib/checkout-attempt";
import { cartItemKey, mergeRepeatCart, repeatAvailability } from "@/lib/repeat-order";

const CartContext = createContext(null);
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

function clampQuantity(quantity) {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Number(quantity) || MIN_QUANTITY));
}

function createCartItem(meal, deliveryMealPeriod, quantity, serviceDate, customization = {}) {
  const selectedChoices = customization.selectedChoices || {};
  const selectedAddOns = customization.selectedAddOns || {};
  const priced = calculateThaliPrice(meal, selectedChoices, selectedAddOns, quantity);
  return {
    key: cartItemKey(meal.id, deliveryMealPeriod, selectedChoices, selectedAddOns),
    mealId: meal.id,
    kind: meal.kind || "thali",
    name: meal.name,
    image: meal.image,
    price: priced.unitTotal,
    basePrice: priced.basePrice,
    fixedItems: priced.fixedItems,
    selectedChoices,
    selectedAddOns,
    choiceSummary: priced.selectedChoices,
    addOnSummary: priced.selectedAddOns,
    needsReview: false,
    quantity,
    deliveryMealPeriod,
    serviceDate,
  };
}

function sanitizeSavedCart(savedItems) {
  if (!Array.isArray(savedItems)) return [];

  const validItems = savedItems.filter((item) => (
    item
    && item.mealId
    && item.name
    && item.image
    && Number.isFinite(item.price)
    && ["Lunch", "Dinner"].includes(item.deliveryMealPeriod)
  ));
  const savedPeriod = validItems[0]?.deliveryMealPeriod;
  const savedDate = validItems[0]?.serviceDate || kolkataDate();

  return validItems
    .filter((item) => item.deliveryMealPeriod === savedPeriod && (item.serviceDate || savedDate) === savedDate && allowedOrderDate(savedDate))
    .map((item) => ({ ...item, kind: item.kind || "thali", key: item.key || cartItemKey(item.mealId, item.deliveryMealPeriod, item.selectedChoices || {}, item.selectedAddOns || {}), basePrice: item.basePrice ?? item.price, selectedChoices: item.selectedChoices || {}, selectedAddOns: item.selectedAddOns || {}, choiceSummary: item.choiceSummary || [], addOnSummary: item.addOnSummary || [], needsReview: item.needsReview || !Object.hasOwn(item, "selectedChoices"), serviceDate: savedDate, quantity: clampQuantity(item.quantity) }));
}

export function CartProvider({ children }) {
  const [items, renderItems] = useState([]);
  const currentItems = useRef(items);
  const setItems = useCallback((update) => {
    const next = typeof update === "function" ? update(currentItems.current) : update;
    currentItems.current = next;
    renderItems(next);
  }, []);
  const [promoCode, setPromoCode] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [periodConflict, setPeriodConflict] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const checkoutDraftRef = useRef(null);

  useEffect(() => {
    const loadSavedCart = window.setTimeout(() => {
      try {
        const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          if (Array.isArray(parsedCart) && parsedCart.some((item) => item?.serviceDate && !allowedOrderDate(item.serviceDate))) setCartNotice("Your previous delivery date expired. Those meals were not restored; choose an available date from the menu.");
          setItems(sanitizeSavedCart(parsedCart));
        }
      } catch {
        try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch { /* Storage may be blocked by the browser. */ }
        setStorageError("Your saved cart could not be read. Items added now may only last for this visit.");
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(loadSavedCart);
  }, [setItems]);

  useEffect(() => {
    if (!hydrated) return;
    const save = window.setTimeout(() => {
      try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); setStorageError(""); }
      catch { setStorageError("Your browser could not save this cart. Keep this page open; your items may be lost after a reload."); }
    }, 0);
    return () => window.clearTimeout(save);
  }, [hydrated, items]);

  function addItem(meal, deliveryMealPeriod, quantity = 1, serviceDate = kolkataDate(), customization = {}, editKey = null) {
    const newItem = createCartItem(meal, deliveryMealPeriod, clampQuantity(quantity), serviceDate, customization);
    const cartPeriod = currentItems.current[0]?.deliveryMealPeriod;
    const cartDate = currentItems.current[0]?.serviceDate;

    if (cartPeriod && (cartPeriod !== deliveryMealPeriod || cartDate !== serviceDate)) {
      setPeriodConflict({
        existingPeriod: cartPeriod,
        requestedPeriod: deliveryMealPeriod,
        existingDate: cartDate,
        requestedDate: serviceDate,
        pendingItems: [newItem],
      });
      return { status: "conflict" };
    }

    setItems((currentItems) => {
      const remaining = editKey ? currentItems.filter((item) => item.key !== editKey) : currentItems;
      const key = newItem.key;
      const existingItem = remaining.find((item) => item.key === key);

      if (!existingItem) return [...remaining, newItem];

      return remaining.map((item) =>
        item.key === key
          ? { ...item, quantity: clampQuantity(item.quantity + newItem.quantity) }
          : item,
      );
    });

    return { status: "added" };
  }

  function addOrderItems(reviews, period, date, { menu, settings, expectedItems, replace }) {
    if (!hydrated || currentItems.current !== expectedItems) throw new Error("Your cart changed. Review it before trying again.");
    const unavailable = repeatAvailability(date, period, settings);
    if (unavailable) throw new Error(unavailable);
    const additions = reviews.map(({ meal, line }) => createCartItem(meal, period, line.quantity, date, line));
    setItems(mergeRepeatCart(currentItems.current, additions, { date, period, menu, replace }));
    setPeriodConflict(null);
  }

  function removeItem(key) {
    setItems((currentItems) => currentItems.filter((item) => item.key !== key));
  }

  function updateQuantity(key, quantity) {
    setItems((currentItems) => currentItems.map((item) =>
      item.key === key
        ? { ...item, quantity: clampQuantity(quantity) }
        : item,
    ));
  }

  function clearCart() {
    if (!checkoutDraftRef.current?.attempt) checkoutDraftRef.current = null;
    setItems([]);
    setPromoCode("");
    setPeriodConflict(null);
  }

  function cancelPeriodSwitch() {
    setPeriodConflict(null);
  }

  function completeCheckout(payload) {
    checkoutDraftRef.current = null;
    try { writeCheckoutAttempt(window.sessionStorage, null); } catch { /* The in-memory cart remains usable if tab storage is blocked. */ }
    setItems((current) => remainingCartAfterCheckout(current, payload));
    setPromoCode((current) => current === payload.promoCode ? "" : current);
    setPeriodConflict(null);
  }

  function clearAndSwitchPeriod() {
    if (!periodConflict?.pendingItems?.length) return;
    setItems(periodConflict.pendingItems);
    setPeriodConflict(null);
  }

  const value = {
    cartNotice,
    checkoutDraftRef,
    storageError,
    items,
    hydrated,
    addItem,
    addOrderItems,
    removeItem,
    updateQuantity,
    clearCart,
    completeCheckout,
    periodConflict,
    cancelPeriodSwitch,
    clearAndSwitchPeriod,
    cartPeriod: items[0]?.deliveryMealPeriod || null,
    cartDate: items[0]?.serviceDate || null,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    promoCode,
    setPromoCode,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
