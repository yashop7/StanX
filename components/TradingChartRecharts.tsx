"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, TooltipProps,
} from "recharts";
import { format } from "date-fns";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { fetchMarketPrices, BACKEND_PRICE_SCALE } from "@/lib/api/backend";
import type { PricePeriod } from "@/lib/api/backend";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradingChartRechartsProps {
  marketId: number;
  token?: "yes" | "no";
  /** Total USDC volume to display in the footer */
  volume?: number;
}

interface Point { time: number; value: number }

// ── Module-level price cache ───────────────────────────────────────────────────
// Shared across all chart instances. Prevents duplicate network requests when
// multiple charts render for the same market, and avoids re-fetching when the
// user switches between periods they've already seen.

const TTL: Record<PricePeriod, number> = {
  "1H":  30_000,       // 30 s — short periods change fast
  "6H":  60_000,       // 1 min
  "1D":  60_000,       // 1 min
  "1W":  120_000,      // 2 min
  "1M":  300_000,      // 5 min
  "3M":  300_000,      // 5 min
  "ALL": 300_000,      // 5 min
};

interface CacheEntry { points: Point[]; hasReal: boolean; ts: number }
const priceCache = new Map<string, CacheEntry>();

function cacheKey(marketId: number, token: string, period: PricePeriod) {
  return `${marketId}:${token}:${period}`;
}

function fromCache(key: string, period: PricePeriod): CacheEntry | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL[period]) { priceCache.delete(key); return null; }
  return entry;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: PricePeriod[] = ["1H", "6H", "1D", "1W", "1M", "3M", "ALL"];
const DEBOUNCE_MS = 200;

// Flat 50¢ baseline shown when there is no real history
function flat50(): Point[] {
  const now = Date.now();
  return [
    { time: now - 7 * 86_400_000, value: 50 },
    { time: now,                   value: 50 },
  ];
}

