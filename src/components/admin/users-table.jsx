"use client"
import React, { useState, useEffect } from "react"
import {
    Table, TableBody, TableHead, TableHeader, TableRow, TableCell
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { useFetchUsers } from "@/hooks/user"
import { Skeleton } from "@/components/ui/skeleton"
import { VerifiedSVG, ProSVG, DeleteSVG, BlockSVG, ViewSVG, } from "@/svg"
import Link from "next/link"


const TableHaeding = [
    "ID", "User name", "Phone Number", "Listings", "Registration Date", "Verification", "Status", "Notes", "Actions"
]

const UserTables = () => {
    const { data: allUsers = [], isLoading } = useFetchUsers()
    const [currentPage, setCurrentPage] = useState(1)
    const usersPerPage = 10

    // Calculate pages
    const totalUsers = allUsers?.length || 0
    const totalPages = Math.ceil(totalUsers / usersPerPage)

    // Slice data for pagination
    const startIndex = (currentPage - 1) * usersPerPage
    const currentUsers = allUsers.slice(startIndex, startIndex + usersPerPage)

    // Handlers
    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1)
    }
    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1)
    }
    const handlePageClick = (pageNum) => setCurrentPage(pageNum)



    const status = [
        <Button className="bg-[#15CA32]/8 border border-[#15CA32] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#15CA32] hover:bg-transparent">Online</Button>,
        <Button className="bg-[#E5C74D]/8 border border-[#E5C74D] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#E5C74D] hover:bg-transparent">Offline</Button>,
        <Button className="bg-[#FF1F1F]/8 border border-[#FF0004] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#FF0004] hover:bg-transparent">Blocked</Button>

    ]

    const notes = [
        "This user h",
        "could be high risk",
        "is a scammer",
        "Interesting person",
        ""
    ]


    return (
        <div className="flex flex-col gap-4">
            <Table className="border rounded-full">
                <TableHeader>
                    <TableRow>
                        {TableHaeding.map((item, index) => (
                            <TableHead
                                key={index}
                                className={`text-xs font-normal text-black opacity-50 font-outfit ${index === 0 ? "w-14 text-center" : "w-14"
                                    }`}
                            >
                                {item}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {isLoading
                        ? Array(10)
                            .fill(null)
                            .map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton className="h-4 w-6 mx-auto rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20 rounded" /></TableCell>
                                </TableRow>
                            ))
                        : currentUsers.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell className="text-center text-sm">{startIndex + index + 1}</TableCell>
                                <TableCell className="text-sm font-normal text-black font-outfit">
                                    <Link href={`/admin/users/${item.id}`} className="flex items-center gap-2">
                                        <img src="/avatar1.png" className="size-10 rounded-full object-cover" alt="" />
                                        {item.first_name} {item.last_name}
                                    </Link>
                                </TableCell>
                                <TableCell>{item.phone}</TableCell>
                                <TableCell>{Math.floor(Math.random() * 100)}</TableCell>
                                <TableCell>{item.created_at?.slice(0, 10)}</TableCell>
                                <TableCell>
                                    {item.is_email_verified && <span className="flex gap-1"><VerifiedSVG /> E-Mail</span>}
                                    {item.is_phone_verified && <span className="flex gap-1"><VerifiedSVG /> Phone</span>}
                                </TableCell>
                                <TableCell>{status[Math.floor(Math.random() * 3)]}</TableCell>
                                <TableCell>{notes[Math.floor(Math.random() * 5)]}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" side="left" className="border border-[#C6FE1F] rounded-lg flex flex-col gap-1">
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><ViewSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><BlockSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><DeleteSVG /></DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex flex-row justify-between items-center mt-4">
                <p className="text-sm text-gray-700">
                    Showing {startIndex + 1}-{Math.min(startIndex + usersPerPage, totalUsers)} of {totalUsers}
                </p>

                <div className="flex flex-row items-center gap-2">
                    <Button
                        variant="outline"
                        className="size-8 flex justify-center items-center rounded-lg"
                        disabled={currentPage === 1}
                        onClick={handlePrev}
                    >
                        &lt;
                    </Button>

                    {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
                        const page = index + 1
                        return (
                            <Button
                                key={page}
                                onClick={() => handlePageClick(page)}
                                className={`size-8 rounded-lg ${currentPage === page
                                    ? "bg-[#C6FE1F] text-black font-bold"
                                    : "bg-white text-black border"
                                    }`}
                            >
                                {page}
                            </Button>
                        )
                    })}

                    <Button
                        variant="outline"
                        className="size-8 flex justify-center items-center rounded-lg"
                        disabled={currentPage === totalPages}
                        onClick={handleNext}
                    >
                        &gt;
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default UserTables
