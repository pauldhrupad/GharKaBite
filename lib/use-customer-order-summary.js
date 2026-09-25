"use client";

import { useEffect, useState } from "react";

const emptySummary = { activeCount: 0, orders: [] };

export function useCustomerOrderSummary(userId) {
  const [result, setResult] = useState({ userId: null, summary: emptySummary });

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    let loading = false;

    async function refresh() {
      if (document.visibilityState === "hidden" || loading) return;
      loading = true;
      try {
        const response = await fetch("/api/orders/nav-summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && Number.isInteger(data.activeCount)) {
          setResult({ userId, summary: { activeCount: data.activeCount, orders: Array.isArray(data.orders) ? data.orders : [] } });
        }
      } catch {
        // The last known status remains visible during a temporary outage.
      } finally {
        loading = false;
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  return userId && result.userId === userId ? result.summary : emptySummary;
}
