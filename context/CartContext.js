"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";
import { kolkataDate, allowedOrderDate } from "@/lib/dates";

const CartContext = createContext(null);
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

function itemKey(mealId, deliveryMealPeriod) {
  return `${mealId}::${deliveryMealPeriod}`;
}

function clampQuantity(quantity) {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Number(quantity) || MIN_QUANTITY));
}

function createCartItem(meal, deliveryMealPeriod, quantity, serviceDate) {
  return {
    mealId: meal.id,
    name: meal.name,
    image: meal.image,
    price: meal.price,
    quantity: clampQuantity(quantity),
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
    .map((item) => ({ ...item, serviceDate: savedDate, quantity: clampQuantity(item.quantity) }));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [periodConflict, setPeriodConflict] = useState(null);

  useEffect(() => {
    const loadSavedCart = window.setTimeout(() => {
      try {
        const savedCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          setItems(sanitizeSavedCart(parsedCart));
        }
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(loadSavedCart);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  function addItem(meal, deliveryMealPeriod, quantity = 1, serviceDate = kolkataDate()) {
    const newItem = createCartItem(meal, deliveryMealPeriod, quantity, serviceDate);
    const cartPeriod = items[0]?.deliveryMealPeriod;
    const cartDate = items[0]?.serviceDate;

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
      const key = itemKey(meal.id, deliveryMealPeriod);
      const existingItem = currentItems.find((item) => itemKey(item.mealId, item.deliveryMealPeriod) === key);

      if (!existingItem) return [...currentItems, newItem];

      return currentItems.map((item) =>
        itemKey(item.mealId, item.deliveryMealPeriod) === key
          ? { ...item, quantity: clampQuantity(item.quantity + newItem.quantity) }
          : item,
      );
    });

    return { status: "added" };
  }

  function addOrderItems(mealSelections, deliveryMealPeriod, serviceDate = kolkataDate()) {
    const newItems = mealSelections.map(({ meal, quantity }) => createCartItem(meal, deliveryMealPeriod, quantity, serviceDate));
    if (!newItems.length) return { status: "empty" };
    const cartPeriod = items[0]?.deliveryMealPeriod;
    if (cartPeriod && (cartPeriod !== deliveryMealPeriod || items[0]?.serviceDate !== serviceDate)) {
      setPeriodConflict({ existingPeriod: cartPeriod, requestedPeriod: deliveryMealPeriod, existingDate: items[0]?.serviceDate, requestedDate: serviceDate, pendingItems: newItems });
      return { status: "conflict" };
    }

    setItems((currentItems) => {
      const mergedItems = [...currentItems];
      newItems.forEach((newItem) => {
        const index = mergedItems.findIndex((item) => itemKey(item.mealId, item.deliveryMealPeriod) === itemKey(newItem.mealId, newItem.deliveryMealPeriod));
        if (index === -1) mergedItems.push(newItem);
        else mergedItems[index] = { ...mergedItems[index], quantity: clampQuantity(mergedItems[index].quantity + newItem.quantity) };
      });
      return mergedItems;
    });
    return { status: "added" };
  }

  function removeItem(mealId, deliveryMealPeriod) {
    setItems((currentItems) => currentItems.filter((item) => itemKey(item.mealId, item.deliveryMealPeriod) !== itemKey(mealId, deliveryMealPeriod)));
  }

  function updateQuantity(mealId, deliveryMealPeriod, quantity) {
    setItems((currentItems) => currentItems.map((item) =>
      itemKey(item.mealId, item.deliveryMealPeriod) === itemKey(mealId, deliveryMealPeriod)
        ? { ...item, quantity: clampQuantity(quantity) }
        : item,
    ));
  }

  function clearCart() {
    setItems([]);
    setPromoCode("");
    setPeriodConflict(null);
  }

  function cancelPeriodSwitch() {
    setPeriodConflict(null);
  }

  function clearAndSwitchPeriod() {
    if (!periodConflict?.pendingItems?.length) return;
    setItems(periodConflict.pendingItems);
    setPeriodConflict(null);
  }

  const value = {
    items,
    hydrated,
    addItem,
    addOrderItems,
    removeItem,
    updateQuantity,
    clearCart,
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
