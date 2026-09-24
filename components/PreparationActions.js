"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreparationActions() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [router]);

  return <button type="button" onClick={() => window.print()} className="print:hidden min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-black text-white hover:bg-primary-hover">Print preparation sheet</button>;
}
