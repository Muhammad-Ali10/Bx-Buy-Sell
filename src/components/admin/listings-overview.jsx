"use client"
import React, { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"


const monthlyData = [
  { day: "01", visitors: 1200 },
  { day: "02", visitors: 1800 },
  { day: "03", visitors: 2500 },
  { day: "04", visitors: 3000 },
  { day: "05", visitors: 2200 },
  { day: "06", visitors: 2800 },
  { day: "07", visitors: 3500 },
  { day: "08", visitors: 4000 },
  { day: "09", visitors: 4200 },
  { day: "10", visitors: 3100 },
  { day: "11", visitors: 2600 },
  { day: "12", visitors: 2800 },
  { day: "13", visitors: 3300 },
  { day: "14", visitors: 3600 },
  { day: "15", visitors: 6000 },
  { day: "16", visitors: 5800 },
  { day: "17", visitors: 6200 },
  { day: "18", visitors: 7000 },
  { day: "19", visitors: 6800 },
  { day: "20", visitors: 6400 },
  { day: "21", visitors: 3500 },
  { day: "22", visitors: 3700 },
  { day: "23", visitors: 3900 },
  { day: "24", visitors: 4800 },
  { day: "25", visitors: 5000 },
  { day: "26", visitors: 4600 },
  { day: "27", visitors: 4000 },
  { day: "28", visitors: 4200 },
  { day: "29", visitors: 3800 },
  { day: "30", visitors: 2000 }
];


const yearlyData = [
    { month: "Jan", visitors: 15000 },
    { month: "Feb", visitors: 18000 },
    { month: "Mar", visitors: 22000 },
    { month: "Apr", visitors: 17000 },
    { month: "May", visitors: 25000 },
    { month: "Jun", visitors: 30000 },
    { month: "Jul", visitors: 28000 },
    { month: "Aug", visitors: 32000 },
    { month: "Sep", visitors: 27000 },
    { month: "Oct", visitors: 35000 },
    { month: "Nov", visitors: 31000 },
    { month: "Dec", visitors: 40000 }
]



const ListingOverview = () => {


    const [period, setPeriod] = useState("Monthly");

    const chartData = period === "Monthly" ? monthlyData : yearlyData
    let yAxisTicks = []

    if (period === "Monthly") {
        yAxisTicks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]
    } else {
        const maxVisitors = Math.max(...yearlyData.map(item => item.visitors))
        const step = 5000
        for (let i = 0; i <= maxVisitors + step; i += step) {
            yAxisTicks.push(i)
        }
    }

    return (
        <div className="p-6 bg-[#F8FAFC] rounded-2xl shadow-sm border border-gray-100 w-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-abeezee text-gray-800">New Listings</h2>
                <div className="flex gap-3">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Select Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Yearly">Yearly</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="-ml-10">
                <ResponsiveContainer width={"100%"} height={370} >
                    <BarChart data={chartData}>
                        <XAxis dataKey={period === "Monthly" ? "day" : "month"}
                            tickLine={false}
                            axisLine={false}
                                

                        />
                        <YAxis
                            tickFormatter={(data) => `${data / 1000}k`}
                            ticks={yAxisTicks}
                            tickLine={false}
                            axisLine={false} />

                        <Bar dataKey="visitors" fill="#C6FE1F" radius={9} spacing={2} barSize={10} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

export default ListingOverview;
