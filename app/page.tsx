"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { getMarketsAction } from "@/app/markets/actions";
import type { DisplayMarket } from "@/lib/blockchain/markets";
import {
  ArrowRight, TrendingUp, Users, Zap, Shield,
  BarChart2, Eye, Lock, Cpu, ChevronDown,
  Trophy, Clapperboard, Gamepad2, Globe, Music, Tv
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { icon: Clapperboard, label: "Entertainment", count: 42, color: "text-purple-500", bg: "bg-purple-500/10" },
  { icon: Trophy,       label: "Sports",        count: 31, color: "text-orange-500", bg: "bg-orange-500/10" },
  { icon: Gamepad2,     label: "Gaming",        count: 28, color: "text-blue-500",   bg: "bg-blue-500/10"  },
  { icon: Globe,        label: "Crypto",        count: 24, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { icon: Tv,           label: "Streaming",     count: 19, color: "text-pink-500",   bg: "bg-pink-500/10"  },
  { icon: Music,        label: "Music",         count: 15, color: "text-success",    bg: "bg-success/10"   },
];

const ACTIVITY = [
  { user: "trader_anon",   action: "Bought 200 YES", market: "MrBeast hits 300M subscribers",     price: "0.72", time: "12s ago",  positive: true  },
  { user: "sol_whale_42",  action: "Sold 150 NO",    market: "GTA VI launches Q1 2025",           price: "0.58", time: "31s ago",  positive: false },
  { user: "vega_pro",      action: "Bought 500 YES", market: "Squid Game S3 renewed in 2025",     price: "0.61", time: "1m ago",   positive: true  },
  { user: "echo_markets",  action: "Bought 80 NO",   market: "Taylor Swift New Album 2025",       price: "0.44", time: "2m ago",   positive: false },
  { user: "alpha_pred",    action: "Sold 300 YES",   market: "Logan Paul Boxing Match",           price: "0.83", time: "3m ago",   positive: true  },
];

const FAQS = [
  {
    q: "What is a prediction market?",
    a: "A prediction market is a platform where people trade on the outcomes of real-world events. YES and NO shares are bought and sold — the price reflects the crowd's collective probability estimate.",
  },
  {
    q: "How does the order book work?",
    a: "PredictX uses a Central Limit Order Book (CLOB). Buyers and sellers place orders at specific prices; when a buy matches a sell at the same price, a trade executes — the same mechanism used by traditional financial exchanges.",
  },
  {
    q: "How do I earn money?",
    a: "If you buy YES shares and the event resolves YES, each share pays out $1 (1 USDC). Resolve NO and shares go to $0. You can also profit by trading shares before resolution if the market price moves your way.",
  },
  {
    q: "Is my money safe?",
    a: "All funds are held in on-chain smart contracts on Solana. You maintain custody of your assets and can withdraw at any time. All contract code is open source and auditable.",
  },
  {
    q: "Can I create my own market?",
    a: "Yes! Any user can submit a market proposal. After review for quality and fairness, approved markets go live. Market creators earn a small fee on each trade.",
  },
];

const Home = () => {
  const [markets, setMarkets] = useState<DisplayMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loadMarkets = useCallback(async () => {
    setIsLoading(true);
    const result = await getMarketsAction();
    if (result.success && result.markets) setMarkets(result.markets);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  const featuredMarkets = markets.slice(0, 3);
  const trendingMarkets = [...markets].sort((a, b) => b.volume - a.volume).slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <PageTransition>
        <main className="flex-1">

          {/* ── Hero ─────────────────────────────────────── */}
          <section className="relative overflow-hidden border-b border-border">
            {/* Ambient gradient */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="blur-orb w-150 h-150 -top-50 left-[10%] bg-blue-500/8" />
              <div className="blur-orb w-125 h-125 -bottom-25 right-[5%] bg-emerald-500/6" style={{ animationDelay: '3s' }} />
            </div>
            {/* Dot grid */}
            <div className="absolute inset-0 pattern-dots opacity-40" />

            <div className="relative max-w-350 mx-auto px-4 lg:px-6 pt-24 pb-20 md:pt-36 md:pb-28">
              {/* Status pill */}
              <div className="flex justify-center mb-8">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/80 backdrop-blur-sm text-xs font-medium text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Live on Solana devnet · CLOB markets
                </span>
              </div>

              {/* Headline */}
              <div className="text-center max-w-4xl mx-auto mb-8">
                <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.05] mb-6 text-foreground">
                  Trade what you
                  <br />
                  <span className="text-muted-foreground font-normal">think will happen.</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  Prediction markets for entertainment, sports, and gaming.
                  Powered by an on-chain order book.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex items-center justify-center gap-3 mb-16">
                <Button asChild size="lg" className="h-10 px-5 text-sm font-medium bg-foreground text-background hover:bg-foreground/90">
                  <Link href="/markets">
                    Browse markets
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-10 px-5 text-sm font-medium border-border hover:bg-muted/60 text-foreground">
                  <Link href="#how-it-works">How it works</Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-center gap-10 md:gap-16">
                {[
                  { value: "$4.2M", label: "Volume traded" },
                  { value: "28K+", label: "Traders" },
                  { value: "150+", label: "Live markets" },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xl md:text-2xl font-semibold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Live ticker ────────────────────────────── */}
          {markets.length > 0 && (
            <div className="border-b border-border overflow-hidden bg-card/40">
              <div className="flex items-center">
                <div className="flex items-center gap-2 px-4 py-2.5 border-r border-border shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live</span>
                </div>
                <div className="overflow-hidden flex-1 relative">
                  <div className="flex animate-scroll gap-8 pl-6 whitespace-nowrap" style={{ width: 'max-content' }}>
                    {[...markets, ...markets].slice(0, 20).map((market, idx) => (
                      <Link
                        key={`${market.marketId}-${idx}`}
                        href={`/market/${market.marketId}`}
                        className="flex items-center gap-2 shrink-0 group"
                      >
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          {market.question.length > 40 ? market.question.slice(0, 40) + '…' : market.question}
                        </span>
                        <span className={cn(
                          "text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
                          market.yesPrice > 0.5 ? "text-success bg-success/10" : "text-danger bg-danger/10"
                        )}>
                          {Math.round(market.yesPrice * 100)}%
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Feature bento ──────────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="mb-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Why PredictX</p>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Built for real traders</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Wide card — CLOB */}
                <div className="col-span-2 panel-card p-7 flex flex-col gap-4 hover:border-border-strong transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <BarChart2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1.5">Central Limit Order Book</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Real price discovery. Every bid and ask is publicly visible on-chain.
                      Set limit orders or fill at the best available price — no AMM slippage.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["Limit orders", "Market orders", "Best bid/ask"].map((tag) => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Solana Speed */}
                <div className="panel-card p-6 flex flex-col gap-3 hover:border-border-strong transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Solana Speed</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">400ms block times. Trades settle in under a second. Near-zero gas fees.</p>
                  </div>
                </div>

                {/* Transparency */}
                <div className="panel-card p-6 flex flex-col gap-3 hover:border-border-strong transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Full Transparency</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Every trade, order, and resolution is verifiable on-chain. Nothing is hidden.</p>
                  </div>
                </div>

                {/* Non-custodial */}
                <div className="panel-card p-6 flex flex-col gap-3 hover:border-border-strong transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Non-Custodial</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Your wallet, your funds. Smart contracts hold collateral — not us.</p>
                  </div>
                </div>

                {/* Instant payout */}
                <div className="panel-card p-6 flex flex-col gap-3 hover:border-border-strong transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Instant Payout</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">Winning positions settle automatically. USDC credited the moment a market resolves.</p>
                  </div>
                </div>

                {/* Wide — stats */}
                <div className="col-span-2 panel-card p-7 flex flex-col justify-between gap-4 hover:border-border-strong transition-colors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Platform at a glance</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: "$4.2M", label: "Volume" },
                      { value: "28K+", label: "Traders" },
                      { value: "150+", label: "Markets" },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="text-xl font-semibold tracking-tight">{s.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Featured markets ───────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-semibold text-success uppercase tracking-widest mb-1.5">Featured</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Hot right now</h2>
                </div>
                <Link href="/markets" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <MarketCardSkeleton key={i} />)
                  : featuredMarkets.map((market, i) => (
                      <div key={market.marketId} className="stagger-in" style={{ animationDelay: `${i * 70}ms` }}>
                        <MarketCard market={market} />
                      </div>
                    ))}
              </div>
            </div>
          </section>

          {/* ── Category browser ───────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Browse</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Markets by category</h2>
                </div>
                <Link href="/markets" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  All categories <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {CATEGORIES.map((cat, i) => (
                  <Link
                    key={cat.label}
                    href={`/markets?category=${cat.label.toLowerCase()}`}
                    className="panel-card p-5 text-center flex flex-col items-center gap-3 group hover:border-border-strong transition-all stagger-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", cat.bg)}>
                      <cat.icon className={cn("h-5 w-5", cat.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cat.count} markets</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ── How it works ───────────────────────────── */}
          <section id="how-it-works" className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="text-center mb-12">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">How it works</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  A transparent Central Limit Order Book — every trade is verifiable on Solana.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[
                  { num: "01", title: "Pick a market", description: "Browse markets across entertainment, gaming, sports, and more." },
                  { num: "02", title: "Place an order", description: "Buy YES or NO shares. Set limit orders or fill at market price." },
                  { num: "03", title: "Collect winnings", description: "Correct shares pay $1 on resolution. Everything settles on-chain." },
                ].map((step, i) => (
                  <div key={i} className="panel-card p-6 stagger-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <p className="text-xs font-mono text-muted-foreground mb-4">{step.num}</p>
                    <h3 className="font-semibold text-sm mb-2">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Trending markets ───────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Trending</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Highest volume</h2>
                </div>
                <Link href="/markets" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
                  : trendingMarkets.map((market, i) => (
                      <div key={market.marketId} className="stagger-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <MarketCard market={market} />
                      </div>
                    ))}
              </div>
            </div>
          </section>

          {/* ── Live activity ──────────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="grid md:grid-cols-2 gap-10 items-start">
                {/* Copy */}
                <div className="md:sticky md:top-24">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Activity</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Real trades, happening now</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    Watch the crowd take positions in real time. When more people buy YES,
                    the price rises — the order book never lies.
                  </p>
                  <Button asChild variant="outline" size="sm" className="border-border text-sm">
                    <Link href="/markets">
                      See all markets <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                {/* Feed */}
                <div className="flex flex-col gap-2">
                  {ACTIVITY.map((item, i) => (
                    <div
                      key={i}
                      className="panel-card px-4 py-3 flex items-center gap-4 stagger-in"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase select-none">
                        {item.user[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          <span className="text-muted-foreground">{item.user}</span>
                          {" · "}
                          <span className={item.positive ? "text-success" : "text-danger"}>{item.action}</span>
                          {" @ "}
                          <span className="font-mono">{item.price}¢</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.market}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── FAQ ────────────────────────────────────── */}
          <section className="py-16 md:py-20 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="grid md:grid-cols-2 gap-10 md:gap-16">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">FAQ</p>
                  <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Common questions</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    New to prediction markets? Here&apos;s what you need to know.
                  </p>
                </div>

                <div className="flex flex-col divide-y divide-border">
                  {FAQS.map((faq, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
                      >
                        <span className="text-sm font-medium group-hover:text-muted-foreground transition-colors">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                            openFaq === i && "rotate-180"
                          )}
                        />
                      </button>
                      {openFaq === i && (
                        <p className="text-xs text-muted-foreground leading-relaxed pb-4">{faq.a}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Trust strip ────────────────────────────── */}
          <section className="py-12 border-b border-border">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
                {[
                  { icon: Shield, label: "Transparent order book", sub: "All trades on-chain", color: "text-success" },
                  { icon: Zap, label: "Instant settlement", sub: "Winnings in seconds", color: "text-yellow-500" },
                  { icon: Users, label: "Community markets", sub: "Anyone can create", color: "text-info" },
                ].map(({ icon: Icon, label, sub, color }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center shrink-0">
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA Banner ─────────────────────────────── */}
          <section className="py-16 md:py-24">
            <div className="max-w-350 mx-auto px-4 lg:px-6">
              <div className="relative overflow-hidden rounded-xl border border-border bg-card p-10 md:p-16 text-center">
                <div className="blur-orb w-100 h-100 -top-25 left-1/2 -translate-x-1/2 bg-blue-500/6" />
                <div className="relative">
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                    Ready to trade?
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
                    Connect your Solana wallet and start predicting in under a minute.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild size="lg" className="h-10 px-6 text-sm font-medium bg-foreground text-background hover:bg-foreground/90">
                      <Link href="/markets">
                        Browse markets <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-10 px-6 text-sm font-medium border-border">
                      <Link href="/create-market">Create a market</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </PageTransition>

      <Footer />
    </div>
  );
};

export default Home;
