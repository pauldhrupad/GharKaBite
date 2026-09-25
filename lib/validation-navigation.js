"use client";

// Wait for inline feedback and any newly expanded controls to appear.
export function revealValidationTarget(warningId, focusId = warningId) {
  window.requestAnimationFrame(() => {
    const warning = document.getElementById(warningId);
    if (!warning) return;
    const focusTarget = document.getElementById(focusId) || warning;
    focusTarget.focus({ preventScroll: true });
    warning.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  });
}
