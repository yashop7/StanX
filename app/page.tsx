"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSpring, useMotionValueEvent } from "motion/react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  TrendingUp,
  Zap,
  Database,
  Lock,
  ChevronDown,
  Activity,
  Clock,
  Plus,
  Minus,
} from "lucide-react";
import { getMarketsAction } from "@/app/markets/actions";
import type { DisplayMarket } from "@/lib/blockchain/markets";
import { cn } from "@/lib/utils";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

/* ──────────────────────────────────────────────────────────────────────────
   Design tokens
   ────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#34d399"; // emerald-400 — single accent, used sparingly

const EASE = [0.22, 1, 0.36, 1] as const;

// Shared gradient text style — white with faded bottom, used on display headings
const GRAD_TEXT: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

/* ──────────────────────────────────────────────────────────────────────────
   Reveal helper — subtle, scroll-triggered fade/slide
   ────────────────────────────────────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ background: ACCENT }}
      />
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Navbar — glass blur, hamburger on mobile
   ────────────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#live", label: "Live demo" },
  { href: "#faq", label: "FAQ" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl"
          : "border-b border-transparent bg-transparent"
      )}
      style={
        scrolled ? { backdropFilter: "blur(24px) saturate(200%)" } : undefined
      }
    >
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative h-6 w-6">
            <div
              className="absolute inset-0 rounded-[7px]"
              style={{ background: ACCENT, opacity: 0.9 }}
            />
            <TrendingUp className="absolute inset-0 m-auto h-3.5 w-3.5 text-black" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white group-hover:text-white/90 transition-colors">
            Stanx
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-[13px] text-white/55 transition-colors hover:text-white group"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 rounded-full bg-white/60 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {/* Status badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/3 px-2.5 py-1 text-[11px] font-medium text-white/50">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: ACCENT }}
            />
            Live on Solana
          </div>
          <Link
            href="/markets"
            className="group relative flex h-8 items-center gap-1.5 overflow-hidden rounded-full bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-white/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            Start trading
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/[0.06] bg-black/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2.5 text-sm text-white/70 hover:bg-white/[0.04] hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/markets"
                className="mt-2 flex h-10 items-center justify-center gap-1.5 rounded-md bg-white text-sm font-medium text-black"
              >
                Start trading <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Hero — headline + real product mockup
   ────────────────────────────────────────────────────────────────────────── */

function AmbientBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Faint grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, black 20%, transparent 70%)",
        }}
      />
      {/* Primary green orb */}
      <div
        className="absolute left-1/2 top-[-15%] h-[600px] w-[800px] -translate-x-1/2 rounded-full blur-[160px] opacity-[0.18] animate-orb-float"
        style={{ background: ACCENT }}
      />

      {/* White center brighten */}
      <div className="absolute left-1/2 top-0 h-[200px] w-[600px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[100px]" />
    </div>
  );
}