function formatVolume(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ── X-axis label formatter ────────────────────────────────────────────────────

function fmtX(ts: number, period: PricePeriod): string {
  const d = new Date(ts);
  if (period === "1H")                         return format(d, "HH:mm");
  if (period === "6H" || period === "1D")      return format(d, "HH:mm");
  if (period === "1W")                         return format(d, "MMM d");
  return format(d, "MMM d");
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const d   = new Date(label as number);
  if (isNaN(d.getTime())) return null;
  return (
    <div className="bg-[#0d0d0f]/95 border border-white/10 rounded-lg px-3 py-2.5 shadow-2xl backdrop-blur-sm">
      <p className="text-[10px] text-white/35 font-mono mb-1 uppercase tracking-wider">
        {format(d, "MMM d, yyyy")}
        <span className="ml-1.5 text-white/20">·</span>
        <span className="ml-1.5">{format(d, "HH:mm")}</span>
      </p>
      <p className="text-[1.1rem] font-bold text-white tabular-nums leading-none">
        {val.toFixed(1)}
        <span className="text-sm font-normal text-white/40 ml-0.5">¢</span>
      </p>
    </div>
  );
};

// ── Glowing dot at the last data point ───────────────────────────────────────

function makeDotRenderer(dataLen: number, color: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function TradeDot(props: any) {
    const { cx, cy, index } = props;
    const isLast = index === dataLen - 1;

    if (isLast) {
      // Glowing live-price dot at the last (current) point
      return (
        <g key={`dot-last-${index}`}>
          <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.12} />
          <circle cx={cx} cy={cy} r={6}  fill={color} fillOpacity={0.28} />
          <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#0d0d0f" strokeWidth={1.5} />
        </g>
      );
    }

    // Regular dot at each intermediate trade point
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={3} fill="#0d0d0f" stroke={color} strokeWidth={1.5} />
      </g>
    );
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TradingChartRecharts = ({
  marketId,
  token = "yes",
  volume,
}: TradingChartRechartsProps) => {
  const [period,      setPeriod]      = useState<PricePeriod>("ALL");
  const [chartData,   setChartData]   = useState<Point[]>([]);
  const [hasRealData, setHasRealData] = useState(false);
  const [isLoading,   setIsLoading]   = useState(true);
  // Holds the debounce timer so we can cancel it when the period changes again
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the current load is still relevant (cancelled if period changed)
  const loadIdRef    = useRef(0);

  const parsePoints = useCallback((raw: { t: number; p: string }[]): { pts: Point[]; hasReal: boolean } => {
    if (raw.length >= 2) {
      return {
        pts: raw.map(pt => ({ time: pt.t, value: parseFloat(pt.p) / BACKEND_PRICE_SCALE })),
        hasReal: true,
      };
    }
    if (raw.length === 1) {
      const val = parseFloat(raw[0].p) / BACKEND_PRICE_SCALE;
      return { pts: [{ time: raw[0].t, value: val }, { time: Date.now(), value: val }], hasReal: true };
    }
    return { pts: flat50(), hasReal: false };
  }, []);

  const loadPrices = useCallback((p: PricePeriod) => {
    // Cancel any pending debounce from a previous rapid-click
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Serve from cache immediately (no loading flash, no network call)
    const key     = cacheKey(marketId, token, p);
    const cached  = fromCache(key, p);
    if (cached) {
      setChartData(cached.points);
      setHasRealData(cached.hasReal);
      setIsLoading(false);
      return;
    }

    // Show loading state while the debounce is pending
    setChartData([]);
    setHasRealData(false);
    setIsLoading(true);

    // Debounce: only fire after the user stops clicking for DEBOUNCE_MS
    const myId = ++loadIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const raw = await fetchMarketPrices(marketId, token, p);
        // Stale-check: if another load started after this one, discard result
        if (loadIdRef.current !== myId) return;
        const { pts, hasReal } = parsePoints(raw);
        priceCache.set(key, { points: pts, hasReal, ts: Date.now() });
        setChartData(pts);
        setHasRealData(hasReal);
      } catch {
        if (loadIdRef.current !== myId) return;
        const { pts } = parsePoints([]);
        setChartData(pts);
        setHasRealData(false);
      } finally {
        if (loadIdRef.current === myId) setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }, [marketId, token, parsePoints]);

  useEffect(() => {
    loadPrices(period);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, marketId, token]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const current    = hasRealData ? (chartData[chartData.length - 1]?.value ?? 50) : 50;
  const first      = hasRealData ? (chartData[0]?.value ?? 50) : 50;
  const change     = hasRealData ? current - first : 0;
  const changePct  = hasRealData && first > 0 ? (change / first) * 100 : 0;
  const isUp       = change >= 0;

  const lineColor  = !hasRealData
    ? "rgba(255,255,255,0.15)"
    : isUp ? "#22c55e" : "#ef4444";

  const gradId = `pg-${marketId}-${token}`;

  // Y domain: padded so the line isn't flush against edges
  const yDomain = useMemo((): [number, number] => {
    if (!hasRealData) return [0, 100];
    const vals = chartData.map(d => d.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.25, 4);
    return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
  }, [chartData, hasRealData]);

  const GlowDot = useMemo(
    () => makeDotRenderer(chartData.length, lineColor),
    [chartData.length, lineColor]
  );

  return (
    <div className="panel-card min-w-0 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[2rem] font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-[2.4rem]">
                {current.toFixed(1)}
              </span>
              <span className="text-base text-muted-foreground/50 font-mono leading-none mb-0.5">¢</span>

              {/* Change badge */}
              {hasRealData && (
                  <span className={`flex items-center gap-1 text-xs font-semibold leading-none tabular-nums sm:text-sm ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp
                    ? <TrendingUp  className="h-3.5 w-3.5" />
                    : <TrendingDown className="h-3.5 w-3.5" />
                  }
                  {isUp ? "+" : ""}{change.toFixed(1)}¢
                  <span className="text-[10px] font-normal opacity-60">
                    ({isUp ? "+" : ""}{changePct.toFixed(1)}%)
                  </span>
                </span>
              )}

              {/* Baseline label */}
              {!hasRealData && !isLoading && (
                <span className="text-xs text-muted-foreground/25 font-mono">baseline · no trades yet</span>
              )}
            </div>

            {/* Sub-label */}
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.13em] text-muted-foreground/40 mt-1.5">
              {token.toUpperCase()} probability
            </p>
          </div>

          {/* Loading spinner */}
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30 mt-1 shrink-0" />
          )}
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      <div className="relative h-[240px] sm:h-[280px]">
        {/* Empty state — shown when loading completes but no data for this period */}
        {!isLoading && !hasRealData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
            <p className="text-sm text-muted-foreground/40 font-mono">No trades in this period</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity={hasRealData ? 0.18 : 0.04} />
                <stop offset="80%"  stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Dotted horizontal grid — Kalshi style */}
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="rgba(255,255,255,0.045)"
              strokeDasharray="2 5"
            />

            {/* X-axis: dates */}
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => fmtX(v, period)}
              stroke="transparent"
              tick={{
                fill: "rgba(255,255,255,0.28)",
                fontSize: 11,
                fontFamily: "monospace",
              }}
              tickLine={false}
              axisLine={false}
              minTickGap={52}
              dy={6}
            />

            {/* Y-axis: prices in ¢ — RIGHT side, like Kalshi */}
            <YAxis
              orientation="right"
              domain={yDomain}
              tickFormatter={(v: number) => `${v.toFixed(0)}`}
              stroke="transparent"
              tick={{
                fill: "rgba(255,255,255,0.28)",
                fontSize: 11,
                fontFamily: "monospace",
              }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickCount={5}
            />

            <Tooltip
              content={hasRealData ? <CustomTooltip /> : () => null}
              cursor={hasRealData
                ? { stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }
                : false
              }
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={hasRealData ? 2 : 1.5}
              strokeDasharray={hasRealData ? undefined : "6 4"}
              fill={`url(#${gradId})`}
              dot={hasRealData ? <GlowDot /> : false}
              activeDot={hasRealData
                ? { r: 4, fill: lineColor, stroke: "#0d0d0f", strokeWidth: 2 }
                : false
              }
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer: volume (left) + period selector (right) ──────────────── */}
      <div className="flex flex-col gap-3 border-t border-border/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        {/* Volume */}
        <span className="text-[11px] text-muted-foreground/35 font-mono">
          {volume != null && volume > 0
            ? <>{formatVolume(volume)} vol</>
            : <span className="text-muted-foreground/20">no volume data</span>
          }
        </span>

        {/* Period selector — pill tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/15 bg-muted/20 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`min-w-[44px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                period === p
                  ? "bg-background text-foreground shadow-sm border border-border/20"
                  : "text-muted-foreground/45 hover:text-muted-foreground/80 hover:bg-muted/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
