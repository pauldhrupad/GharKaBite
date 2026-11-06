"use client";

import { useEffect, useRef, useState } from "react";

export async function mealRequest(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.message || "Couldn’t load this information. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

// Call from an account-keyed view so switching users drops the whole private state.
export function usePrivateMeals(url) {
  const [state, setState] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const scope = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    mealRequest(url, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ url, attempt, data });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ url, attempt, error: error.message, status: error.status });
    });
    return () => { controller.abort(); };
  }, [url, attempt]);
  const result = state?.url === url && state.attempt === attempt ? state : null;
  return { ...result, loading: !result, retry: () => setAttempt((value) => value + 1), scope };
}
