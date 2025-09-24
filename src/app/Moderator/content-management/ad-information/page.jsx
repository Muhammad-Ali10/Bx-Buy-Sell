"use client"
import React from "react"
import { Button } from "@/components/ui/button"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import AdInformation from "@/components/admin/ad-info-question"

const Management = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <div className="flex flex-row items-center justify-between">
                    <h3 className="font-lufga font-medium text-2xl text-black">Added Ad Information Questions</h3>
                    {/* Add Member Button with Dialog */}
                    <Dialog className="w-full ">
                        <DialogTrigger asChild>
                            <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                                Add New Question
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                            <DialogHeader className="px-6 pt-6 pb-2">
                                <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                    Added Ad Information Questions 
                                </DialogTitle>
                            </DialogHeader>
                            <div className="px-6 pb-6 h-full">
                                <AdInformation />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="flex flex-row items-center justify-between flex-wrap" >
                    <div className="bg-white border border-black/10  items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full">
                        <h3 className="font-lufga font-medium text-base text-center text-black">E-Commerce</h3>
                        <div className="flex items-center gap-4">
                            <Button className="bg-[#C6FE1F] hover:bg-[#C6FE1F] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-black">Edit</Button>
                            <Button className="bg-[#FF2022] hover:bg-[#FF2022] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-white">Delete</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Management   
