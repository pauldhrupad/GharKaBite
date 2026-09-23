"use client";

import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";
import { useCart } from "@/context/CartContext";
import { useModalFocus } from "@/lib/use-modal-focus";

export default function CartPeriodConflictModal() {
  const { periodConflict, cancelPeriodSwitch, clearAndSwitchPeriod } = useCart();
  const cancelButtonRef = useRef(null);
  const dialogRef = useModalFocus(Boolean(periodConflict), cancelPeriodSwitch, cancelButtonRef);

  if (!periodConflict) return null;

  return (
    <div className="ui-modal-backdrop fixed inset-0 z-[70] grid place-items-center bg-text-primary/55 px-4 backdrop-blur-sm" role="presentation">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-period-conflict-title"
        aria-describedby="cart-period-conflict-description"
        className="ui-dialog w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-warning/12 text-warning">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h2 id="cart-period-conflict-title" className="mt-5 text-2xl font-black tracking-tight">
          Your cart currently contains {periodConflict.existingPeriod} items for {periodConflict.existingDate}.
        </h2>
        <p id="cart-period-conflict-description" className="mt-2 leading-7 text-text-secondary">
          A single order can contain one delivery date and meal period. Clear the cart to switch to {periodConflict.requestedPeriod} on {periodConflict.requestedDate}.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={cancelPeriodSwitch}>Cancel</Button>
          <Button type="button" onClick={clearAndSwitchPeriod}>Clear &amp; Switch</Button>
        </div>
      </section>
    </div>
  );
}
