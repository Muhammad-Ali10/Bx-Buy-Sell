import React, { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Monthly data
const monthlyRevenue = [
    { day: "Wed 01", revenue: 1000 },
    { day: "Thu 02", revenue: 1500 },
    { day: "Fri 03", revenue: 3000 },
    { day: "Sat 04", revenue: 2500 },
    { day: "Sun 05", revenue: 4000 },
    { day: "Mon 06", revenue: 2800 },
    { day: "Tue 07", revenue: 3500 },
    { day: "Wed 08", revenue: 2200 },
    { day: "Thu 09", revenue: 2700 },
    { day: "Fri 10", revenue: 3200 },
    { day: "Sat 11", revenue: 2900 },
    { day: "Sun 12", revenue: 3700 },
    { day: "Mon 13", revenue: 4100 },
    { day: "Tue 14", revenue: 3000 },
    { day: "Wed 15", revenue: 4500 },
    { day: "Thu 16", revenue: 3900 },
    { day: "Fri 17", revenue: 4200 },
    { day: "Sat 18", revenue: 4600 },
    { day: "Sun 19", revenue: 3300 },
    { day: "Mon 20", revenue: 3700 },
    { day: "Tue 21", revenue: 4100 },
    { day: "Wed 22", revenue: 4400 },
    { day: "Thu 23", revenue: 3900 },
    { day: "Fri 24", revenue: 4800 },
    { day: "Sat 25", revenue: 4500 },
    { day: "Sun 26", revenue: 4200 },
    { day: "Mon 27", revenue: 4000 },
    { day: "Tue 28", revenue: 4300 },
    { day: "Wed 29", revenue: 3900 },
    { day: "Thu 30", revenue: 4700 },
    { day: "Fri 31", revenue: 5000 },
];

// Yearly data
const yearlyRevenue = [
    { month: "Jan", revenue: 15000 },
    { month: "Feb", revenue: 18000 },
    { month: "Mar", revenue: 22000 },
    { month: "Apr", revenue: 17000 },
    { month: "May", revenue: 25000 },
    { month: "Jun", revenue: 30000 },
    { month: "Jul", revenue: 28000 },
    { month: "Aug", revenue: 32000 },
    { month: "Sep", revenue: 27000 },
    { month: "Oct", revenue: 35000 },
    { month: "Nov", revenue: 31000 },
    { month: "Dec", revenue: 40000 },
];

const RevenueChart = () => {
    const [period, setPeriod] = useState("Monthly");

    const chartData = period === "Monthly" ? monthlyRevenue : yearlyRevenue;

    return (
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 w-full">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold font-abeezee text-gray-800">Revenue</h2>
                    <h3 className="text-2xl font-bold text-black">2,129,585</h3>
                </div>
                <div className="flex gap-3 items-center">
                    <span className="text-green-600 text-sm font-semibold">15% ↑</span>
                    <span className="text-gray-500 text-xs">Over All Profit</span>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[120px]">
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

            <ResponsiveContainer width="100%" height={320}>
                <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#C6FE1F" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#C6FE1F" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                        dataKey={period === "Monthly" ? "day" : "month"}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis hide />
                    <Tooltip />

                    {/* Solid Line with Gradient */}
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#C6FE1F"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#C6FE1F" }}
                        fill="url(#colorRevenue)"
                    />

                    {/* Dashed Forecast Style Line */}
                    <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#C6FE1F"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RevenueChart;
