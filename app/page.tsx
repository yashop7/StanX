"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { 
  ArrowRight, 
  Clapperboard, 
  TrendingUp, 
  Users, 
  Zap,
  Play,
  BookOpen,
  Shield
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const Home = () => {
  const markets = useStore((state) => state.markets);
  const [isLoading, setIsLoading] = useState(true);

  // Featured markets for hero
  const featuredMarkets = markets.slice(0, 3);

  // Trending markets (by volume)
  const trendingMarkets = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <PageTransition>
        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/8 to-transparent rounded-full blur-3xl animate-pulse-subtle" />
              <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-blue-500/8 to-transparent rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: "2s" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-success/5 to-transparent rounded-full blur-3xl" />
            </div>

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(128,128,128,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,128,128,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

            <div className="relative container mx-auto px-4 pt-20 pb-32 md:pt-32 md:pb-40">
              {/* Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Central Limit Order Book • Live Markets
                </div>
              </div>

              {/* Main Headline */}
              <div className="text-center max-w-5xl mx-auto mb-10">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
                  <span className="block">Predict the Future of</span>
                  <span className="block bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
                    Entertainment
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                  Trade on YouTube milestones, streaming records, box office hits, and gaming events. 
                  Powered by a transparent order book.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <Button
                  size="lg"
                  className="group h-14 px-8 text-base font-semibold w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
                  asChild
                >
                  <Link href="/markets">
                    <Play className="mr-2 h-4 w-4" />
                    Start Trading
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base font-medium w-full sm:w-auto border-border/50 hover:bg-muted/50"
                  asChild
                >
                  <Link href="#how-it-works">
                    <BookOpen className="mr-2 h-4 w-4" />
                    How It Works
                  </Link>
                </Button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                {[
                  { value: "$4.2M", label: "Trading Volume" },
                  { value: "28K+", label: "Active Traders" },
                  { value: "150+", label: "Live Markets" },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Live Ticker */}
          <div className="border-y border-border/30 bg-muted/20 overflow-hidden">
            <div className="container mx-auto px-4 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Live
                </span>
              </div>
              <div className="overflow-hidden flex-1">
                <div className="flex gap-8 animate-scroll whitespace-nowrap">
                  {[...markets, ...markets].slice(0, 16).map((market, idx) => (
                    <Link
                      key={`${market.id}-${idx}`}
                      href={`/market/${market.id}`}
                      className="flex items-center gap-2.5 shrink-0 text-sm group"
                    >
                      <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {market.question.slice(0, 35)}...
                      </span>
                      <span
                        className={cn(
                          "font-bold tabular-nums px-2 py-0.5 rounded-md text-xs",
                          market.yesPrice > 0.5
                            ? "text-success bg-success/10"
                            : "text-danger bg-danger/10"
                        )}
                      >
                        {Math.round(market.yesPrice * 100)}%
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Featured Markets */}
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500 uppercase tracking-wider">
                      Featured
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Hot Markets Right Now
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hidden sm:flex text-muted-foreground hover:text-foreground"
                >
                  <Link href="/markets">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <MarketCardSkeleton key={i} />
                    ))
                  : featuredMarkets.map((market, i) => (
                      <div
                        key={market.id}
                        className="stagger-in"
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <MarketCard market={market} />
                      </div>
                    ))}
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section id="how-it-works" className="py-20 md:py-28 bg-muted/30 border-y border-border/20">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                  How Finwe Works
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Trade predictions using our transparent Central Limit Order Book system.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  {
                    icon: Clapperboard,
                    title: "Pick a Market",
                    description: "Browse entertainment markets from YouTube milestones to box office predictions.",
                    color: "text-purple-500",
                    bg: "bg-purple-500/10"
                  },
                  {
                    icon: TrendingUp,
                    title: "Place Your Order",
                    description: "Buy YES or NO shares on the order book. Set limit orders or trade at market price.",
                    color: "text-success",
                    bg: "bg-success/10"
                  },
                  {
                    icon: Users,
                    title: "Win on Resolution",
                    description: "When the event resolves, winning shares pay out $1 each. Lose and shares go to zero.",
                    color: "text-blue-500",
                    bg: "bg-blue-500/10"
                  },
                ].map((step, i) => (
                  <div key={i} className="panel-card p-6 text-center stagger-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5", step.bg)}>
                      <step.icon className={cn("h-7 w-7", step.color)} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Trending Markets */}
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success uppercase tracking-wider">
                      Trending
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Highest Volume Markets
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hidden sm:flex text-muted-foreground hover:text-foreground"
                >
                  <Link href="/markets">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <MarketCardSkeleton key={i} />
                    ))
                  : trendingMarkets.map((market, i) => (
                      <div
                        key={market.id}
                        className="stagger-in"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <MarketCard market={market} />
                      </div>
                    ))}
              </div>
            </div>
          </section>

          {/* Trust Section */}
          <section className="py-16 border-t border-border/20">
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center md:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Transparent Order Book</div>
                    <div className="text-xs text-muted-foreground">All trades visible on-chain</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Instant Settlement</div>
                    <div className="text-xs text-muted-foreground">Winnings paid immediately</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Community Driven</div>
                    <div className="text-xs text-muted-foreground">Create your own markets</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 md:py-28">
            <div className="container mx-auto px-4">
              <div className="panel-card p-10 md:p-16 text-center max-w-3xl mx-auto">
                <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
                  Ready to start trading?
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Join thousands of traders predicting the future of entertainment.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="h-12 px-8" asChild>
                    <Link href="/markets">
                      Explore Markets
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8" asChild>
                    <Link href="/auth">Create Account</Link>
                  </Button>
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
