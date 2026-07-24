import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const data = Array.from({ length: 30 }, (_, i) => ({
  day: String(i + 1).padStart(2, '0'),
  listings: Math.floor(Math.random() * 3000) + 3000,
}));

export const ListingsOverviewChart = () => {
  return (
    <Card className="col-span-full shadow-lg border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <h3 className="text-lg font-semibold text-foreground">Listings Overview</h3>
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
            className="h-[280px] sm:h-[320px] w-full min-w-[600px]"
          >
            <BarChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="day" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={45}
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ fill: "hsl(var(--accent) / 0.1)" }}
              />
              <Bar 
                dataKey="listings" 
                fill="hsl(var(--accent))" 
                radius={[4, 4, 0, 0]}
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
