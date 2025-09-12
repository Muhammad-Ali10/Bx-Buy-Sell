"use client"
import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import AddCategory from "@/components/admin/add-category"
import Image from "next/image"


const Category = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-row items-center justify-between">
                {/* Search Box */}
                <div className="flex gap-2 items-center justify-center">
                    <h3 className="font-lufga font-medium text-2xl text-black">Category</h3>
                    <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                        <Search className="text-gray-500" />
                        <Input
                            type="text"
                            placeholder="Search by name, phone, username or email ..."
                            className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                        />
                    </div>
                </div>
                {/* Add Member Button with Dialog */}
                <Dialog className="w-full ">
                    <DialogTrigger asChild>
                        <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                            Add Category
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                Add New Category
                            </DialogTitle>
                        </DialogHeader>
                        <div className="px-6 pb-6 h-full">
                            <AddCategory />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <h3 className="font-lufga font-medium text-2xl text-black" >Added Categories</h3>
                <div className="flex flex-row items-center justify-between flex-wrap" >
                    <div className="bg-[#FAFAFA] items-center justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px]">
                        <Image src={"/E-Commerce.png"} alt="E-commerce" width={56} height={56} />
                        <h3 className="font-lufga font-medium text-base text-center text-black">E-Commerce</h3>
                    </div>
                    <div className="bg-[#FAFAFA] items-center justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px]">
                        <Image src={"/E-Commerce.png"} alt="E-commerce" width={56} height={56} />
                        <h3 className="font-lufga font-medium text-base text-center text-black">E-Commerce</h3>
                    </div>
                    <div className="bg-[#FAFAFA] items-center justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px]">
                        <Image src={"/E-Commerce.png"} alt="E-commerce" width={56} height={56} />
                        <h3 className="font-lufga font-medium text-base text-center text-black">E-Commerce</h3>
                    </div>
                    <div className="bg-[#FAFAFA] items-center justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px]">
                        <Image src={"/E-Commerce.png"} alt="E-commerce" width={56} height={56} />
                        <h3 className="font-lufga font-medium text-base text-center text-black">E-Commerce</h3>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Category