function HeroMockup({ market }: { market: DisplayMarket | null }) {
  const yes = market ? Math.round(market.yesPrice * 100) : 67;
  const no = 100 - yes;
  const q =
    market?.question ??
    "Will MrBeast's next video cross 100M views in 30 days?";
  const volume = market
    ? market.volume >= 1000
      ? `$${(market.volume / 1000).toFixed(1)}K`
      : `$${market.volume.toFixed(0)}`
    : "$48.2K";

  // Fake order book depth for mockup (visual only — real one is in live demo)
  const bids = [
    { p: yes - 1, s: 412 },
    { p: yes - 2, s: 980 },
    { p: yes - 3, s: 1_240 },
    { p: yes - 5, s: 2_150 },
  ];
  const asks = [
    { p: yes + 1, s: 380 },
    { p: yes + 2, s: 870 },
    { p: yes + 3, s: 1_460 },
    { p: yes + 5, s: 2_310 },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[1020px]">
      {/* Glow behind card */}
      <div
        aria-hidden
        className="absolute inset-x-8 -bottom-8 h-28 rounded-full blur-3xl opacity-40"
        style={{ background: ACCENT }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)]"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <div className="ml-3 flex-1 truncate text-[11px] text-white/40">
            StanX / market / {market?.marketId ?? "0x42"}
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-white/70"
            style={{ background: "rgba(52, 211, 153, 0.08)" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: ACCENT }}
            />
            Live
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1.4fr_1fr]">
          {/* Left: question + chart + yes/no */}
          <div className="border-b border-white/[0.06] p-5 md:border-b-0 md:border-r md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-white/40">
                  <span>{market?.category ?? "Entertainment"}</span>
                  <span className="text-white/20">·</span>
                  <span>
                    <Clock className="mr-1 inline h-3 w-3" />
                    ends in 6d 12h
                  </span>
                </div>
                <h3 className="max-w-[460px] text-base font-semibold leading-snug text-white md:text-lg">
                  {q}
                </h3>
              </div>
            </div>

            {/* Mini chart */}
            <div className="mt-5">
              <MiniChart accent={ACCENT} yes={yes} />
            </div>

            {/* Yes / No pills */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div
                className="group relative rounded-lg border px-4 py-3 transition-colors"
                style={{
                  borderColor: "rgba(52, 211, 153, 0.25)",
                  background: "rgba(52, 211, 153, 0.06)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: ACCENT }}
                  >
                    Buy Yes
                  </span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5"
                    style={{ color: ACCENT }}
                  />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className="text-xl font-semibold tabular-nums"
                    style={{ color: ACCENT }}
                  >
                    {yes}
                  </span>
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: ACCENT, opacity: 0.8 }}
                  >
                    ¢
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-white/2 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                    Buy No
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-white/40" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-semibold tabular-nums text-white/80">
                    {no}
                  </span>
                  <span className="text-xs text-white/50 tabular-nums">¢</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between text-[11px] text-white/40">
              <span>Vol {volume}</span>
              <span>On-chain · Solana</span>
            </div>
          </div>

          {/* Right: order book */}
          <div className="p-5 md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Order book
              </span>
              <span className="text-[10px] text-white/40">Yes</span>
            </div>

            <div className="space-y-[3px]">
              {asks
                .slice()
                .reverse()
                .map((a, i) => (
                  <BookRow
                    key={`a-${i}`}
                    side="ask"
                    price={a.p}
                    size={a.s}
                    max={Math.max(...asks.map((x) => x.s))}
                  />
                ))}
              <div
                className="my-1.5 flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] font-semibold tabular-nums"
                style={{
                  borderColor: "rgba(52,211,153,0.2)",
                  background: "rgba(52,211,153,0.06)",
                }}
              >
                <span style={{ color: ACCENT }}>{yes}.0¢</span>
                <span className="text-white/40 text-[10px] font-normal">
                  Mid
                </span>
              </div>
              {bids.map((b, i) => (
                <BookRow
                  key={`b-${i}`}
                  side="bid"
                  price={b.p}
                  size={b.s}
                  max={Math.max(...bids.map((x) => x.s))}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BookRow({
  side,
  price,
  size,
  max,
}: {
  side: "bid" | "ask";
  price: number;
  size: number;
  max: number;
}) {
  const pct = Math.min(100, (size / max) * 100);
  const color = side === "bid" ? ACCENT : "rgba(255,255,255,0.7)";
  return (
    <div className="relative flex items-center justify-between overflow-hidden rounded-[5px] px-2 py-1 text-[11px] tabular-nums">
      <div
        className="absolute inset-y-0 right-0"
        style={{
          width: `${pct}%`,
          background:
            side === "bid" ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.04)",
        }}
      />
      <span className="relative z-10" style={{ color }}>
        {price.toFixed(1)}¢
      </span>
      <span className="relative z-10 text-white/50">
        {size.toLocaleString()}
      </span>
    </div>
  );
}

/* Sin-wave price curve centered on `yes`, 200 dense points — already smooth */
function buildSinPath(
  yes: number,
  W: number,
  H: number,
  top: number,
  bottom: number
): string {
  const cy = top + (H - top - bottom) / 2;
  const amp = (H - top - bottom) * 0.38;
  const n = 200;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return `${(t * W).toFixed(1)} ${(cy + amp * Math.sin(t * Math.PI * 2.5)).toFixed(1)}`;
  });
  return `M ${pts.join(" L ")}`;
}

function MiniChart({ accent, yes }: { accent: string; yes: number }) {
  const [isHovering, setIsHovering] = useState(false);
  const [cursorX, setCursorX] = useState(0);
  // Display the yes% value; sin wave is decorative so pill just shows yes
  const displayVal = yes;

  const W = 400,
    H = 84,
    TOP = 22,
    BOTTOM = 6;

  const linePath = useMemo(() => buildSinPath(yes, W, H, TOP, BOTTOM), [yes]);
  const fillPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorX(
      Math.max(0, Math.min(W, ((e.clientX - rect.left) / rect.width) * W))
    );
    setIsHovering(true);
  };

  const gradId = `mg-${yes}`;
  const clipId = `mc-${yes}`;
  const pillX = Math.max(4, Math.min(cursorX - 26, W - 52));

  return (
    <div className="w-full rounded-xl border border-white/[0.07] bg-transparent px-3 pt-3 pb-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
          Yes · 24h
        </span>
        <span
          className="font-mono text-[11px] font-semibold tabular-nums"
          style={{ color: accent }}
        >
          {yes}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 h-[76px] w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsHovering(false)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
          {/* Clip to cursor X when hovering, full width otherwise */}
          <clipPath id={clipId}>
            <rect x={0} y={0} width={isHovering ? cursorX : W} height={H} />
          </clipPath>
        </defs>

        {/* Ghost line — full width, very dim */}
        <path
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          strokeOpacity={0.13}
          strokeLinecap="round"
        />

        {/* Active area — clipped to cursor */}
        <g clipPath={`url(#${clipId})`}>
          <path d={fillPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.95}
            strokeLinecap="round"
          />
        </g>

        {isHovering && (
          <>
            {/* Dashed vertical cursor */}
            <line
              x1={cursorX}
              y1={TOP}
              x2={cursorX}
              y2={H - BOTTOM}
              stroke={accent}
              strokeDasharray="3 3"
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
            {/* Floating pill */}
            <rect x={pillX} y={2} width={52} height={18} rx={4} fill={accent} />
            <text
              x={pillX + 26}
              y={15}
              textAnchor="middle"
              fill="#000"
              fontSize={10}
              fontWeight={700}
              fontFamily="monospace"
            >
              {displayVal.toFixed(0)}%
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

function Hero({ market }: { market: DisplayMarket | null }) {
  return (
    <section className="relative overflow-hidden pt-36 pb-24 md:pt-48 md:pb-36">
      <AmbientBackdrop />

      <div className="relative mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/3 px-3.5 py-1.5 text-[11px] font-medium text-white/70"
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: ACCENT }}
            />
            Live on Solana devnet &middot; CLOB markets
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            className="mx-auto max-w-[960px] text-[42px] font-bold tracking-[-0.04em] leading-[1.02] text-white md:text-[80px]"
          >
            <span className="gradient-text-green">Get paid</span> when
            <br />
            <span className="text-white/30 font-light italic">
              you&apos;re right
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="mt-6 max-w-[480px] text-[16px] leading-[1.7] text-white/50 md:text-[17px]"
          >
            Trade YES / NO shares on real-world outcomes on a transparent,
            on-chain order book. Every winning share pays exactly{" "}
            <span className="text-white font-medium">$1 USDC</span>.
          </motion.p>

          {/* Social proof pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.18 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              { icon: <Zap className="h-3 w-3" />, label: "Non-custodial" },
              {
                icon: <Lock className="h-3 w-3" />,
                label: "Your keys, your funds",
              },
              {
                icon: <Database className="h-3 w-3" />,
                label: "On-chain order book",
              },
            ].map((p) => (
              <span
                key={p.label}
                className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/3 px-2.5 py-1 text-[11px] text-white/50"
              >
                <span className="text-white/30">{p.icon}</span>
                {p.label}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.24 }}
            className="mt-10 flex flex-col gap-2.5 sm:flex-row"
          >
            <Link
              href="/markets"
              className="group inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-white/90 hover:shadow-[0_0_24px_rgba(255,255,255,0.15)]"
            >
              Start trading
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#live"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/[0.1] bg-white/3 px-6 text-sm font-medium text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              See live markets
            </a>
          </motion.div>
        </div>

        <div className="mt-20 md:mt-28">
          <HeroMockup market={market} />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Live ticker — wired to real markets
   ────────────────────────────────────────────────────────────────────────── */

function LiveTicker({ markets }: { markets: DisplayMarket[] }) {
  if (markets.length === 0) return null;
  const doubled = [...markets, ...markets, ...markets].slice(0, 30);
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-black/40">
      <div className="flex items-center">
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-white/[0.06] bg-black/80 px-4 py-2.5">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: ACCENT }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
            On-chain
          </span>
        </div>
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
          }}
        >
          <div
            className="flex gap-10 whitespace-nowrap"
            style={{
              animation: "stanx-scroll 80s linear infinite",
              width: "max-content",
            }}
          >
            {doubled.map((m, idx) => {
              const pct = Math.round(m.yesPrice * 100);
              return (
                <Link
                  key={`${m.marketId}-${idx}`}
                  href={`/market/${m.marketId}`}
                  className="flex shrink-0 items-center gap-2 py-2.5 text-xs text-white/60 hover:text-white"
                >
                  <span className="max-w-[320px] truncate">{m.question}</span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                    style={{
                      color: pct >= 50 ? ACCENT : "rgba(255,255,255,0.7)",
                      background:
                        pct >= 50
                          ? "rgba(52,211,153,0.1)"
                          : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {pct}%
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes stanx-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-33.333%);
          }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Bento grid — the centerpiece
   ────────────────────────────────────────────────────────────────────────── */

function BentoCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={reduce ? undefined : onMove}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, ease: EASE }}
      className={cn(
        "group relative isolate overflow-hidden rounded-[26px]",
        "border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.032),rgba(255,255,255,0.008)_55%,rgba(255,255,255,0.018))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_0_rgba(255,255,255,0.02),0_50px_90px_-50px_rgba(0,0,0,0.85)]",
        "transition-[transform,border-color,box-shadow] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        "hover:-translate-y-[3px] hover:border-white/[0.14]",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(52,211,153,0.06),0_70px_140px_-40px_rgba(0,0,0,0.92),0_0_80px_-20px_rgba(52,211,153,0.14)]",
        className
      )}
    >
      {/* cursor-follow spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(380px circle at var(--mx,50%) var(--my,50%), rgba(52,211,153,0.10), transparent 45%)",
        }}
      />
      {/* top hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
      />
      {/* left inner highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-white/[0.04] to-transparent"
      />
      {/* grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "160px 160px",
        }}
      />
      <div className="relative z-10 h-full w-full">{children}</div>
    </motion.div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
      <span
        className="inline-block h-[4px] w-[4px] rounded-full"
        style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }}
      />
      {children}
    </div>
  );
}

/* --- Bento visuals ----------------------------------------------------- */

/* Clipped Area Chart — evilcharts.com style
   Active zone (left of cursor) is fully opaque + filled.
   Ghost zone (right) is a faint dim line only.
   A floating label pill + dashed vertical cursor line track the hover point. */
const CLOB_DATA = [
  { month: "Feb", yes: 38 },
  { month: "Mar", yes: 55 },
  { month: "Apr", yes: 48 },
  { month: "May", yes: 62 },
  { month: "Jun", yes: 57 },
  { month: "Jul", yes: 41 },
  { month: "Aug", yes: 72 },
  { month: "Sep", yes: 64 },
  { month: "Oct", yes: 58 },
  { month: "Nov", yes: 70 },
  { month: "Dec", yes: 64.5 },
];

const CLOB_CHART_CFG = {
  yes: { label: "YES Price", color: ACCENT },
} as const;

function DepthChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [axis, setAxis] = useState(0);

  const springX = useSpring(0, { damping: 30, stiffness: 100 });
  const springY = useSpring(CLOB_DATA[CLOB_DATA.length - 1].yes, { damping: 30, stiffness: 100 });

  useMotionValueEvent(springX, "change", (latest) => setAxis(latest));

  return (
    <div className="relative w-full">
      <ChartContainer ref={chartRef} config={CLOB_CHART_CFG} className="h-[180px] w-full md:h-[210px]">
        <AreaChart
          data={CLOB_DATA}
          margin={{ top: 28, right: 0, left: 0, bottom: 0 }}
          className="overflow-visible cursor-crosshair"
          onMouseMove={(state) => {
            const x = state.activeCoordinate?.x;
            const val = state.activePayload?.[0]?.value as number | undefined;
            if (x != null && val != null) {
              springX.set(x);
              springY.set(val);
            }
          }}
          onMouseLeave={() => {
            springX.set(chartRef.current?.getBoundingClientRect().width ?? 0);
            springY.jump(CLOB_DATA[CLOB_DATA.length - 1].yes);
          }}
        >
          <defs>
            <linearGradient id="ca-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ACCENT} stopOpacity={0.22} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace" }}
            tickMargin={8}
          />
          <YAxis hide domain={["auto", "auto"]} />

          {/* Active (clipped) — bright line + fill */}
          <Area
            dataKey="yes"
            type="monotone"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#ca-fill)"
            fillOpacity={1}
            dot={false}
            activeDot={false}
            clipPath={`inset(0 ${(chartRef.current?.getBoundingClientRect().width ?? 0) - axis}px 0 0)`}
          />

          {/* Ghost — dim line, no fill */}
          <Area
            dataKey="yes"
            type="monotone"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeOpacity={0.13}
            fill="none"
            dot={false}
            activeDot={false}
          />

          {/* Dashed cursor line */}
          <line
            x1={axis} y1={0} x2={axis} y2="88%"
            stroke={ACCENT} strokeDasharray="3 3" strokeWidth={1}
            strokeOpacity={0.3} strokeLinecap="round"
          />

          {/* Floating pill */}
          <rect x={axis - 30} y={2} width={60} height={20} rx={4} fill={ACCENT} />
          <text x={axis} y={16} textAnchor="middle" fill="#000" fontSize={11} fontWeight={700} fontFamily="monospace">
            {springY.get().toFixed(1)}¢
          </text>
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

/* WebSocket stream — live activity feed with per-type color coding */

const KIND_CFG: Record<
  string,
  { label: string; color: string; bg: string; bar: string }
> = {
  book: {
    label: "BOOK",
    color: ACCENT,
    bg: "rgba(52,211,153,0.06)",
    bar: ACCENT,
  },
  new: {
    label: "ORDER",
    color: "rgba(255,255,255,0.7)",
    bg: "transparent",
    bar: "rgba(255,255,255,0.18)",
  },
  cancel: {
    label: "CANCEL",
    color: "rgba(251,146,60,0.9)",
    bg: "rgba(251,146,60,0.05)",
    bar: "rgba(251,146,60,0.7)",
  },
  filled: {
    label: "FILLED",
    color: ACCENT,
    bg: "rgba(52,211,153,0.10)",
    bar: ACCENT,
  },
};

function WsStream() {
  const allLines = useMemo(
    () => [
      { k: "book", text: "42 YES bids · 38 YES asks" },
      { k: "new", text: "+2 YES bids at 64¢" },
      { k: "cancel", text: "−1 YES ask removed" },
      { k: "new", text: "+1 NO ask at 37¢" },
      { k: "filled", text: "0.80 USDC matched at 65¢" },
      { k: "new", text: "+3 YES bids at 63¢" },
    ],
    []
  );

  const reduce = useReducedMotion();
  const idRef = useRef(allLines.length);
  const stepRef = useRef(allLines.length);
  const [feed, setFeed] = useState(() =>
    allLines.slice(0, 4).map((l, i) => ({ ...l, id: i }))
  );

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      const next = allLines[stepRef.current % allLines.length];
      stepRef.current++;
      setFeed((prev) => [...prev.slice(-4), { ...next, id: idRef.current++ }]);
    }, 1800);
    return () => clearInterval(t);
  }, [allLines, reduce]);

  const [slot, setSlot] = useState(327_941_203);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setSlot((s) => s + 1), 400);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-[#080808]">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: ACCENT }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: ACCENT }}
            />
          </span>
          <span className="font-mono text-[10px] font-medium tracking-wide text-white/45">
            Orderbook · live
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-white/20">
          slot {slot.toLocaleString()}
        </span>
      </div>

      {/* feed rows */}
      <div className="flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {feed.map((l, i) => {
            const cfg = KIND_CFG[l.k] ?? KIND_CFG.new;
            const isFresh = i === feed.length - 1;
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isFresh ? 1 : 0.28 + i * 0.14, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="relative flex items-center gap-3 border-b border-white/4 px-3.5 py-2.5 last:border-b-0"
                style={{ background: isFresh ? cfg.bg : "transparent" }}
              >
                {/* left accent bar */}
                <div
                  className="absolute inset-y-0 left-0 w-[2.5px] rounded-r-full"
                  style={{ background: isFresh ? cfg.bar : "transparent" }}
                />

                {/* type badge */}
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    color: cfg.color,
                    background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                    minWidth: "44px",
                    textAlign: "center",
                  }}
                >
                  {cfg.label}
                </span>

                {/* description */}
                <span
                  className="truncate text-[12px] font-medium"
                  style={{
                    color: isFresh
                      ? l.k === "filled" || l.k === "book"
                        ? cfg.color
                        : "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.4)",
                  }}
                >
                  {l.text}
                </span>

                {/* fresh indicator */}
                {isFresh && (
                  <motion.span
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.2, repeat: 2, ease: "easeInOut" }}
                    className="ml-auto shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold"
                    style={{
                      color: cfg.color,
                      background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                    }}
                  >
                    new
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BentoGrid() {
  return (
    <section id="features" className="relative py-28 md:py-40">
      {/* ambient bloom behind the grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(52,211,153,0.08), transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-5 md:px-8">
        {/* Editorial section opener */}
        <Reveal className="mb-16 md:mb-24">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/45">
              Features
            </span>
          </div>
          <h2 className="mt-6 max-w-[17ch] text-[44px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[76px]">
            Every primitive of a real exchange,{" "}
            <span className="text-white/25">on Solana.</span>
          </h2>
          <p className="mt-6 max-w-[54ch] text-[15.5px] leading-[1.65] text-white/45">
            No AMM shortcuts. No custodial shortcuts. Limit and market orders
            settle against a public order book, funds stay in your wallet, and
            every winning share pays exactly $1 USDC.
          </p>
        </Reveal>

        {/* Asymmetric CSS grid — true col/row spans, no row-based templating */}
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12 lg:auto-rows-[168px]">
          <BentoCell className="lg:col-span-7 lg:row-span-3">
            <BentoClob />
          </BentoCell>
          <BentoCell className="lg:col-span-5 lg:row-span-2">
            <BentoYoutube />
          </BentoCell>
          <BentoCell className="lg:col-span-5 lg:row-span-1">
            <BentoSpeed />
          </BentoCell>
          <BentoCell className="lg:col-span-5 lg:row-span-2">
            <BentoSplitMerge />
          </BentoCell>
          <BentoCell className="lg:col-span-4 lg:row-span-2">
            <BentoWebsocket />
          </BentoCell>
          <BentoCell className="lg:col-span-3 lg:row-span-1">
            <BentoPayout />
          </BentoCell>
          <BentoCell className="lg:col-span-3 lg:row-span-1">
            <BentoCustody />
          </BentoCell>
          <BentoCell className="lg:col-span-4 lg:row-span-1">
            <BentoOracle />
          </BentoCell>
          <BentoCell className="lg:col-span-4 lg:row-span-1">
            <BentoArweave />
          </BentoCell>
          <BentoCell className="lg:col-span-4 lg:row-span-2">
            <BentoFaucet />
          </BentoCell>
          <BentoCell className="lg:col-span-8 lg:row-span-1">
            <BentoCreate />
          </BentoCell>
        </div>
      </div>
    </section>
  );
}

/* ── Bento cells — typography-first, breathing, signature visuals ─────── */

function BentoClob() {
  return (
    <div className="relative flex h-full flex-col gap-5 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 70% at 20% 0%, rgba(52,211,153,0.06), transparent 55%)",
        }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Kicker>Central Limit Order Book</Kicker>
          <h3
            className="max-w-[20ch] text-[28px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[34px]"
            style={GRAD_TEXT}
          >
            Real price discovery,
            <br />
            fully on-chain
          </h3>
          <p className="max-w-[42ch] text-[13px] leading-[1.6] text-white/45">
            Every bid, ask, and fill is public. Limit at your price or
            market-fill at the best ask. No AMM, no hidden slippage.
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
            Mid · YES
          </div>
          <div
            className="font-mono text-[48px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
            style={{
              color: ACCENT,
              textShadow: "0 0 40px rgba(52,211,153,0.25)",
            }}
          >
            64.5¢
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-white/40">
            <motion.span
              className="h-1 w-1 rounded-full"
              style={{ background: ACCENT }}
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            +2.1¢ · 24h
          </div>
        </div>
      </div>
      <div className="relative mt-auto">
        <DepthChart />
      </div>
    </div>
  );
}

