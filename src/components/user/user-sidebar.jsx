"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sidebar, SidebarContent } from "@/components/ui/sidebar"
import { Heart, MessagesSquare, List } from "lucide-react"

const menu = [
  { label: "My Listings", href: "/user", icon: List },
  { label: "Favourites", href: "/user/favourites", icon: Heart },
  { label: "Chat", href: "/user/chat", icon: MessagesSquare },
  { label: "Account Details", href: "/user/account-details", icon: List },
  { label: "Verify Your Account", href: "/user/verify", icon: List },
  { label: "Settings", href: "/user/settings", icon: List },
  { label: "Log Out", href: "/logout", icon: List },
]

export default function UserSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="w-64 bg-[#111] text-white flex flex-col">
      <SidebarContent className="flex-1">
        <nav className="flex flex-col gap-2 p-2">
          {menu.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-[56px] px-3 py-2 transition-colors
                  ${isActive ? "bg-[#C6FE1F] text-black font-medium" : "hover:bg-white/10"}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}
