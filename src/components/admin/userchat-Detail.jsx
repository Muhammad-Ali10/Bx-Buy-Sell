"use client"

import React from "react"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { ChevronRight } from 'lucide-react';
import { DocsSVG, ChatLabelSVG, ReportSVG, OfferSVG } from "@/svg"
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
const UserChatDetails = () => {

    return (
        <div className="max-w-[273.57px] w-full flex flex-col border border-black/10 rounded-2xl px-2 py-4 gap-5 h-full">
            <h3 className="text-xs font-lufga font-medium text-black text-start">Details</h3>
            <div className="flex flex-col gap-2 relative items-center">
                <div className="flex flex-row gap-0 items-center justify-center relative">
                    <Avatar className="absolute -left-1 z-10">
                        <AvatarImage src="/avatar2.png" className="object-cover" alt="avatar" />
                    </Avatar>
                    <Avatar className="absolute -right-1 ">
                        <AvatarImage src="/avatar3.jpg" className="object-cover" alt="avatar" />
                    </Avatar>
                </div>
                <Avatar className="absolute z-20">
                    <AvatarImage src="/avatar4.png" className="object-cover" alt="avatar" />
                </Avatar>
            </div>
            <div className="flex flex-col gap-2 mt-6 ">
                <h3 className="font-lufga font-medium text-black text-center">Online Fashion Store</h3>
                <p className="text-xs font-lufga text-black/50 text-center">3 Members, 1 online</p>
            </div>
            <div className="flex flex-col gap-4 mt-6 bg-[#FAFAFA] p-2">
                <div className="flex flex-row justify-between items-center">
                    <h3 className="text-xs font-lufga font-medium text-black flex items-center gap-2"><DocsSVG />Docs, Link, Media</h3>
                    <div className="flex flex-row gap-2 items-center">
                        <Badge className="bg-black/5 text-[10px] font-lufga font-medium text-black/50 text-center">120</Badge>
                        <ChevronRight className="size-4" />
                    </div>
                </div>
                <div className="flex flex-row justify-between items-center">
                    <h3 className="text-xs font-lufga font-medium text-black flex items-center gap-2"><ChatLabelSVG />⁠Label this chat</h3>
                    <div className="flex flex-row gap-2 items-center">
                        <Badge className="bg-black/5 text-[10px] font-lufga font-medium text-[#22BF15] text-center">Good</Badge>
                        <ChevronRight className="size-4" />
                    </div>
                </div>
                <div className="flex flex-row justify-between items-center">
                    <h3 className="text-xs font-lufga font-medium text-black flex items-center gap-2"><ReportSVG />Report chat</h3>
                    <div className="flex flex-row gap-2 items-center">
                        <Badge className="bg-black/5 text-[10px] font-lufga font-medium text-black/50 text-center">120</Badge>
                        <ChevronRight className="size-4" />
                    </div>
                </div>
            </div>
            <Button className="bg-[#C6FE1F] text-black font-lufga font-medium rounded-full hover:bg-[#C6FE1F]">
                <OfferSVG />Make Offer
            </Button>

            <div className="rounded-lg   bg-[#FAFAFA] overflow-hidden">
                <div className="relative">
                    <Image
                        src="/service.png"
                        width={400}
                        height={285}
                        alt="E-commerce Store"
                        className="w-full object-cover"
                    />
                    <button className="absolute top-3 right-3 bg-white  w-[22px] h-[22px] height rounded-full">
                        <Image
                            src="/Vector.png"
                            width={8}
                            height={8}
                            className="m-auto"
                            alt="like"
                        />
                    </button>
                    <button className="absolute top-[40px] right-3 bg-white w-[22px] h-[22px] height rounded-full">
                        <Image
                            src="/Frame.png"
                            width={8}
                            height={8}
                            alt="share"
                            className="m-auto"
                        />
                    </button>
                    <div className="absolute bottom-3 left-3 flex space-x-2">
                        <div className="bg-black/25 text-xs  md:!text-base  font-medium font-lufga px-3 py-1 text-white rounded-full">
                            Saas
                        </div>
                    </div>
                </div>
                <div className="flex flex-col justify-between p-4  gap-2">
                    <div className="flex flex-row justify-between items-center">
                        <h3 className="text-xs font-semibold font-lufga mb-1 text-black">
                            E-commerce Store
                        </h3>
                    </div>
                    <div className="flex flex-row justify-between items-center mb-4">
                        <p className="text-[8.57px] font-normal font-lufga text-black">
                            Easily manage your listings with images, pricing, status, and requests to optimize your selling experience.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )

}

export default UserChatDetails;
