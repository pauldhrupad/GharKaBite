"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/context/CartContext";
import { KitchenProvider } from "@/context/KitchenContext";

export default function Providers({ children }) {
  return <SessionProvider><KitchenProvider><CartProvider>{children}</CartProvider></KitchenProvider></SessionProvider>;
}
