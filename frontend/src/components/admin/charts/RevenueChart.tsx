import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";

const data = [
  { date: "01", revenue: 150000, profit: 120000 },
  { date: "03", revenue: 180000, profit: 145000 },
  { date: "06", revenue: 220000, profit: 175000 },
  { date: "09", revenue: 195000, profit: 160000 },
  { date: "12", revenue: 240000, profit: 190000 },
  { date: "15", revenue: 210000, profit: 170000 },
  { date: "18", revenue: 280000, profit: 225000 },
  { date: "21", revenue: 250000, profit: 200000 },
  { date: "24", revenue: 230000, profit: 185000 },
  { date: "27", revenue: 260000, profit: 210000 },
  { date: "30", revenue: 275000, profit: 220000 },
];

export const RevenueChart = () => {
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  
  return (
    <Card className="col-span-full shadow-lg border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Revenue</h3>
          <p className="text-3xl sm:text-4xl font-bold text-foreground">{totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-accent flex items-center gap-1 font-medium">
              15% <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <span className="text-muted-foreground">Over All Profit</span>
          </div>
        </div>
        <Select defaultValue="monthly">
          <SelectTrigger className="w-28 h-9 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <ChartContainer
            config={{
              revenue: {
                label: "Revenue",
                color: "hsl(var(--accent))",
              },
              profit: {
                label: "Profit",
                color: "#FFD700",
              },
            }}
            className="h-[300px] sm:h-[350px] w-full min-w-[400px]"
          >
            <AreaChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "5 5" }}
              />
              <Area 
                type="monotone" 
                dataKey="profit" 
                stroke="#FFD700" 
                strokeDasharray="4 4" 
                fill="url(#colorProfit)" 
                strokeWidth={2} 
                fillOpacity={0.6}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--accent))" 
                fill="url(#colorRevenue)" 
                strokeWidth={2}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
