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
import { Skeleton } from "@/components/ui/skeleton"
import AddHandOverQuestion from "@/components/admin/add-handovers-question"
import { useGetAdminQuestion, useDeleteAdminQuestion } from "@/hooks/adminQuestions"

const Handovers = () => {
    const { data, isPending, error } = useGetAdminQuestion("HANDOVER")

    const { mutate: DeleteAdminQuestions, isPending: DeletePending } = useDeleteAdminQuestion()
    
    const handleDelete = (id) => {

        DeleteAdminQuestions(id, {
            onSuccess: () => {
                console.log("HandOver Question deleted successfully")
            },
            onError: (err) => {
                console.log("Error deleting Statistic Question", err)
            },
        })
    }

    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-row items-center justify-between">
                {/* Heading */}
                <h3 className="font-lufga font-medium text-2xl text-black">
                    Added Handovers Questions
                </h3>

                {/* Add New Question Button */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                            Add New Question
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                Handovers Questions
                            </DialogTitle>
                        </DialogHeader>
                        <div className="px-6 pb-6 h-full">
                            <AddHandOverQuestion />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Questions List */}
            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <h3 className="font-lufga font-medium text-2xl text-black">
                    Added Questions
                </h3>

                <div className="flex flex-row items-center justify-between flex-wrap">
                    <div className="flex flex-row items-center justify-between gap-2.5 flex-wrap w-full">
                        {/* Loading State */}
                        {isPending && (
                            <div className="bg-white border border-black/10 items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full">
                                <Skeleton className="h-5 w-32 rounded-md" />
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-9 w-20 rounded-full" />
                                    <Skeleton className="h-9 w-20 rounded-full" />
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {error && (
                            <p className="text-red-500 font-medium">
                                Failed to load questions
                            </p>
                        )}

                        {/* Data */}
                        {data?.map((item, index) => (
                            <div
                                className="bg-white border border-black/10 items-start justify-center rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full"
                                key={index}
                            >
                                <h3 className="font-lufga font-medium text-base text-center text-black">
                                    {item.question}
                                </h3>
                                <div className="flex items-center gap-4">
                                    {/* Edit Button (future) */}
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button className="bg-[#C6FE1F] hover:bg-[#C6FE1F] py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-black cursor-pointer">
                                                Edit
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                                            <DialogHeader className="px-6 pt-6 pb-2">
                                                <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                                    Update Handover Question
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="px-6 pb-6 h-full">
                                                <AddHandOverQuestion mode="edit" question={item.question} id={item.id} />
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    {/* Delete Button */}
                                    <Button
                                        className="bg-[#FF2022] hover:bg-[#FF2022]/80 py-2.5 px-8 rounded-[80px] text-xs font-medium font-outfit text-white cursor-pointer"
                                        onClick={() => handleDelete(item.id)}
                                        disabled={DeletePending}
                                    >
                                        {DeletePending ? "Deleting..." : "Delete"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Handovers
 