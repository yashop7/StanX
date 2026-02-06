import { useEffect, useRef } from 'react';
import { createChart, IChartApi, LineData, Time, LineSeries } from 'lightweight-charts';

interface TradingChartProps {
  data: { time: number; value: number }[];
  height?: number;
}

export const TradingChart = ({ data, height = 400 }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#737373',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#E5E5E5', style: 1 },
        horzLines: { color: '#E5E5E5', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          labelBackgroundColor: '#18181B',
        },
        horzLine: {
          labelBackgroundColor: '#18181B',
        },
      },
      timeScale: {
        borderColor: '#E5E5E5',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#E5E5E5',
      },
    });

    chartRef.current = chart;

    // Add line series
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#22C55E',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceFormat: {
        type: 'percent',
      },
    });

    // Convert data to lightweight-charts format
    const chartData: LineData[] = data.map(point => ({
      time: Math.floor(point.time / 1000) as Time,
      value: point.value * 100, // Convert to percentage
    }));

    lineSeries.setData(chartData);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height]);

  return (
    <div className="w-full">
      <div ref={chartContainerRef} className="rounded-lg" />
    </div>
  );
};
