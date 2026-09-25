"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const AdminOrderAlertsContext = createContext(null);

export function useAdminOrderAlerts() {
  const value = useContext(AdminOrderAlertsContext);
  if (!value) throw new Error("Admin order alerts must be used inside their provider.");
  return value;
}

export default function AdminOrderAlertsProvider({ children }) {
  const [count, setCount] = useState(0);
  const [orders, setOrders] = useState([]);
  const [announcement, setAnnouncement] = useState("");
  const previousCount = useRef(null);

  useEffect(() => {
    let active = true;
    let loading = false;

    async function refresh() {
      if (document.visibilityState === "hidden" || loading) return;
      loading = true;
      try {
        const response = await fetch("/api/admin/order-alerts", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !Number.isInteger(data.count)) return;
        if (previousCount.current !== null && data.count > previousCount.current) {
          const newCount = data.count - previousCount.current;
          setAnnouncement(`${newCount} new ${newCount === 1 ? "order needs" : "orders need"} attention`);
        }
        previousCount.current = data.count;
        setCount(data.count);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        // Keep the last known queue status until the next refresh.
      } finally {
        loading = false;
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!announcement) return undefined;
    const timer = window.setTimeout(() => setAnnouncement(""), 6000);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  return <AdminOrderAlertsContext.Provider value={{ count, orders, announcement, clearAnnouncement: () => setAnnouncement("") }}>{children}</AdminOrderAlertsContext.Provider>;
}