function BentoYoutube() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-[0.09] blur-[60px]"
        style={{ background: ACCENT }}
      />

      {/* top: label + title only — keep it tight */}
      <div className="relative space-y-1.5">
        <Kicker>Video markets</Kicker>
        <h3
          className="max-w-[18ch] text-[22px] font-semibold leading-[1.1] tracking-[-0.025em]"
          style={GRAD_TEXT}
        >
          Trade on what gets watched
        </h3>
      </div>

      {/* middle: market snapshot — ordered, ShadCN-style */}
      <div className="relative">
        {/* question label */}
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/30">
          Will MrBeast&apos;s video hit 100M views?
        </p>

        {/* two-column stats block */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02]">
          {/* YES odds */}
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
              Yes odds
            </span>
            <span
              className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
              style={{ color: ACCENT, textShadow: `0 0 22px ${ACCENT}40` }}
            >
              64¢
            </span>
            <span className="mt-0.5 font-mono text-[10px] text-white/30 tabular-nums">
              +2.1¢ · 24h
            </span>
          </div>

          {/* actual views */}
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
              Current views
            </span>
            <span className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white/80">
              241M
            </span>
            <span className="mt-0.5 font-mono text-[10px] text-white/30 tabular-nums">
              target · 100M
            </span>
          </div>
        </div>
      </div>

      {/* bottom: outcome */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
        <span
          className="rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: ACCENT, background: `${ACCENT}15` }}
        >
          YES · 64¢
        </span>
        <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
          NO · 36¢
        </span>
        <span className="ml-auto font-mono text-[10px] text-white/20">
          resolved
        </span>
      </div>
    </div>
  );
}

