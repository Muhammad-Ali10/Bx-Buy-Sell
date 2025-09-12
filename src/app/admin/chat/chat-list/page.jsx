import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react";
import { DeleteSVG, BlockSVG, ViewSVG, } from "@/svg"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import AssignMember from "@/components/admin/assign-member";



const ChatList = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">

            <div className="flex flex-row gap-10 items-center">
                <div className="flex flex-row gap-2 items-center bg-[#FCFCFC]">
                    <Button className="bg-[#C6FE1F] hover:bg-[#C6FE1F] px-6 py-6 rounded-xl text-lg font-lufga text-black font-bold">All Chat</Button>
                    <Button className="bg-transparent hover:bg-transparent px-6 py-6 rounded-xl text-lg font-lufga text-black font-bold">Assigned</Button>
                    <Button className="bg-transparent hover:bg-transparent px-6 py-6 rounded-xl text-lg font-lufga text-black font-bold">Unassigned</Button>
                </div>

                {/* Search Box */}
                <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                    <Search className="text-gray-500" />
                    <Input
                        type="text"
                        placeholder="Search by name, phone, username or email ..."
                        className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                    />
                </div>
            </div>
            <div className="border border-black/25 rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="font-lufga text-xs font-normal text-black opacity-70">
                            <TableHead className="text-center">S no</TableHead>
                            <TableHead>User Group</TableHead>
                            <TableHead>Last Message</TableHead>
                            <TableHead>Chat Status</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Created Date</TableHead>
                            <TableHead>Assigned to</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array(10).fill(0).map((_, index) => (
                            <TableRow>
                                <TableCell>
                                    132
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2  ">
                                        <Avatar>
                                            <AvatarImage src="/bot.png" alt="Bot Avatar" />
                                        </Avatar>
                                        <h3 className="font-lufga text-xs font-medium text-black ">Pet Affiliate Website</h3>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm font-outfit font-normal text-black">
                                    "Is size 9 available?"
                                </TableCell>
                                <TableCell>
                                    <Button className="bg-[#FF1F1F]/8 border rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#FF0004] hover:bg-transparent">Unsolved</Button>
                                </TableCell>
                                <TableCell className="text-sm font-outfit font-normal text-black">
                                    2hr ago
                                </TableCell>
                                <TableCell className="text-xs font-lufga font-medium text-black">
                                    2025-07-10
                                </TableCell>
                                <TableCell >
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="flex items-center gap-2">
                                                <Avatar>
                                                    <AvatarImage src="/avatarimg.png" alt="Bot Avatar" />
                                                </Avatar>
                                                <h3 className="font-lufga text-sm font-medium text-black">Alessio</h3>
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                                            <DialogHeader className="px-6 pt-6 pb-2">
                                                <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                                   Team Member
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="px-6 pb-6 h-full">
                                                <AssignMember />
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                </TableCell>
                                <TableCell className=" ">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" side="right" className="border border-[#C6FE1F] rounded-lg min-w-14 items-center gap-2 flex flex-col">
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
            </div>
        </div>
    )
}

export default ChatList;