import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const data = [
  { day: "01", visitors: 2000 },
  { day: "03", visitors: 2500 },
  { day: "06", visitors: 3500 },
  { day: "09", visitors: 4500 },
  { day: "12", visitors: 3800 },
  { day: "15", visitors: 5500 },
  { day: "18", visitors: 4200 },
  { day: "21", visitors: 4800 },
  { day: "24", visitors: 3900 },
  { day: "27", visitors: 4100 },
  { day: "30", visitors: 3200 },
];

export const VisitorsChart = () => {
  return (
    <Card className="shadow-lg border-border">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
        <h3 className="text-lg font-semibold text-foreground">Visitors</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select defaultValue="monthly">
            <SelectTrigger className="w-full sm:w-28 h-9 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="device">
            <SelectTrigger className="w-full sm:w-28 h-9 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="device">Device</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <ChartContainer
            config={{
              visitors: {
                label: "Visitors",
                color: "hsl(var(--accent))",
              },
            }}
            className="h-[300px] sm:h-[350px] w-full min-w-[400px]"
          >
            <AreaChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="day" 
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
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "5 5" }}
              />
              <Area 
                type="monotone" 
                dataKey="visitors" 
                stroke="hsl(var(--accent))" 
                fill="url(#colorVisitors)" 
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
