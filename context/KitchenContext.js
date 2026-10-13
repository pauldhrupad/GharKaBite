"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { defaultKitchenSettings, getPeriodAvailability } from "@/lib/kitchen-operations";
import { kolkataDate } from "@/lib/dates";

const KitchenContext = createContext(null);

export function KitchenProvider({ children }) {
  const [settings, setSettings] = useState(defaultKitchenSettings);
  const [hydrated, setHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const today = kolkataDate(0, new Date(now));

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (document.visibilityState === "hidden" || loading) return;
      loading = true;
      setNow(Date.now());
      try {
        const response = await fetch("/api/settings", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("SETTINGS_UNAVAILABLE");
        const data = await response.json();
        if (!data.settings) throw new Error("SETTINGS_UNAVAILABLE");
        if (!controller.signal.aborted) { setSettings({ ...defaultKitchenSettings, ...data.settings }); setLoadFailed(false); }
      } catch {
        if (!controller.signal.aborted) setLoadFailed(true);
      } finally {
        loading = false;
        if (!controller.signal.aborted) setHydrated(true);
      }
    }
    const loadSettings = window.setTimeout(refresh, 0);
    let clock;
    function tick() {
      if (document.visibilityState !== "hidden") setNow(Date.now());
      clock = window.setTimeout(tick, 60000 - Date.now() % 60000 + 10);
    }
    clock = window.setTimeout(tick, 60000 - Date.now() % 60000 + 10);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearTimeout(loadSettings); window.clearTimeout(clock); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  function updateSettings(nextSettings) {
    const normalized = { ...defaultKitchenSettings, ...nextSettings };
    setSettings(normalized);
    setLoadFailed(false);
  }

  function getAvailability(period, serviceDate = today) {
    if (!hydrated) return { available: false, reason: "Checking kitchen availability…" };
    if (loadFailed) return { available: false, reason: "Kitchen availability is temporarily unavailable." };
    return getPeriodAvailability(period, settings, [], new Date(now), serviceDate);
  }

  return <KitchenContext.Provider value={{ settings, hydrated, loadFailed, now, today, updateSettings, getAvailability }}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const context = useContext(KitchenContext);
  if (!context) throw new Error("useKitchen must be used within KitchenProvider");
  return context;
}
