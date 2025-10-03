"use client"
import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Edit1SVG, CountSVG, DeleteSVG } from "@/svg"
import { useFetchWord } from "@/hooks/word"
import { Skeleton } from "@/components/ui/skeleton"
import { useAddWord, useUpdateWord, useDeleteWord } from "@/hooks/word"
import { toast } from "sonner"

const DetectWord = () => {
    const { data, isLoading, error } = useFetchWord()

    const { mutate: deleteWord, isLoading: deleteLoading, error: deleteError } = useDeleteWord()
    const { mutate: addWord } = useAddWord()
    const { mutate: updateWord } = useUpdateWord()
    const [word, setWord] = useState('')


    const handleDelete = (id) => {
        deleteWord(id, {
            onSuccess: () => {
                console.log('Word deleted successfully');
            },
            onError: (error) => {
                console.error('Error deleting word:', error);
            },
        });
    }

    const handleChange = (e) => {
        const value = e.target.value;
        setWord(value);
    }

    const handleSubmit = () => {
        if (word === "") return toast.error("Please enter a word")

        const Words = {
            word: word,
        }
        addWord(Words, {
            onSuccess: () => {
                toast.success("Word Add successfully")
                setWord('')
            },
            onError: (err) => {
                toast.error(
                    `Creation failed: ${err.response?.data?.message || err.message}`
                )
            },
        })
    }




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

            {/* Input + Add Word */}
            <div className="flex flex-row items-center justify-between w-full max-w-[1095px]">
                <Input
                    type="text"
                    placeholder="Type a word here"
                    className="w-full max-w-[765px] bg-[#F8FAFC] rounded-lg py-5 px-14 border border-[#C6FE1F] shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-[#6C6C6C] h-full"
                    onChange={handleChange}
                    value={word}
                    required
                />
                <Button onClick={handleSubmit} className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                    <Plus /> Add New Word
                </Button>
            </div>

            {/* Word List */}
            <div className="flex flex-row flex-wrap gap-3">
                {isLoading ? (
                    // Skeleton placeholders
                    Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex flex-row items-center justify-center gap-2.5 bg-[#F8FAFC] p-4 rounded-[69px]"
                        >
                            <Skeleton className="h-14 w-32 rounded-lg" />
                        </div>
                    ))
                ) : (
                    data?.map((item, index) => (
                        <div
                            className="flex flex-row items-center justify-center gap-2.5 bg-[#F8FAFC] p-4 rounded-[69px]"
                            key={index}
                        >
                            <h3 className="font-lufga font-medium text-base text-black">
                                {item.word}
                            </h3>
                            {/* Edit */}
                            <Button className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                                <Edit1SVG />
                            </Button>
                            {/* Count */}
                            <Button className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                                <CountSVG />
                            </Button>
                            {/* Delete */}
                            <Button onClick={() => handleDelete(item.id)} disabled={deleteLoading} className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                                <DeleteSVG />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default DetectWord
