import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface ResourceGraphProps {
  title: string;
  data: Array<{
    timestamp: string;
    value: number;
  }>;
  unit: string;
  color: string;
}

export const ResourceGraph: React.FC<ResourceGraphProps> = ({
  title,
  data,
  unit,
  color,
}) => {
  return (
    <Card className="w-full">
      <CardHeader className="py-2 px-4 border-b">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-2">
        <div className="h-[200px]">
          <ChartContainer config={{}} className="h-full w-full">
            <LineChart
              data={data}
              margin={{ top: 0, bottom: 0, right: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                fontSize={12}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}${unit}`}
                fontSize={12}
              />
              <Tooltip
                labelFormatter={(label) => new Date(label).toLocaleString()}
                formatter={(value: number) => [`${value}${unit}`, title]}
                content={<ChartTooltipContent />}
              />
              {/* <ChartTooltipContent
              /> */}
              <Line
                type="monotone"
                dataKey="value"
                fill={color}
                color={color}
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
