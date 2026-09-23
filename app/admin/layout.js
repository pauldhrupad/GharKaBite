import AdminSidebar from "@/components/AdminSidebar";
import AdminAvatar from "@/components/AdminAvatar";

export const metadata = { title: "Admin | GharKaBite", robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return <div data-admin-layout className="flex min-h-screen bg-[#f5f6f2]"><AdminSidebar /><div className="min-w-0 flex-1"><header className="flex h-17 items-center justify-between border-b border-border bg-white px-5 pl-18 lg:px-8"><div><p className="text-xs font-bold text-text-secondary">Kitchen control</p><p className="font-black">GharKaBite Admin</p></div><AdminAvatar /></header><main className="p-4 md:p-6 lg:p-8">{children}</main></div></div>;
}
