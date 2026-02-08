'use client';

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  data: number[];
  positive?: boolean;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

export const Sparkline = ({ 
  data, 
  positive = true, 
  height = 32,
  strokeWidth = 1.5,
  className = ''
}: SparklineProps) => {
  const chartData = useMemo(() => 
    data.map((value, index) => ({ index, value })),
    [data]
  );

  const color = positive 
    ? 'hsl(142, 76%, 46%)' 
    : 'hsl(0, 72%, 55%)';

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const padding = (maxValue - minValue) * 0.1 || 1;

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis 
            domain={[minValue - padding, maxValue + padding]} 
            hide 
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Generate mock sparkline data
export const generateSparklineData = (baseValue: number, volatility: number = 0.05, points: number = 20): number[] => {
  const data: number[] = [baseValue];
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    const newValue = Math.max(0.01, Math.min(0.99, data[i - 1] + change));
    data.push(newValue);
  }
  return data;
};
