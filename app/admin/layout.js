import AdminSidebar from "@/components/AdminSidebar";
import AdminTopbar from "@/components/AdminTopbar";
import AdminOrderAlertsProvider from "@/components/AdminOrderAlertsProvider";

export const metadata = { title: "Admin | GharKaBite", robots: { index: false, follow: false } };

export default function AdminLayout({ children }) {
  return <AdminOrderAlertsProvider><div data-admin-layout className="flex min-h-screen bg-[#f5f6f2]"><AdminSidebar /><div className="min-w-0 flex-1"><AdminTopbar /><main className="p-4 md:p-6 lg:p-8">{children}</main></div></div></AdminOrderAlertsProvider>;
}
