"use client"
import React, { useState } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts"

const monthlyData = [
  { day: "01", visitors: 1000 },
  { day: "03", visitors: 2500 },
  { day: "06", visitors: 1800 },
  { day: "09", visitors: 4200 },
  { day: "12", visitors: 2800 },
  { day: "15", visitors: 6000 },
  { day: "18", visitors: 7000 },
  { day: "21", visitors: 3500 },
  { day: "24", visitors: 4800 },
  { day: "27", visitors: 4000 },
  { day: "30", visitors: 2000 }
]

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

const VisitorsStatistics = () => {
  const [period, setPeriod] = useState("Monthly")

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
        <h2 className="text-lg font-semibold font-abeezee text-gray-800">Visitors</h2>
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
        <ResponsiveContainer width="100%" height={370}>
          <AreaChart data={chartData} >
            <defs>
              <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D6FF00" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#D6FF00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="9 9" vertical={false} />
            <XAxis
              dataKey={period === "Monthly" ? "day" : "month"}
              axisLine={false}
              height={50}
              tickLine={false}
              tick={{ dy: 20 }}
            />
            <YAxis
              tickFormatter={(value) => `${value / 1000}k`}
              ticks={yAxisTicks}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="visitors"
              stroke="#D6FF00"
              fillOpacity={1}
              fill="url(#colorVisitors)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default VisitorsStatistics