function BentoSpeed() {
  const bars = [0.45, 0.7, 0.55, 0.9, 0.65, 0.8, 0.5, 0.75, 1, 0.6];
  return (
    <div className="relative flex h-full items-center justify-between gap-6 overflow-hidden px-6 py-5">
      {/* left: text stack */}
      <div className="relative space-y-1.5">
        <Kicker>Solana finality</Kicker>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
            style={{ color: ACCENT, textShadow: `0 0 28px ${ACCENT}44` }}
          >
            400
          </span>
          <span className="font-mono text-[13px] font-medium text-white/35">
            ms
          </span>
        </div>
        <p className="text-[11.5px] leading-snug text-white/40">
          Sub-second settlement.{" "}
          <span className="text-white/25">Fills feel instant.</span>
        </p>
      </div>

      {/* right: animated block-cadence bars */}
      <div
        className="relative flex shrink-0 items-end gap-[3px]"
        style={{ height: "44px" }}
      >
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="w-[3px] rounded-full"
            style={{
              background: ACCENT,
              opacity: 0.12 + h * 0.45,
              height: `${h * 100}%`,
            }}
            animate={{
              height: [
                `${h * 100}%`,
                `${(h * 0.6 + 0.2) * 100}%`,
                `${h * 100}%`,
              ],
            }}
            transition={{
              duration: 1.4 + i * 0.18,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.09,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BentoSplitMerge() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <div className="space-y-2">
        <Kicker>Split &amp; merge</Kicker>
        <h3
          className="max-w-[18ch] text-[20px] font-semibold leading-[1.15] tracking-[-0.02em]"
          style={GRAD_TEXT}
        >
          1 USDC, two outcomes
        </h3>
        <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-white/45">
          Mint a YES+NO pair anytime, burn to reclaim USDC. No counterparty
          needed.
        </p>
      </div>
      {/* split flow diagram — single SVG so lines connect flush to nodes */}
      <div className="w-full overflow-visible">
        <svg
          viewBox="0 0 320 80"
          fill="none"
          className="w-full"
          style={{ height: "80px", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="sm-yes" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="sm-no" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
            </linearGradient>
          </defs>

          {/* ── USDC source box (x:0–90, y:20–60, centred at y=40) ── */}
          <rect
            x="0"
            y="20"
            width="90"
            height="40"
            rx="10"
            ry="10"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
          <text
            x="45"
            y="36"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="8"
            fontWeight="600"
            letterSpacing="2"
            fill="rgba(255,255,255,0.35)"
          >
            USDC
          </text>
          <text
            x="45"
            y="54"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="20"
            fontWeight="700"
            letterSpacing="-0.04em"
            fill="white"
          >
            1.00
          </text>

          {/* ── Connector lines (from right edge of USDC box to left edge of outcome boxes) ── */}
          {/* Horizontal stem from USDC right edge to fork point */}
          <line
            x1="90"
            y1="40"
            x2="148"
            y2="40"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* YES path: fork → curve up → YES box left edge */}
          <path
            d="M 148 40 C 172 40, 172 18, 194 18"
            stroke="url(#sm-yes)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* NO path: fork → curve down → NO box left edge */}
          <path
            d="M 148 40 C 172 40, 172 62, 194 62"
            stroke="url(#sm-no)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* ── YES outcome box (x:194–320, y:4–32, centred at y=18) ── */}
          <rect
            x="194"
            y="4"
            width="126"
            height="28"
            rx="9"
            ry="9"
            fill={`${ACCENT}0d`}
            stroke={`${ACCENT}33`}
            strokeWidth="1"
          />
          <text
            x="212"
            y="22"
            fontFamily="monospace"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.5"
            fill={ACCENT}
          >
            YES
          </text>
          <text
            x="302"
            y="22"
            textAnchor="end"
            fontFamily="monospace"
            fontSize="13"
            fontWeight="600"
            fill={ACCENT}
          >
            1
          </text>

          {/* ── NO outcome box (x:194–320, y:48–76, centred at y=62) ── */}
          <rect
            x="194"
            y="48"
            width="126"
            height="28"
            rx="9"
            ry="9"
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
          <text
            x="212"
            y="66"
            fontFamily="monospace"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.5"
            fill="rgba(255,255,255,0.40)"
          >
            NO
          </text>
          <text
            x="302"
            y="66"
            textAnchor="end"
            fontFamily="monospace"
            fontSize="13"
            fontWeight="600"
            fill="rgba(255,255,255,0.60)"
          >
            1
          </text>
        </svg>
      </div>
      <div className="flex items-stretch gap-2.5">
        <div className="flex-1 rounded-lg border border-white/[0.07] bg-white/2 p-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ACCENT }}
          >
            Split →
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/45">
            Mint a YES+NO pair. 1:1 with USDC.
          </div>
        </div>
        <div className="flex-1 rounded-lg border border-white/[0.07] bg-white/2 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            ← Merge
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/45">
            Burn the pair. Get USDC back.
          </div>
        </div>
      </div>
    </div>
  );
}

function BentoWebsocket() {
  return (
    <div className="relative flex h-full flex-col gap-4 p-6">
      <div className="space-y-2">
        <Kicker>Realtime</Kicker>
        <h3
          className="max-w-[14ch] text-[20px] font-semibold leading-[1.15] tracking-[-0.02em]"
          style={GRAD_TEXT}
        >
          Streaming order book
        </h3>
        <p className="max-w-[30ch] text-[12px] leading-relaxed text-white/45">
          Snapshot + diffs over WebSocket. Auto-reconnects.
        </p>
      </div>
      <div className="mt-auto">
        <WsStream />
      </div>
    </div>
  );
}

function BentoPayout() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <Kicker>Payout</Kicker>
      <div>
        <div
          className="font-mono text-[52px] font-semibold leading-none tracking-[-0.04em]"
          style={GRAD_TEXT}
        >
          $1
        </div>
        <div className="mt-2 text-[11px] leading-snug text-white/45">
          Per winning share, settled in USDC.
        </div>
      </div>
    </div>
  );
}

function BentoCustody() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <Kicker>Non-custodial</Kicker>
      <div>
        <div
          className="text-[22px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[24px]"
          style={GRAD_TEXT}
        >
          Your keys
          <br />
          Always
        </div>
        <div className="mt-2 text-[11px] text-white/45">
          Funds never leave your wallet
        </div>
      </div>
    </div>
  );
}

