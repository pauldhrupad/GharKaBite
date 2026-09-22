"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { defaultKitchenSettings, getPeriodAvailability } from "@/lib/kitchen-operations";

const KitchenContext = createContext(null);

export function KitchenProvider({ children }) {
  const [settings, setSettings] = useState(defaultKitchenSettings);
  const [hydrated, setHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const loadSettings = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) throw new Error("SETTINGS_UNAVAILABLE");
        const data = await response.json();
        if (!data.settings) throw new Error("SETTINGS_UNAVAILABLE");
        setSettings({ ...defaultKitchenSettings, ...data.settings });
        setLoadFailed(false);
      } catch {
        setLoadFailed(true);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(loadSettings);
  }, []);

  function updateSettings(nextSettings) {
    const normalized = { ...defaultKitchenSettings, ...nextSettings };
    setSettings(normalized);
    setLoadFailed(false);
  }

  function getAvailability(period) {
    if (loadFailed) return { available: false, reason: "Kitchen availability is temporarily unavailable." };
    return getPeriodAvailability(period, settings);
  }

  return <KitchenContext.Provider value={{ settings, hydrated, updateSettings, getAvailability }}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const context = useContext(KitchenContext);
  if (!context) throw new Error("useKitchen must be used within KitchenProvider");
  return context;
}
