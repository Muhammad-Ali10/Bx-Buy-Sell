"use client"

import React from "react"
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge"
import {
    SearchSVG,
    FilterSVG,
    ArchivedSVG,
    OnlineSVG,
    PinSVG,
} from "@/svg"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { dummychats } from "@/lib/dummy-data"



const UserChatList = () => {

    return (
        <div className="max-w-[273.57px] w-full flex flex-col border border-black/10 rounded-2xl px-2 py-4 gap-5 h-full">
            <div className="flex flex-row items-center justify-between gap-2 w-full">
                <div className="flex flex-row items-center border border-black/10 w-full py-0 px-[13.68px] rounded-4xl ">
                    <SearchSVG />
                    <Input type="text" placeholder="Search" className="border-0 shadow-none outline-none w-full focus-visible:outline-none focus-visible:ring-0 text-[10px]" />
                </div>
                <div className="border border-black/10 bg-[#FAFAFA] flex items-center py-2.5 px-2.5 rounded-full cursor-pointer">
                    <FilterSVG />
                </div>
            </div>
            <div className="flex flex-row items-center justify-between px-2.5">
                <span className="flex items-center gap-2 text-xs font-lufga font-medium text-black"><ArchivedSVG /> Archived</span>
                <Badge className="h-5 min-w-5 rounded-full p-1 text-white bg-[#A5A5A5]">
                    10
                </Badge>
            </div>
            {dummychats.map((chat) => (
                <div className="flex flex-row justify-between items-center" key={chat.id}>
                    <div className="flex flex-row gap-3">
                        <div className="relative">
                            <Avatar>
                                <AvatarImage src="/avatar1.png" alt="Avatar" className="size-8 object-cover" />
                                <AvatarFallback>CN</AvatarFallback>
                            </Avatar>
                            {
                                chat.isOnline === true ? <OnlineSVG className="absolute top-6 right-0" /> :
                                    <Badge className="absolute top-5 -right-1 h-4 w-5 rounded-full p-1 text-white bg-[#A5A5A5]">
                                        {chat.lastSeen}
                                    </Badge>}
                        </div>
                        <div className="flex flex-col justify-between">
                            <h3 className="text-xs font-lufga font-semibold text-black">👻Esther Howard👻</h3>
                            <p className="text-[8.57px] font-lufga font-medium text-black/90">Hey, whats up?</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="font-lufga text-[8.57px] text-black/60 font-medium">{chat.lastMessage}</p>
                        <div className="flex items-center gap-2">
                            <PinSVG />
                            <Badge className="h-4 min-w-4 rounded-full p-1 text-white bg-linear-to-bl from-[#FE4A23] to-[#FF4590] text-[7.41px] font-medium font-lufga">
                                {chat.unreadCount}
                            </Badge>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )

}

export default UserChatList;
