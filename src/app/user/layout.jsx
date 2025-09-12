"use client"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import UserSidebar from "@/components/user/user-sidebar"

export default function AdminLayout({ children }) {
  return (
    <SidebarProvider>
      <div className="flex w-full">
        <UserSidebar />
        <div className="flex flex-col flex-1">
         
          <header className="flex h-14 items-center border-b px-4 bg-white shadow-sm fixed w-full z-10" >
            <SidebarTrigger />
          </header>

          <main className="flex-1 p-6 bg-white  min-h-screen mt-14">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
