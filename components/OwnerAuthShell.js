import Link from "next/link";
import { ArrowLeft, ClipboardList, LockKeyhole, ShieldCheck } from "lucide-react";
import BrandMark from "./BrandMark";

export default function OwnerAuthShell({ children }) {
  return (
    <main data-owner-auth className="min-h-screen bg-[#f1f3ee] px-4 py-5 text-[#24342c] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 font-black tracking-tight" aria-label="GharKaBite home"><BrandMark className="size-16" loading="eager" /><span className="rounded-md bg-[#e3eae1] px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#365944]">Owner</span></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#52665a] hover:text-[#244b32]"><ArrowLeft className="size-4" aria-hidden="true" /> Customer site</Link>
        </div>
        <div className="grid overflow-hidden rounded-[1.75rem] border border-[#d8e0d8] bg-white shadow-[0_24px_70px_rgba(28,55,38,0.12)] lg:min-h-[38rem] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="relative overflow-hidden bg-[#193c2c] p-7 text-white sm:p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-white/10 bg-white/5" />
            <div className="relative">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><ClipboardList className="size-6" aria-hidden="true" /></span>
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.22em] text-[#b9d8c4]">Kitchen workspace</p>
              <h1 className="mt-3 max-w-sm text-3xl font-black leading-tight tracking-tight sm:text-4xl">Run the kitchen with a clear view of every order.</h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#d5e4d9]">Manage the daily menu, meal plans, orders and delivery settings in one secure place.</p>
            </div>
            <div className="relative mt-8 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/8 p-4 text-sm leading-5 text-[#e5efe7]"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#bed9be]" aria-hidden="true" /><span>Only your owner account can open the admin dashboard.</span></div>
          </aside>
          <div className="flex items-center px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
            <div className="w-full">{children}</div>
          </div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-[#617268]"><LockKeyhole className="size-3.5" aria-hidden="true" /> Owner access is separate from customer checkout.</p>
      </div>
    </main>
  );
}
