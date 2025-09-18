"use client"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import UserSidebar from "@/components/user/user-sidebar"
import CategorySidebar from "@/components/user/category-sidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePathname } from "next/navigation";
export default function AdminLayout({ children }) {

  const pathname = usePathname();

  return (
    //<ProtectedRoute role="USER">
    <SidebarProvider>
      <div className="flex w-full">
        {pathname.includes("/user/add-listing") ? <CategorySidebar /> : <UserSidebar />}
        <div className="flex flex-col flex-1">

          <header className="flex h-14 items-center border-b px-4 bg-white shadow-sm fixed w-full z-10" >
            <SidebarTrigger />
          </header>

          <main className="flex-1 p-6 bg-white  min-h-screen mt-14">{children}</main>
        </div>
      </div>
    </SidebarProvider>
    //</ProtectedRoute>

  )
}
