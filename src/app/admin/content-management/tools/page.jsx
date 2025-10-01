"use client"
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import AddTools from "@/components/admin/add-tools";
import { useTools } from "@/hooks/tools";
import { Skeleton } from "@/components/ui/skeleton";

const Tools = () => {
    const [tools, setTools] = useState([]);
    const [filterTools, setFilterTools] = useState([]);

    const { data, isPending, error } = useTools();

    useEffect(() => {
        console.log("data", data);
        if (data) {
            setTools(data);
            setFilterTools(data);
        }
    }, [data]);

    const handleSearch = (e) => {
        const value = e.target.value;
        if (value) {
            const filtered = tools.filter((tool) =>
                tool.name.toLowerCase().includes(value.toLowerCase())
            );
            setFilterTools(filtered);
        } else {
            setFilterTools(tools);
        }
    };

    if (isPending) {
        return (
            <div className="flex gap-4">
                {Array(4)
                    .fill()
                    .map((_, index) => (
                        <div
                            key={index}
                            className="bg-[#FAFAFA] rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px] items-center justify-center"
                        >
                            <Skeleton className="h-14 w-14 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                    ))}
            </div>
        );
    }

    if (error) {
        return <p className="text-red-500">Failed to load tools.</p>;
    }

    return (
        <div className="w-full flex flex-col gap-10 relative">
            <div className="flex flex-row items-center justify-between">
                {/* Search Box */}
                <div className="flex gap-2 items-center justify-center">
                    <h3 className="font-lufga font-medium text-2xl text-black">Tools</h3>
                    <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                        <Search className="text-gray-500" />
                        <Input
                            type="text"
                            placeholder="Search by name..."
                            className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                            onChange={handleSearch}
                        />
                    </div>
                </div>
                {/* Add Tool Button with Dialog */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                            Add Tool
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl w-full flex flex-col !max-w-[720px] h-full">
                        <DialogHeader className="px-6 pt-6 pb-2">
                            <DialogTitle className="text-2xl font-medium font-lufga text-black">
                                Add New Tool
                            </DialogTitle>
                        </DialogHeader>
                        <div className="px-6 pb-6 h-full">
                            <AddTools />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
                <h3 className="font-lufga font-medium text-2xl text-black">
                    Added Tools
                </h3>
                <div className="flex flex-wrap gap-4">
                    {filterTools.map((tool, index) => (
                        <div
                            key={index}
                            className="bg-[#FAFAFA] rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px] items-center justify-center"
                        >
                            <img
                                className="rounded-full"
                                src={tool?.image_path}
                                alt={tool?.name}
                                width={56}
                                height={56}
                            />
                            <h3 className="font-lufga font-medium text-base text-center text-black">
                                {tool?.name}
                            </h3>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Tools;
