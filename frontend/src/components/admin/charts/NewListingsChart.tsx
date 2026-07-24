import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const data = [
  { day: "01", listings: 4000 },
  { day: "03", listings: 5500 },
  { day: "06", listings: 6000 },
  { day: "09", listings: 7000 },
  { day: "12", listings: 6500 },
  { day: "15", listings: 7200 },
  { day: "18", listings: 6800 },
];

export const NewListingsChart = () => {
  return (
    <Card className="shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <h3 className="text-lg font-semibold text-foreground">New Listings</h3>
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
              listings: {
                label: "Listings",
                color: "hsl(var(--accent))",
              },
            }}
            className="h-[300px] sm:h-[350px] w-full min-w-[400px]"
          >
            <BarChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
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
                width={45}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ fill: "hsl(var(--accent) / 0.1)" }}
              />
              <Bar 
                dataKey="listings" 
                fill="hsl(var(--accent))" 
                radius={[6, 6, 0, 0]}
                stroke="hsl(var(--accent))"
                strokeWidth={0}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
