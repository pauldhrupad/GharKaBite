"use client";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import MobileBottomNav from "./MobileBottomNav";
import Footer from "./Footer";
import CartPeriodConflictModal from "./CartPeriodConflictModal";
import StickyMobileCartBar from "./StickyMobileCartBar";

export default function AppChrome({ children }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/owner") || pathname.startsWith("/staff")) return children;
  return <div className="flex min-h-screen flex-col"><Navbar /><main className="flex-1">{children}</main><StickyMobileCartBar /><Footer /><MobileBottomNav /><CartPeriodConflictModal /></div>;
}
