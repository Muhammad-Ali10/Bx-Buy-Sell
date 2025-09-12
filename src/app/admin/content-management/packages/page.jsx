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
import AddPackages from "@/components/admin/addPackages"
import { CricleCheckSVG, EyeSVG, CrownSVG } from "@/svg"
import { Badge } from "@/components/ui/badge"

const Packages = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-row items-center justify-between">
                {/* Search Box */}
                <div className="flex gap-2 items-center justify-start w-full">
                    <h3 className="font-lufga font-medium text-2xl text-black">Packages</h3>
                    <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                        <Search className="text-gray-500" />
                        <Input
                            type="text"
                            placeholder="Search by name..."
                            className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                        />
                    </div>
                </div>
                {/* Add Member Button with Dialog */}
                <Dialog className="w-full">
                    <DialogTrigger asChild>
                        <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                            Add New Package
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px]">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                Add Plan
                            </DialogTitle>
                        </DialogHeader>
                        <div className ="px-6 pb-6 h-full">
                            <AddPackages />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <h3 className="font-lufga font-medium text-2xl text-black" >Added Packages </h3>
                <div className="flex flex-row items-center justify-between flex-wrap" >
                    <div className="bg-white border border-black/10  items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full">
                        <h3 className="font-lufga font-bold text-base text-center text-black">Lorem ipsum dolor sit amet consectetur?</h3>
                        <p className="text-xs font-outfit font-normal text-black">Lorem ipsum dolor sit amet consectetur. Odio sed placerat pellentesque justo arcu. Diam elit mauris massa nisi a eu. Ut lacus ullamcorper porttitor vel lacinia Lobortis eu in vitae
                            libero nunc tortor. Lobortis eu in vitae id ullamcorper enim dictum vel. Cum sociis dictum bibendum fringilla aliquam sapien malesuada maecenas. Maecenas  id ullamcorper in
                            auctor ultrices in nisl egestas risus.</p>
                        <div className="flex items-center gap-4">
                            <Button className="bg-[#C6FE1F] hover:bg-[#C6FE1F] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-black">Edit</Button>
                            <Button className="bg-[#FF2022] hover:bg-[#FF2022] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-white">Delete</Button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <div className="flex items-center justify-between">
                    <h3 className="font-lufga font-medium text-xl text-black" >Basic Plan</h3>
                    <Badge className="text-sm text-black font-lufga font-medium bg-[#E6E6E6] rounded-full"><EyeSVG /> Free</Badge>
                </div>
                <p className="font-lufga font-normal text-sm text-black/50">Buyer FreeBuyer Free Buyer Free Buyer Free</p>
                <h1 className="font-lufga font-medium text-4xl text-black">0$<span className="font-lufga font-medium text-base">/limited</span></h1>
                <div className="flex flex-col md:flex-row justify-between items-end">
                    <ul>
                        {
                            Array(4).fill().map((_, index) => {
                                return (
                                    <li key={index} className="font-lufga font-normal text-xs text-black/80 flex items-center gap-2.5"><CricleCheckSVG /> Free with all basic options</li>
                                )
                            })
                        }
                    </ul>
                    <Button className="bg-[#C6FE1F] py-[21px] px-4 rounded-[62px] text-base font-sora  font-medium text-black w-full max-w-[318px]  hover:bg-[#C6FE1F]">FREE Starter Plan</Button>
                </div>
            </div>
            <div className="flex flex-col gap-6 bg-[#C6FE1F] w-full border border-black/10 rounded-4xl px-4 py-10">
                <div className="flex items-center justify-between">
                    <h3 className="font-lufga font-medium text-xl text-black" >Premium Plan</h3>
                    <Badge className="text-sm text-white font-lufga font-medium bg-black rounded-full"><CrownSVG /> Premium</Badge>
                </div>
                <p className="font-lufga font-normal text-sm text-black/50">Buyer FreeBuyer Free Buyer Free Buyer Free</p>
                <h1 className="font-lufga font-medium text-4xl text-black">0$<span className="font-lufga font-medium text-base">/limited</span></h1>
                <div className="flex flex-col md:flex-row justify-between items-end">
                    <ul>
                        {
                            Array(4).fill().map((_, index) => {
                                return (
                                    <li key={index} className="font-lufga font-normal text-xs text-black/80 flex items-center gap-2.5"><CricleCheckSVG /> Free with all basic options</li>
                                )
                            })
                        }
                    </ul>
                    <Button className="bg-black py-[21px] px-4 rounded-[62px] text-base font-sora  font-medium text-white w-full max-w-[318px]  hover:bg-[#C6FE1F]">Premium Plan</Button>
                </div>
            </div>
        </div>
    )
}

export default Packages
