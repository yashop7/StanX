"use client";

import { useState, useEffect, useRef } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeLeft(target: Date) {
  const diff = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  return {
    days: Math.floor(diff / 86_400),
    hours: Math.floor((diff % 86_400) / 3_600),
    minutes: Math.floor((diff % 3_600) / 60),
    seconds: diff % 60,
    total: diff,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ── RollingNum ────────────────────────────────────────────────────────────────
// Inline number that smoothly rolls upward when its value changes.

function RollingNum({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [curr, setCurr] = useState(value);
  const [prev, setPrev] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (value === curr) return;
    clearTimeout(timer.current);
    // This local animation state intentionally updates in sequence when digits change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrev(curr);
    setCurr(value);
    timer.current = setTimeout(() => setPrev(null), 240);
    return () => clearTimeout(timer.current);
  }, [value, curr]);

  return (
    <span
      className={`relative inline-block overflow-hidden align-bottom ${className ?? ""}`}
      style={{ minWidth: `${curr.length}ch` }}
    >
      {prev !== null && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: "mc-roll-out 0.18s ease-in forwards",
            pointerEvents: "none",
          }}
        >
          {prev}
        </span>
      )}
      <span
        style={
          prev !== null
            ? {
                animation: "mc-roll-in 0.22s ease-out forwards",
                opacity: 0,
                display: "block",
              }
            : { display: "block" }
        }
      >
        {curr}
      </span>
    </span>
  );
}

// ── Shared props ──────────────────────────────────────────────────────────────

interface MarketCountdownProps {
  targetDate: Date;
  isSettled?: boolean;
}

// ── Inline variant (original) ─────────────────────────────────────────────────
// Renders as a plain inline text fragment.

export function MarketCountdown({
  targetDate,
  isSettled,
}: MarketCountdownProps) {
  const [time, setTime] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    if (isSettled) return;
    const id = setInterval(() => setTime(getTimeLeft(targetDate)), 1_000);
    return () => clearInterval(id);
  }, [targetDate, isSettled]);

  if (isSettled) {
    return <span className="text-emerald-400 font-medium">Settled</span>;
  }

  if (time.total === 0) {
    return (
      <span className="text-amber-400 font-medium">Awaiting settlement</span>
    );
  }

  const urgent = time.total < 3_600;

  return (
    <span
      className={`font-mono font-medium tabular-nums ${urgent ? "text-red-400" : "text-foreground/80"}`}
    >
      {time.days > 0 && (
        <>
          <RollingNum value={String(time.days)} />
          <span className="text-muted-foreground/50 text-[0.8em]">d </span>
        </>
      )}
      {(time.days > 0 || time.hours > 0) && (
        <>
          <RollingNum value={pad2(time.hours)} />
          <span className="text-muted-foreground/50 text-[0.8em]">h </span>
        </>
      )}
      <RollingNum value={pad2(time.minutes)} />
      <span className="text-muted-foreground/50 text-[0.8em]">m </span>
      <RollingNum value={pad2(time.seconds)} />
      <span className="text-muted-foreground/50 text-[0.8em]">s</span>
    </span>
  );
}

// ── Block variant (new) ───────────────────────────────────────────────────────
// Shows each time unit as a minimal segmented chip with a rolling digit and
// a label underneath. Designed for the market header's dedicated deadline row.

export function MarketCountdownBlocks({
  targetDate,
  isSettled,
}: MarketCountdownProps) {
  const [time, setTime] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    if (isSettled) return;
    const id = setInterval(() => setTime(getTimeLeft(targetDate)), 1_000);
    return () => clearInterval(id);
  }, [targetDate, isSettled]);

  if (isSettled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        Settled
      </span>
    );
  }

  if (time.total === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Awaiting settlement
      </span>
    );
  }

  const urgent = time.total < 3_600; // < 1 hour

  type Segment = { value: string; label: string };
  const segments: Segment[] = [
    ...(time.days > 0
      ? [{ value: String(time.days).padStart(2, "0"), label: "DAY" }]
      : []),
    { value: pad2(time.hours), label: "HR" },
    { value: pad2(time.minutes), label: "MIN" },
    { value: pad2(time.seconds), label: "SEC" },
  ];

  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5 sm:flex-nowrap sm:justify-end">
      {segments.map(({ value, label }, i) => (
        <div key={label} className="flex flex-col items-center gap-[3px]">
          {/* Separator dot between segments (not after last) */}
          <div className="relative flex items-center">
            <div
              className={[
                "flex h-[1.75rem] min-w-[2rem] items-center justify-center rounded-md border px-1.5",
                "font-mono text-[13px] font-semibold tabular-nums tracking-tight",
                urgent
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-muted/25 dark:bg-muted/10 border-border/20 dark:border-border/[0.12] text-foreground/75",
              ].join(" ")}
            >
              <RollingNum value={value} />
            </div>
            {i < segments.length - 1 && (
              <span
                className={`absolute -right-[5px] text-[10px] font-bold leading-none select-none ${urgent ? "text-red-400/40" : "text-muted-foreground/25"}`}
              >
                :
              </span>
            )}
          </div>
          <span className="text-[8px] font-medium text-muted-foreground/35 uppercase tracking-[0.12em] leading-none">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
