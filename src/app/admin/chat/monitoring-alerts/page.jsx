const { Table, TableHead, TableHeader, TableBody, TableRow, TableCell } = require("@/components/ui/table")
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { WordAlertsSVG, UrlSVG, ViewSVG } from "@/svg"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChevronDown } from 'lucide-react';

const MonitoringAlerts = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">
            {/* Search Box */}
            <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                <Search className="text-gray-500" />
                <Input
                    type="text"
                    placeholder="Search by name, phone, username or email ..."
                    className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                />
            </div>

            <div className="border rounded-2xl">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-6">Problem</TableHead>
                            <TableHead>Reporter</TableHead>
                            <TableHead>Problematic User</TableHead>
                            <TableHead>
                                <div className="flex items-center justify-center gap-2">Status <ChevronDown className="size-3.5" /></div>
                            </TableHead>
                            <TableHead><div className="flex items-center  gap-2">Date <ChevronDown className="size-3.5" /></div></TableHead>
                            <TableHead>Responsible</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead >Edit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array(10).fill('').map((_, index) => (
                            <TableRow>
                                <TableCell>
                                    <div className="text-center pl-4 flex items-center gap-2 text-sm font-lufga text-[#6C6C6C] font-medium">
                                        <WordAlertsSVG /> word <UrlSVG />
                                    </div>
                                </TableCell>
                                <TableCell >
                                    <div className="flex items-center gap-2">
                                        <Avatar>
                                            <AvatarImage src="/bot.png" alt="Bot Avatar" />
                                        </Avatar>
                                        <h3 className="font-lufga text-sm font-medium text-black">Automatic</h3>
                                    </div>
                                </TableCell>
                                <TableCell >
                                    <div className="flex items-center gap-2">
                                        <Avatar>
                                            <AvatarImage src="/avatarimg.png" alt="Bot Avatar" />
                                        </Avatar>
                                        <h3 className="font-lufga text-sm font-medium text-black">NovaRidge</h3>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Button className="bg-[#FF1F1F]/8 border border-[#FF0004] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#FF0004] hover:bg-transparent">Unsolved</Button>
                                </TableCell>
                                <TableCell className="font-lufga text-sm font-medium text-black">
                                    2 minutes ago
                                </TableCell>
                                <TableCell >
                                    <div className="flex items-center gap-2">
                                        <Avatar>
                                            <AvatarImage src="/avatarimg.png" alt="Bot Avatar" />
                                        </Avatar>
                                        <h3 className="font-lufga text-sm font-medium text-black">Alessio</h3>
                                    </div>
                                </TableCell>
                                <TableCell className="font-lufga text-sm font-medium text-black">
                                    This user has made often ..
                                </TableCell>
                                <TableCell >
                                    <div className="border flex items-center justify-center border-[#EBF0ED] bg-[#F4F4F4] rounded-[10px] size-8">
                                        <ViewSVG className="m-auto" />
                                    </div>

                                </TableCell>
                            </TableRow>
                        ))}

                    </TableBody>
                </Table>
            </div>

        </div>
    )
}
export default MonitoringAlerts