function BentoOracle() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <Kicker>Resolution</Kicker>
      <div className="space-y-2.5">
        <div
          className="text-[17px] font-semibold leading-[1.15] tracking-[-0.015em]"
          style={GRAD_TEXT}
        >
          Machines read,
          <br />
          Chain commits
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-black/25 px-2 py-1 font-mono text-[10px] tabular-nums text-white/50">
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
          />
          Youtube.v3 → winner · YES
        </div>
      </div>
    </div>
  );
}

function BentoArweave() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <Kicker>Permanence</Kicker>
      <div>
        <div
          className="text-[36px] font-semibold leading-[0.95] tracking-[-0.04em] md:text-[42px]"
          style={GRAD_TEXT}
        >
          Forever
        </div>
        <div className="mt-2 text-[11px] leading-tight text-white/40">
          Metadata pinned to Arweave via Irys
        </div>
      </div>
    </div>
  );
}

function BentoFaucet() {
  return (
    <div className="relative flex h-full flex-col justify-between p-6">
      <div className="flex items-center justify-between">
        <Kicker>Devnet</Kicker>
      </div>
      <div>
        <h3
          className="text-[26px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[30px]"
          style={GRAD_TEXT}
        >
          Free test USDC
        </h3>
        <p className="mt-2 max-w-[22ch] text-[12px] leading-[1.6] text-white/45">
          One-click faucet. Trade risk-free from day one.
        </p>
      </div>
      <div className="flex items-center gap-2 self-start rounded-full border border-white/[0.08] bg-white/2 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-[color,border-color] hover:border-white/18 hover:text-white">
        Request drop
        <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
}

function BentoCreate() {
  return (
    <div className="relative flex h-full flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center md:px-8">
      <div className="min-w-0 space-y-2">
        <Kicker>Anyone can create</Kicker>
        <h3
          className="text-[22px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[26px]"
          style={GRAD_TEXT}
        >
          Deploy a market in minutes
        </h3>
        <p className="max-w-[44ch] text-[12px] leading-relaxed text-white/45">
          Paste a URL, pick a metric, set a deadline. The oracle does the rest.
        </p>
      </div>
      <Link
        href="/create-market"
        className="group/btn inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-transform duration-300 hover:scale-[1.02]"
        style={{ boxShadow: "0 8px 30px rgba(255,255,255,0.1)" }}
      >
        Create market
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
      </Link>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   How it works — 3 steps
   ────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Pick a market",
    body: "Browse markets across entertainment, sports, gaming, and crypto. Each market asks one yes/no question that resolves on a real-world outcome.",
  },
  {
    n: "02",
    title: "Place your order",
    body: "Buy YES or NO at any price. Use a limit order to name your price, or a market order to fill instantly at the best available ask. Cancel anytime.",
  },
  {
    n: "03",
    title: "Collect winnings",
    body: "When the event resolves, each winning share pays exactly $1 USDC. Losing shares expire at $0. Settlement is automatic and on-chain.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal className="mb-14 max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[48px]">
            From zero to trade,
            <br />
            <span className="text-white/40">in three steps.</span>
          </h2>
        </Reveal>

        <div className="relative grid gap-3 md:grid-cols-3 md:gap-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <div className="relative flex h-full flex-col rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-6">
                <div
                  className="mb-5 inline-flex h-8 items-center gap-2 self-start rounded-full border border-white/[0.08] px-3 text-[11px] font-semibold tabular-nums"
                  style={{ color: ACCENT, background: "rgba(52,211,153,0.05)" }}
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: ACCENT }}
                  />
                  Step {s.n}
                </div>
                <h3 className="text-[18px] font-semibold tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Live demo widget — wired to real API
   ────────────────────────────────────────────────────────────────────────── */

function LiveDemo({
  markets,
  loading,
}: {
  markets: DisplayMarket[];
  loading: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const active = markets[idx] ?? null;

  // Auto-rotate every 6s
  useEffect(() => {
    if (markets.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % markets.length);
    }, 6000);
    return () => clearInterval(t);
  }, [markets.length]);

  return (
    <section id="live" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <Reveal className="mb-10 max-w-2xl">
          <Eyebrow>Live demo</Eyebrow>
          <h2 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[48px]">
            Prices, volume, probabilities
            <br />
            <span className="text-white/40">pulled live from chain.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/50">
            Everything on this card is a real market on Solana devnet. Click to
            trade it.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
          {/* Main card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-6 md:p-8">
            <AnimatePresence mode="wait">
              {loading && !active ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-[360px] items-center justify-center text-sm text-white/40"
                >
                  Loading live markets…
                </motion.div>
              ) : active ? (
                <motion.div
                  key={active.marketId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                    <span>{active.category}</span>
                    <span className="text-white/15">·</span>
                    <span>Market #{active.marketId}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl">
                    {active.question}
                  </h3>

                  <div className="mt-6">
                    <MiniChart
                      accent={ACCENT}
                      yes={Math.round(active.yesPrice * 100)}
                    />
                  </div>

                  <div className="mt-6 flex items-center gap-3 border-t border-white/6 pt-5">
                    {/* YES chip */}
                    <div
                      className="flex items-baseline gap-1 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: `${ACCENT}33`,
                        background: `${ACCENT}0d`,
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: ACCENT }}
                      >
                        Yes
                      </span>
                      <span
                        className="font-mono text-[15px] font-semibold tabular-nums leading-none"
                        style={{ color: ACCENT }}
                      >
                        {Math.round(active.yesPrice * 100)}¢
                      </span>
                    </div>
                    {/* NO chip */}
                    <div className="flex items-baseline gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        No
                      </span>
                      <span className="font-mono text-[15px] font-semibold tabular-nums leading-none text-white/65">
                        {100 - Math.round(active.yesPrice * 100)}¢
                      </span>
                    </div>
                    {/* divider */}
                    <div className="h-6 w-px shrink-0 bg-white/8" />
                    {/* stats */}
                    <div className="flex flex-1 items-center gap-4">
                      <Stat label="Vol" value={formatVolume(active.volume)} />
                      <Stat
                        label="Traders"
                        value={active.participants.toLocaleString()}
                      />
                    </div>
                    {/* trade cta */}
                    <Link
                      href={`/market/${active.marketId}`}
                      className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-white/90"
                    >
                      Trade
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-[360px] items-center justify-center text-sm text-white/40"
                >
                  No markets live yet. Be the first.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side list */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-white/[0.01]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                Live markets
              </span>
              <span
                className="flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-white/60"
                style={{ background: "rgba(52,211,153,0.04)" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: ACCENT }}
                />
                {markets.length} on-chain
              </span>
            </div>
            <div className="max-h-[420px] divide-y divide-white/[0.05] overflow-y-auto">
              {loading && markets.length === 0 && (
                <div className="space-y-3 p-5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-md bg-white/3"
                    />
                  ))}
                </div>
              )}
              {markets.slice(0, 8).map((m, i) => {
                const pct = Math.round(m.yesPrice * 100);
                const isActive = i === idx;
                return (
                  <button
                    key={m.marketId}
                    onClick={() => setIdx(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors",
                      isActive ? "bg-white/3" : "hover:bg-white/2"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-white/85">
                        {m.question}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/40">
                        {formatVolume(m.volume)} · {m.participants} traders
                      </div>
                    </div>
                    <div
                      className="rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums"
                      style={{
                        color: pct >= 50 ? ACCENT : "rgba(255,255,255,0.75)",
                        background:
                          pct >= 50
                            ? "rgba(52,211,153,0.1)"
                            : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {pct}%
                    </div>
                  </button>
                );
              })}
              {!loading && markets.length === 0 && (
                <div className="p-8 text-center text-sm text-white/40">
                  No live markets. Spin one up in /create-market.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  const color = accent ? ACCENT : "rgba(255,255,255,0.85)";
  return (
    <div
      className="rounded-xl border px-4 py-3.5"
      style={
        accent
          ? {
              borderColor: "rgba(52,211,153,0.22)",
              background: "rgba(52,211,153,0.05)",
            }
          : { borderColor: "rgba(255,255,255,0.08)" }
      }
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.55)" }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="text-2xl font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-xs" style={{ color, opacity: 0.7 }}>
          ¢
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-widest text-white/35">
        {label}
      </span>
      <span className="text-[13px] font-medium capitalize text-white/85 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

/* ──────────────────────────────────────────────────────────────────────────
   FAQ
   ────────────────────────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: "What is a prediction market?",
    a: "A platform where people trade on the outcomes of real-world events. YES and NO shares are bought and sold the price reflects the crowd's collective probability estimate.",
  },
  {
    q: "How does the order book work?",
    a: "Stanx uses a Central Limit Order Book (CLOB). Buyers and sellers place orders at specific prices; when a buy matches a sell at the same price, a trade executes — the same mechanism used by traditional financial exchanges.",
  },
  {
    q: "How do I earn money?",
    a: "If you buy YES shares and the event resolves YES, each share pays out $1 USDC. Resolve NO and shares go to $0. You can also profit by trading shares before resolution if the market price moves your way.",
  },
  {
    q: "Is my money safe?",
    a: "All funds are held in on-chain smart contracts on Solana. You maintain custody of your assets and can withdraw at any time. Contract code is open source and auditable.",
  },
  {
    q: "Can I create my own market?",
    a: "Yes. Paste a YouTube URL, pick a metric (views, likes, comments), set a target and a deadline. The metadata is pinned to Arweave, and the market deploys on-chain. An oracle backed by the YouTube Data API resolves it automatically.",
  },
  {
    q: "What are split and merge?",
    a: "Lock 1 USDC to mint 1 YES + 1 NO share pair. Burn a matching pair anytime to reclaim your USDC no counterparty needed. It's how you exit a position when the book is thin.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[44px]">
              Common questions,
              <br />
              <span className="text-white/40">sharp answers.</span>
            </h2>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-white/50">
              New to prediction markets? Here&apos;s what you need to know.
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {FAQS.map((f, i) => {
                const isOpen = open === i;
                return (
                  <div key={i}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left"
                    >
                      <span
                        className={cn(
                          "text-[15px] font-medium transition-colors",
                          isOpen ? "text-white" : "text-white/80"
                        )}
                      >
                        {f.q}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-white/40 transition-transform duration-300",
                          isOpen && "rotate-180 text-white/80"
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="pb-5 pr-10 text-[14px] leading-relaxed text-white/55">
                            {f.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   CTA
   ────────────────────────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-10 text-center md:p-20">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(52,211,153,0.6), transparent)",
            }}
          />
          <div
            aria-hidden
            className="absolute left-1/2 top-0 -z-0 h-[360px] w-[720px] -translate-x-1/2 rounded-full blur-[140px] opacity-25"
            style={{ background: ACCENT }}
          />
          <Reveal>
            <h2 className="relative text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-white md:text-[56px]">
              Your next correct call
              <br />
              <span className="text-white/40">pays in USDC.</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/55">
              Connect a Solana wallet. Your first trade takes under 60 seconds.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link
                href="/markets"
                className="group inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-black hover:bg-white/90"
              >
                Open first trade
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/create-market"
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/2 px-5 text-sm font-medium text-white/80 hover:border-white/20 hover:text-white"
              >
                Create a market
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Footer
   ────────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-6 w-6">
                <div
                  className="absolute inset-0 rounded-[7px]"
                  style={{ background: ACCENT }}
                />
                <TrendingUp className="absolute inset-0 m-auto h-3.5 w-3.5 text-black" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                Stanx
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/50">
              Trade YES/NO on real-world events using a transparent Central
              Limit Order Book on Solana.
            </p>
            <div className="mt-5 flex items-center gap-2 text-[11px] text-white/40">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ACCENT }}
              />
              Live on Solana devnet
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Product
            </div>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li>
                <Link
                  href="/markets"
                  className="text-white/65 hover:text-white"
                >
                  Markets
                </Link>
              </li>
              <li>
                <Link
                  href="/create-market"
                  className="text-white/65 hover:text-white"
                >
                  Create market
                </Link>
              </li>
              <li>
                <Link
                  href="/portfolio"
                  className="text-white/65 hover:text-white"
                >
                  Portfolio
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="text-white/65 hover:text-white"
                >
                  Account
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Learn
            </div>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              <li>
                <a
                  href="#how-it-works"
                  className="text-white/65 hover:text-white"
                >
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className="text-white/65 hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#faq" className="text-white/65 hover:text-white">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#live" className="text-white/65 hover:text-white">
                  Live demo
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-white/40 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Stanx · Built on Solana.</span>
          <span className="tabular-nums">
            Every winning share pays $1 USDC.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  const [markets, setMarkets] = useState<DisplayMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMarketsAction();
        if (cancelled) return;
        if (res.success && res.markets) {
          setMarkets(res.markets);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroMarket = markets[0] ?? null;
  const tickerMarkets = markets.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/20">
      <Navbar />
      <main>
        <Hero market={heroMarket} />
        <LiveTicker markets={tickerMarkets} />
        <BentoGrid />
        <HowItWorks />
        <LiveDemo markets={markets} loading={loading} />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
