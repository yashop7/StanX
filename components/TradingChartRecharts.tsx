'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { format } from 'date-fns';

interface TradingChartRechartsProps {
  data: { time: number; value: number }[];
}

type TimePeriod = '1H' | '6H' | '1D' | '1W' | '1M' | '3M' | 'ALL';

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border/30 dark:border-border/20 bg-background dark:bg-[hsl(240,6%,8%)] p-3 shadow-lg">
        <div className="text-sm font-semibold mb-1">
          {format(new Date(label), 'MMM dd, yyyy HH:mm')}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">Price:</span>
          <span className="font-semibold">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export const TradingChartRecharts = ({ data }: TradingChartRechartsProps) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1D');

  // Filter data based on time period
  const getFilteredData = () => {
    const now = Date.now();
    const periods: Record<TimePeriod, number> = {
      '1H': 60 * 60 * 1000,
      '6H': 6 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    };

    const cutoff = now - periods[timePeriod];
    return data
      .filter(d => d.time >= cutoff)
      .map(d => ({
        time: d.time,
        value: d.value * 100,
      }));
  };

  const chartData = getFilteredData();
  const currentValue = chartData[chartData.length - 1]?.value || 0;
  const previousValue = chartData[0]?.value || 0;
  const change = currentValue - previousValue;
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

  return (
    <Card className="panel-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-2xl font-bold">Price History</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl font-bold">{currentValue.toFixed(1)}%</span>
              <span className={`text-sm font-medium ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}% ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList className="bg-muted/20 dark:bg-muted/10 border border-border/20 dark:border-border/10">
              <TabsTrigger value="1H" className="text-xs px-3">1H</TabsTrigger>
              <TabsTrigger value="6H" className="text-xs px-3">6H</TabsTrigger>
              <TabsTrigger value="1D" className="text-xs px-3">1D</TabsTrigger>
              <TabsTrigger value="1W" className="text-xs px-3">1W</TabsTrigger>
              <TabsTrigger value="1M" className="text-xs px-3">1M</TabsTrigger>
              <TabsTrigger value="3M" className="text-xs px-3">3M</TabsTrigger>
              <TabsTrigger value="ALL" className="text-xs px-3">ALL</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
