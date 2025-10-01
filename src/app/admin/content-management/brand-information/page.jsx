"use client"
import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import AddBrandInformation from "@/components/admin/add-brandinfo"
import { useGetAdminQuestion, useDeleteAdminQuestion } from "@/hooks/adminQuestions"



const BrandInformation = () => {


    const [brandInfo, setBrandInfo] = useState([])
    const { data, isPending, error } = useGetAdminQuestion("BRAND")
    const { mutate: deleteBrandInfo, isPending: deleteBrandInfoPending, isSuccess: deleteBrandInfoSuccess, isError: deleteBrandInfoError, error: deleteBrandInfoErrorObj } = useDeleteAdminQuestion();

    useEffect(() => {
        if (data) {
            setBrandInfo(data)
        }
    }, [data])


    const handleDelete = (id) => {
        deleteBrandInfo(id,
            {
                onSuccess: () => {
                    console.log("Brand Info deleted successfully");
                },
                onError: (err) => {
                    console.log("Error deleting Brand Info");
                },
            })
    }

    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-row items-center justify-between">
                {/* Search Box */}
                <h3 className="font-lufga font-medium text-2xl text-black">Added Statistic Questions </h3>
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
                                Added Statistic Questions
                            </DialogTitle>
                        </DialogHeader>
                        <div className="px-6 pb-6 h-full">
                            <AddBrandInformation mode="create" />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <h3 className="font-lufga font-medium text-2xl text-black" >Added Categories</h3>
                <div className="flex flex-row items-center justify-between gap-2.5 flex-wrap" >
                    {isPending && <div className="bg-white border border-black/10  items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full">

                        <Skeleton className="h-5 w-32 rounded-md" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-9 w-20 rounded-full" />
                            <Skeleton className="h-9 w-20 rounded-full" />
                        </div>
                    </div>}
                    {brandInfo?.map((item, index) => (
                        <div className="bg-white border border-black/10  items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full" key={index}>
                            <h3 className="font-lufga font-medium text-base text-center text-black">{item.question}</h3>
                            <div className="flex items-center gap-4">
                                <Dialog className="w-full ">
                                    <DialogTrigger asChild>
                                        <Button className="bg-[#C6FE1F] hover:bg-[#C6FE1F] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-black cursor-pointer">Edit</Button>
                                    </DialogTrigger>
                                    <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                                        <DialogHeader className="px-6 pt-6 pb-2">
                                            <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                                Update Statistic Questions
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="px-6 pb-6 h-full">
                                            <AddBrandInformation mode="edit" question={item.question} id={item.id} />
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <Button className="bg-[#FF2022] hover:bg-[#FF2022] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-white cursor-pointer" onClick={() => handleDelete(item.id)}>Delete</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default BrandInformation
