"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Chat1SVG, DeleteSVG, BlockSVG, ViewSVG, Edit1SVG, AppIconSVG, Menu2SVG } from "@/svg"
import { dummyAdminListings } from "@/lib/dummy-data"


// Dummy data matching the image
const generateUsers = () => {

    const users = []
    for (let i = 0; i < dummyAdminListings.length; i++) {
        const baseUser = dummyAdminListings[i % dummyAdminListings.length]
        users.push({
            name: `${baseUser.userName}${i > 7 ? ` ${Math.floor(i / 8) + 1}` : ""}`,
            title: baseUser.title,
            links: baseUser.link,
            Managed: baseUser.managed,
            lastOnline: "2025-07-10",
            status: Math.random() > 0.6 ? "online" : "offline",
            avatar: `/placeholder.svg?height=40&width=40&query=user-${i + 1}`,
            responsible: baseUser.responsible,
        })
    }
    return users
}

const allUsers = generateUsers()

const ListingsTable = () => {
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 8
    const totalUsers = allUsers.length
    const totalPages = Math.ceil(totalUsers / itemsPerPage)

    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentUsers = allUsers.slice(startIndex, endIndex)

    const goToPage = (page) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    }

    const goToPrevious = () => {
        setCurrentPage((prev) => Math.max(1, prev - 1))
    }

    const goToNext = () => {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table className="text-black font-outfit font-normal text-sm ">
                    <TableHeader className="opacity-50 text-xs">
                        <TableRow>
                            <TableHead>User name</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Managed</TableHead>
                            <TableHead>Responsible</TableHead>
                            <TableHead className="text-left">View</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentUsers.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                                            <AvatarFallback>
                                                {user.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span >{user.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{user.title}</TableCell>
                                <TableCell>{user.links}</TableCell>
                                <TableCell className="text-[#6C6C6C]">{user.lastOnline}</TableCell>
                                <TableCell>
                                    {user.status === "online" ? (
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Online</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">Offline</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.Managed === "by EX" ? (
                                        <Badge className="bg-[#C6FE1F] text-black text-[8px] font-lufga font-medium hover:bg[#C6FE1F] px-3 py-1.5 rounded-full"><AppIconSVG /> by EX
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-[#F4F4F4] text-black text-[8px] font-lufga font-medium hover:bg[#F4F4F4] px-3 py-1.5 rounded-full">by Owner
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.responsible} />
                                            <AvatarFallback>
                                                {user.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span >{user.responsible}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <Menu2SVG/>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="right" className="border border-[#C6FE1F] rounded-lg min-w-14 items-center gap-2 flex flex-col">
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><ViewSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><Edit1SVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><Chat1SVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><BlockSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><DeleteSVG /></DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-black font-outfit font-normal">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalUsers)} of {totalUsers}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={goToPrevious}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = i + 1
                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className={`text-base font-outfit font-bold ${currentPage === pageNum ? "bg-[#C6FE1F] text-black hover:bg-lime-500" : ""}`}
                                onClick={() => goToPage(pageNum)}
                            >
                                {pageNum}
                            </Button>
                        )
                    })}

                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={goToNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}


export default ListingsTable       