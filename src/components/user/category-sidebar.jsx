"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Sidebar,
    SidebarContent,
} from "@/components/ui/sidebar"
import {
    LayoutDashboard,
    Users,
    MessagesSquare,
    FileText,
    List,
} from "lucide-react"
import {
    AlertsSVG,
    SearchlistSVG,
    CategorySVG,
    BrandInformationSVG,
    ToolsSVG,
    FinancialsSVG,
    AdditionalInfosSVG,
    AccountsSVG,
    AdInformationsSVG,
    HandoverSVG,
    PackagesSVG,
    StatisticsSVG,
    ProductSVG,
    ManagementSVG,
} from "@/svg"

const menu = [
    { label: "Category", href: "/category", icon: CategorySVG, useFill: true },
    { label: "Brand Information", href: "/admin/content-management/brand-information", icon: BrandInformationSVG, useFill: true },
    {
        label: "Tools",
        href: "/admin/content-management/tools",
        icon: ToolsSVG,
        useFill: false,
        subMenu: [
            { label: "Statistics", href: "/admin/content-management/statistics", icon: StatisticsSVG, useFill: false },
            { label: "Products", href: "/admin/content-management/product", icon: ProductSVG, useFill: false },
            { label: "Management", href: "/admin/content-management/management", icon: ManagementSVG, useFill: false },
        ],
    },
    { label: "Financials", href: "/admin/content-management/financials", icon: FinancialsSVG, useFill: false },
    {
        label: "Additional Infos",
        href: "#additional-infos",
        icon: AdditionalInfosSVG,
        useFill: false,
        subMenu: [
            { label: "Statistics", href: "/admin/content-management/statistics", icon: StatisticsSVG, useFill: false },
            { label: "Products", href: "/admin/content-management/product", icon: ProductSVG, useFill: false },
            { label: "Management", href: "/admin/content-management/management", icon: ManagementSVG, useFill: false },
        ],
    },
    { label: "Accounts", href: "/admin/content-management/accounts", icon: AccountsSVG, useFill: false },
    { label: "Ad Informations", href: "/admin/content-management/ad-information", icon: AdInformationsSVG, useFill: true },
    { label: "Handover", href: "/admin/content-management/handover", icon: HandoverSVG, useFill: true },
    { label: "Packages", href: "/admin/content-management/packages", icon: PackagesSVG, useFill: true },
]

export default function CategorySidebar() {
    const pathname = usePathname()
    const [openMenus, setOpenMenus] = useState({})

    const toggleMenu = (key) => {
        setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <Sidebar className="w-64 bg-[#111] text-white flex flex-col">
            <SidebarContent className="flex-1">
                <nav className="flex flex-col gap-2 p-2">
                    {menu.map((item) => {
                        const isActive = pathname === item.href
                        const isAnySubActive = item.subMenu?.some((sub) => pathname === sub.href)
                        const showSubmenu = openMenus[item.href] || isAnySubActive
                        const Icon = item.icon

                        return (
                            <div key={item.href} className="flex flex-col">
                                {item.subMenu ? (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleMenu(item.href)}
                                        aria-expanded={!!showSubmenu}
                                        className="flex items-center justify-between gap-2 rounded-[56px] px-3 py-2 cursor-pointer hover:bg-white/10"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Icon />
                                            <span>{item.label}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-2 rounded-[56px] px-3 py-2 transition-colors
                                        ${isActive ? "bg-[#C6FE1F] text-black font-medium" : "hover:bg-white/10"}`}
                                    >
                                        <Icon  />
                                        <span>{item.label}</span>
                                    </Link>
                                )}

                                {showSubmenu && item.subMenu && (
                                    <div className="ml-6 mt-1 flex flex-col gap-1 transition-all duration-200">
                                        {item.subMenu.map((sub) => {
                                            const isSubActiveLink = pathname === sub.href
                                            const isAnyNestedActive = sub.subMenu?.some((nested) => pathname === nested.href)
                                            const showNestedMenu = openMenus[sub.href] || isAnyNestedActive
                                            const SubIcon = sub.icon
                                            const useFill = sub.useFill ?? false

                                            return (
                                                <div key={sub.href} className="flex flex-col">
                                                    {sub.subMenu ? (
                                                        <div
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => toggleMenu(sub.href)}
                                                            aria-expanded={!!showNestedMenu}
                                                            className="flex items-center gap-2 rounded-[56px] px-3 py-2 cursor-pointer hover:bg-white/10"
                                                        >
                                                            <SubIcon
                                                                className={` ${isSubActiveLink
                                                                    ? useFill
                                                                        ? "[&_path]:!fill-black [&_path]:!stroke-none"
                                                                        : "[&_path]:!stroke-black [&_path]:!fill-none"
                                                                    : useFill
                                                                        ? "[&_path]:fill-white [&_path]:stroke-none"
                                                                        : "[&_path]:stroke-white [&_path]:fill-none"
                                                                    }`}
                                                            />
                                                            <span>{sub.label}</span>
                                                        </div>
                                                    ) : (
                                                        <Link
                                                            href={sub.href}
                                                            className={`flex items-center gap-2 rounded-[56px] px-3 py-2 transition-colors
                                ${isSubActiveLink ? "bg-[#C6FE1F] text-black font-medium" : "hover:bg-white/10"}`}
                                                        >
                                                            <SubIcon
                                                                className={`w-4 h-4 ${isSubActiveLink
                                                                    ? useFill
                                                                        ? "[&_path]:!fill-black [&_path]:!stroke-none"
                                                                        : "[&_path]:!stroke-black [&_path]:!fill-none"
                                                                    : useFill
                                                                        ? "[&_path]:fill-white [&_path]:stroke-none"
                                                                        : "[&_path]:stroke-white [&_path]:fill-none"
                                                                    }`}
                                                            />
                                                            <span>{sub.label}</span>
                                                        </Link>
                                                    )}

                                                    {showNestedMenu && sub.subMenu && (
                                                        <div className="ml-6 mt-1 flex flex-col gap-1 transition-all duration-200">
                                                            {sub.subMenu.map((nested) => {
                                                                const isNestedActive = pathname === nested.href
                                                                const NestedIcon = nested.icon
                                                                const useNestedFill = nested.useFill ?? false

                                                                return (
                                                                    <Link
                                                                        key={nested.href}
                                                                        href={nested.href}
                                                                        className={`flex items-center gap-2 rounded-[56px] px-3 py-2 transition-colors
                                      ${isNestedActive ? "bg-[#C6FE1F] text-black font-medium" : "hover:bg-white/10"}`}
                                                                    >
                                                                        <NestedIcon
                                                                            className={`w-4 h-4 ${isNestedActive
                                                                                ? useNestedFill
                                                                                    ? "[&_path]:!fill-black [&_path]:!stroke-none"
                                                                                    : "[&_path]:!stroke-black [&_path]:!fill-none"
                                                                                : useNestedFill
                                                                                    ? "[&_path]:fill-white [&_path]:stroke-none"
                                                                                    : "[&_path]:stroke-white [&_path]:fill-none"
                                                                                }`}
                                                                        />
                                                                        <span>{nested.label}</span>
                                                                    </Link>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>
            </SidebarContent>
        </Sidebar>
    )
}
