"use client"
import React from "react"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerifiedSVG, ProSVG, DeleteSVG, BlockSVG, ViewSVG,} from "@/svg"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal} from "lucide-react"

const userData = [
    {
        id: 1,
        name: "User 1",
        avatar: "/images/user1.jpg",
        level: "pro",
        phoneNumber: "+212600 000 001",
        listings: 230,
        registrationDate: "2025-07-10",
        verification: ["phone", "email", "kc"],
        status: "Online",
        notes: "This user"
    },
    {
        id: 2,
        name: "User 2",
        avatar: "/images/user2.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone", "email"],
        status: "Offline",
        notes: "-"
    },
    {
        id: 3,
        name: "User 3",
        avatar: "/images/user3.jpg",
        level: "pro",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone", "email"],
        status: "Offline",
        notes: "-"
    },
    {
        id: 4,
        name: "User 4",
        avatar: "/images/user4.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone", "email", "kc"],
        status: "Blocked",
        notes: "is a scammer"
    },
    {
        id: 5,
        name: "User 5",
        avatar: "/images/user5.jpg",
        level: "pro",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "could be high risk"
    },
    {
        id: 6,
        name: "User 6",
        avatar: "/images/user6.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "-"
    },
    {
        id: 7,
        name: "User 7",
        avatar: "/images/user7.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "-"
    },
    {
        id: 8,
        name: "User 8",
        avatar: "/images/user8.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "-"
    },
    {
        id: 9,
        name: "User 9",
        avatar: "/images/user9.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "-"
    },
    {
        id: 10,
        name: "User 10",
        avatar: "/images/user10.jpg",
        phoneNumber: "+212600 000 001",
        listings: 6,
        registrationDate: "2025-07-10",
        verification: ["phone"],
        status: "Online",
        notes: "Interesting person"
    }
]

const TableHaeding = ["ID", "User name", "Phone Number", "Listings", "Registration Date", "Verification", "Status", "Notes", "Actions"]


const statusgenerate = (status) => {
    switch (status) {
        case "Online":
            return <Button className="bg-[#15CA32]/8 border border-[#15CA32] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#15CA32] hover:bg-transparent">{status}</Button>
            break;
        case "Offline":
            return <Button className="bg-[#E5C74D]/8 border border-[#E5C74D] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#E5C74D] hover:bg-transparent">{status}</Button>
            break;
        case "Blocked":
            return <Button className="bg-[#FF1F1F]/8 border border-[#FF0004] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#FF0004] hover:bg-transparent">{status}</Button>
            break;
        default:
            break;
    }
}

const UserTables = () => {

    return (
        <Table className="border rounded-full">
            <TableHeader>
                <TableRow>
                    {
                        TableHaeding.map((item, index) => {
                            return <TableHead className={`${index === 0 ? "w-14 text-center" : "w-14"} text-xs font-normal text-black opacity-50 font-outfit m-auto my-auto`} key={index}>{item}</TableHead>
                        })
                    }
                </TableRow>
            </TableHeader>
            <TableBody>
                {
                    userData.map((item, index) => {
                        return (
                            <TableRow key={index}>
                                <TableCell className="w-14 text-center text-sm font-normal text-black font-outfit">{item.id}</TableCell>
                                <TableCell className="text-sm font-normal text-black font-outfit">
                                    <span className="flex flex-row items-center gap-2">
                                        <div className="flex flex-col">
                                            <img src="/avatar1.png" className="size-10 rounded-[80px] object-cover" alt={item.name} />
                                            {item?.level && <Badge className="text-[9px] font-lufga text-black bg-[#C6FE1F] -mt-2 flex items-center p-0 gap-1 w-10 h-3.5"><ProSVG className="size-2.5 mt-1" /> <span>Pro</span></Badge>}
                                        </div>
                                        {item.name}</span>
                                </TableCell>
                                <TableCell className="text-sm font-normal text-black font-outfit">{item.phoneNumber}</TableCell>
                                <TableCell className="  text-sm font-normal text-black font-outfit">{item.listings}</TableCell>
                                <TableCell className="  text-sm font-normal text-[#6C6C6C] font-lufga">{item.registrationDate}</TableCell>
                                <TableCell className="flex flex-col  text-sm font-normal text-[#6C6C6C] font-abeezee capitalize">{item.verification.map((item, index) => (
                                    <span key={index} className="flex gap-1"><VerifiedSVG /> {item}</span>
                                ))}</TableCell>
                                <TableCell className="text-sm font-normal text-[#6C6C6C] font-lufga">{statusgenerate(item.status)}</TableCell>
                                <TableCell className="text-sm font-normal text-[#6C6C6C] font-lufga">{item.notes}</TableCell>
                                <TableCell className=" ">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" side="left"  className="border border-[#C6FE1F] rounded-lg min-w-14 items-center gap-2 flex flex-col">
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><ViewSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><BlockSVG /></DropdownMenuItem>
                                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><DeleteSVG /></DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>

                            </TableRow>
                        )
                    })
                }
            </TableBody>
        </Table>
    )
}

export default UserTables   