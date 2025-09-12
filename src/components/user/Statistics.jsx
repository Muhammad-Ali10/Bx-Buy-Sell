"use client"
import React, { useState } from "react"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowSVG } from "@/svg"


const Statistics = () => {

    const [selectedvalue, setSelectedvalue] = useState("monthly")


    const stats = [
        {
            "title": "Total Users",
            "monthly": { "value": 18585, "percentage": 15, "isPositive": true },
            "yearly": { "value": 222000, "percentage": 180, "isPositive": true }
        },
        {
            "title": "Total Listings",
            "monthly": { "value": 102, "percentage": 12, "isPositive": true },
            "yearly": { "value": 1220, "percentage": 140, "isPositive": true }
        },
        {
            "title": "Blocked Users",
            "monthly": { "value": 89, "percentage": 5, "isPositive": false },
            "yearly": { "value": 450, "percentage": 60, "isPositive": false }
        },
        {
            "title": "Finalized Deals",
            "monthly": { "value": 102, "percentage": 10, "isPositive": true },
            "yearly": { "value": 1200, "percentage": 100, "isPositive": true }
        }
    ]

    return (
        <div className="w-full flex flex-col gap-10">
            <div className="flex flex-row items-center justify-between ">
                <h2 className="font-outfit font-medium text-[33px] leading-[30px] -tracking-tight">Traffic Statistics</h2>
                <div>
                    <Select onValueChange={(value) => setSelectedvalue(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue className="capitalize" placeholder={selectedvalue} />
                        </SelectTrigger>
                        <SelectContent className="p-0">
                            <SelectGroup>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex flex-row flex-wrap items-center justify-between">
                {stats.map((item, index) => (
                    <div key={index} className="flex flex-col items-start bg-white justify-between flex-wrap p-6 gap-4 max-w-[242px] w-full rounded-3xl">
                        <h3 className="text-sm font-normal font-abeezee text-black">{item.title}</h3>
                        <h2 className="text-xl font-bold font-lufga text-black ">{item[selectedvalue].value}</h2>
                        <div className="flex flex-row items-center justify-center gap-10">
                            <span className="flex flex-row items-center justify-center gap-2 text-sm font-normal font-abeezee text-black">15%    <ArrowSVG className=" text-green-500" /></span>
                            <span className="text-sm font-normal font-abeezee text-black capitalize">{selectedvalue}</span>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    )

}


export default Statistics