import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";

import { formatNumber } from "@/lib/formatNumber";
interface RevenuePoint {
  label: string;
  revenue: number;
}


export const RevenueChart = ({
  data = [],
  changePercent = null,
}: {
  data?: RevenuePoint[];
  /** Real change against the previous period; null when there is nothing to compare. */
  changePercent?: number | null;
}) => {
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  
  return (
    <Card className="col-span-full shadow-lg border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Revenue</h3>
          <p className="text-3xl sm:text-4xl font-bold text-foreground">{formatNumber(totalRevenue)}</p>
          {/* This read a hardcoded "15%" next to a real revenue figure, which
              is the kind of invented number that makes a dashboard untrustworthy.
              Nothing is shown when there is no period to compare against. */}
          {changePercent !== null && changePercent !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`flex items-center gap-1 font-medium ${
                  changePercent >= 0 ? "text-accent" : "text-destructive"
                }`}
              >
                {changePercent > 0 ? "+" : changePercent < 0 ? "−" : ""}
                {Math.abs(changePercent)}%
                <TrendingUp className={`w-3.5 h-3.5 ${changePercent < 0 ? "rotate-180" : ""}`} />
              </span>
              <span className="text-muted-foreground">vs the previous 30 days</span>
            </div>
          )}
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
                dataKey="label" 
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
                // Thousands only once the numbers are in the thousands. Dividing
                // everything by 1000 turned a chart of ones and twos into five
                // rows all reading "0k".
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value)
                }
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "5 5" }}
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
