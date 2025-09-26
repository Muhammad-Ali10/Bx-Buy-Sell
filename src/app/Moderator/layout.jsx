"use client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/admin-sidebar";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AdminLayout({ children }) {
  return (
  <ProtectedRoute roles={["MODERATOR"]}>
      <SidebarProvider>
        <div className="flex w-full">
          <AdminSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex h-14 items-center border-b px-4 bg-white shadow-sm fixed w-full z-10">
              <SidebarTrigger />
            </header>

            <main className="flex-1 p-6 bg-white min-h-screen mt-14">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
