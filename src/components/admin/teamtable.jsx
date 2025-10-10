"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Chat1SVG, DeleteSVG, BlockSVG, ViewSVG, Edit1SVG } from "@/svg"
import { useFetchUsers } from "@/hooks/user"
import Link from "next/link"

const TeamTable = () => {

    const { data: allUsers = [], isLoading } = useFetchUsers()


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

    console.log(currentUsers)

    if (isLoading) {
        return <div>Loading...</div>
    }
    


    return (
        <div className="space-y-4">
            <div className="rounded-md border">
                <Table className="text-black font-outfit font-normal text-sm ">
                    <TableHeader className="opacity-50 text-xs">
                        <TableRow>
                            <TableHead className="w-16">S.No</TableHead>
                            <TableHead>User name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Last Online</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentUsers.map((user, index) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                    <Link href={`/admin/team-members/${user.id}`}  className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                                            <AvatarFallback>
                                                {user.first_name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span >{user.first_name + " " + user.last_name}</span>
                                    </Link>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell className="text-[#6C6C6C]">{user.is_online
                                    ? <Button className="bg-[#15CA32]/8 border border-[#15CA32] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#15CA32] hover:bg-transparent">Online</Button>

                                    : <Button className="bg-[#E5C74D]/8 border border-[#E5C74D] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#E5C74D] hover:bg-transparent">Offline</Button>}</TableCell>
                                <TableCell>
                                    {user.status === "online" ? (
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Online</Badge>
                                    ) : (
                                        <span className="text-muted-foreground">Offline</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
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


export default TeamTable