"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { orderStatusLabel, paymentPresentation } from "./order-utils";

const initial = { order: null, payment: null, checking: false, error: "", access: 0, checkedAt: null, announcement: "" };
const denied = (status) => [401, 403, 404].includes(status);

export function orderRefreshDelay(order) {
  if (!order || order.orderStatus === "cancelled") return null;
  if (order.orderStatus === "delivered") return order.paymentMethod === "COD" && order.paymentStatus === "pending" && order.total > 0 ? 60000 : null;
  return order.paymentStatus === "verification_pending" ? 15000 : 30000;
}

export function watchOrder({ read, onChange, visible }) {
  let state = initial, pending, timer, version = 0, paused = false, disposed = false, failures = 0;
  const publish = (patch) => { state = { ...state, ...patch }; onChange(state); };
  const clear = (access) => publish({ ...initial, access });
  function schedule() {
    const delay = orderRefreshDelay(state.order);
    if (disposed || paused || state.access || !visible() || (state.order && delay === null)) return;
    timer = setTimeout(refresh, failures ? Math.min(120000, 15000 * 2 ** Math.min(failures - 1, 3)) : delay ?? 30000);
  }
  function refresh() {
    if (disposed || paused || state.access || !visible()) return Promise.resolve(false);
    if (pending) return pending.result;
    clearTimeout(timer);
    const controller = new AbortController();
    const generation = version;
    const deadline = setTimeout(() => controller.abort(), 12000);
    const current = () => !disposed && generation === version;
    const result = Promise.resolve().then(async () => {
      if (!current()) return false;
      publish({ checking: true });
      const response = await read(Boolean(state.order), controller.signal);
      if (!current()) return false;
      if (denied(response.status)) { clear(response.status); return false; }
      if (!response.ok) throw new Error("ORDER_UNAVAILABLE");
      const data = await response.json();
      if (!current()) return false;
      if (!data.order) throw new Error("ORDER_UNAVAILABLE");
      const order = { ...state.order, ...data.order };
      const changed = state.order && (order.orderStatus !== state.order.orderStatus || order.paymentStatus !== state.order.paymentStatus);
      failures = 0;
      publish({ order, payment: data.payment ?? null, error: "", checkedAt: new Date(), announcement: changed ? `Order: ${orderStatusLabel(order)}. Payment: ${paymentPresentation(order).label}.` : state.announcement });
      return true;
    }).catch(() => {
      if (current()) {
        failures++;
        publish({ error: state.order ? "Couldn’t refresh. Showing the last known status." : "Couldn’t load this order. Please try again." });
      }
      return false;
    }).finally(() => {
      clearTimeout(deadline);
      pending = null;
      if (current()) publish({ checking: false });
      schedule();
    });
    pending = { controller, result };
    return result;
  }
  return {
    refresh,
    visibilityChanged() { if (visible()) return refresh(); clearTimeout(timer); },
    beginMutation() {
      paused = true;
      version++;
      const generation = version;
      clearTimeout(timer);
      pending?.controller.abort();
      return async (updated, status) => {
        if (disposed || generation !== version) return false;
        if (denied(status)) { clear(status); return false; }
        if (updated) publish({ order: { ...state.order, ...updated }, payment: null, error: "", checkedAt: new Date(), announcement: "Payment proof submitted for manual verification." });
        paused = false;
        await pending?.result;
        if (disposed || generation !== version) return false;
        return refresh();
      };
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      pending?.controller.abort();
    },
  };
}

export function useOrderRefresh(orderId) {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : null;
  const key = userId ? JSON.stringify([userId, orderId]) : null;
  const [stored, setStored] = useState({ key, state: initial });
  if (stored.key !== key) setStored({ key, state: initial });
  const active = useRef(null);
  useEffect(() => {
    if (!key) return;
    const watcher = watchOrder({
      read: (partial, signal) => fetch(`/api/orders/${encodeURIComponent(orderId)}${partial ? "?view=status" : ""}`, { signal, cache: "no-store" }),
      onChange: (state) => setStored({ key, state }),
      visible: () => document.visibilityState !== "hidden",
    });
    active.current = watcher;
    watcher.refresh();
    window.addEventListener("focus", watcher.refresh);
    window.addEventListener("online", watcher.refresh);
    document.addEventListener("visibilitychange", watcher.visibilityChanged);
    return () => {
      watcher.dispose();
      active.current = null;
      window.removeEventListener("focus", watcher.refresh);
      window.removeEventListener("online", watcher.refresh);
      document.removeEventListener("visibilitychange", watcher.visibilityChanged);
    };
  }, [key, orderId]);
  const state = key && stored?.key === key ? stored.state : initial;
  return { ...state, key, access: status === "unauthenticated" ? 401 : state.access, refresh: () => active.current?.refresh(), beginMutation: () => active.current?.beginMutation() };
}
