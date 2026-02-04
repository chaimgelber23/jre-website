import AdminHeader from "@/components/admin/AdminHeader";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthCheck>
      <div className="min-h-screen bg-[#FBFBFB]">
        <AdminHeader />
        <AdminTabs />
        <main className="container mx-auto px-6 py-8">{children}</main>
      </div>
    </AdminAuthCheck>
  );
}
