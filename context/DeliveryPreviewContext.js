"use client";

import { createContext, useCallback, useContext, useState } from "react";

const DeliveryPreviewContext = createContext(null);

export function DeliveryPreviewProvider({ children }) {
  const [preview, setPreview] = useState({ label: "", expanded: false });
  const updatePreview = useCallback((changes) => {
    setPreview((previous) => ({ ...previous, ...changes }));
  }, []);
  return <DeliveryPreviewContext.Provider value={{ ...preview, updatePreview }}>{children}</DeliveryPreviewContext.Provider>;
}

export function useDeliveryPreview() {
  return useContext(DeliveryPreviewContext);
}
