"use client"
import {
    CameraSVG,
    SearchSVG,
    ArrowRightSVG,
    Menu2SVG,
    FileSVG,
    SendSVG,
} from "@/svg"
import Link from "next/link";
import UserChatList from "@/components/admin/userchat-list";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserChatDetails from "@/components/admin/userchat-Detail";



const AllChats = () => {

    return (
        <div className="flex flex-col items-start gap-8 w-full h-full overflow-hidden">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>User Details</Link>
            <div className="flex flex-row items-center justify-between gap-2 w-full ">
                <UserChatList />
                <div className="w-full flex flex-col border border-black/10 rounded-2xl gap-5 overflow-hidden">
                    <div className="flex flex-row items-center justify-between w-full bg-white border-b px-4 py-4">
                        <div className="flex flex-col items-start justify-between w-full gap-1">
                            <h3 className="text-lg font-lufga font-medium text-black">E-Commerce Store</h3>
                            <span className="text-sm font-lufga font-normal text-black/50">3 Members, 1 online</span>
                        </div>
                        <div className="flex flex-row items-center justify-between w-full gap-2 max-w-28">
                            <div className="p-2.5 bg-[#F9FBFC] rounded-[18px]">
                                <SearchSVG />
                            </div>
                            <div className="p-2.5 bg-[#F9FBFC] rounded-[18px]">
                                <CameraSVG />
                            </div>
                            <div className="p-2.5 bg-[#F9FBFC] rounded-[18px]">
                                <Menu2SVG />
                            </div>
                            <div className="bg-[#F9FBFC]"></div>
                        </div>
                    </div>
                    <div className="flex flex-col bg-[#F9FBFC] px-4 pb-4 justify-between w-full gap-5">
                        <div className="flex flex-row gap-2.5">
                            <Avatar>
                                <AvatarImage src="/avatar1.png" alt="avatar" />
                            </Avatar>
                            <div className="flex flex-col gap-1 bg-[#EEEFFA] max-w-[344px] rounded-2xl p-4 w-full">
                                <div className="flex flex-row items-center gap-2 ">
                                    <span className="text-[10px] font-lufga font-medium text-black">@Alex</span>
                                    <Button className="bg-[#C6FE1F] text-black text-[8.57px] font-lufga font-medium py-0.5 px-1.5 h-auto rounded-full hover:bg-[#C6FE1F]">Official EX-Support</Button>
                                </div>
                                <p className="text-[10px] font-lufga font-medium text-black">Explanation : History: Average of 3.2 goals per match in the last 10 matches. Current Form: Liverpool 1.6 goals/match at home, Man City 2 goals/match away. Key Players: Salah and Haaland in form scoring regularly. Match Conditions: Ideal weather and key players available.</p>
                                <span className="text-[10px] font-lufga font-medium text-black/50 text-right">12 Nov 2025, 09:10 AM</span>
                            </div>
                        </div>
                        <div className="flex flex-row gap-2.5 w-full items-end justify-end">
                            <div className="flex flex-col gap-1 bg-[#1364FF] max-w-[213px] rounded-2xl p-4 w-full">
                                <p className="text-[10px] font-lufga font-medium text-white">How many goals will be scored in the Liverpool - Manchester City match?</p>
                                <span className="text-[10px] font-lufga font-medium text-black/50 text-right">12 Nov 2025, 09:10 AM</span>
                            </div>
                        </div>
                        <div className="flex flex-row items-center border bg-[#EEEFFA] border-black/10 w-full py-0 px-[13.68px] rounded-4xl ">
                            <FileSVG />
                            <Input type="text" placeholder="Search" className="border-0 shadow-none outline-none w-full focus-visible:outline-none focus-visible:ring-0 text-[10px]" />
                            <Button className="bg-[#C6FE1F] p-2 rounded-full size-7 hover:bg-[#C6FE1F]">
                                <SendSVG />
                            </Button>
                        </div>
                    </div>
                </div>
                <UserChatDetails/>
            </div>
        </div>
    )
}

export default AllChats