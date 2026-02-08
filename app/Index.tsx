'use client';

 import { useState, useEffect } from 'react';
 import { Header } from '@/components/Header';
 import { Footer } from '@/components/Footer';
 import { MarketCard } from '@/components/MarketCard';
 import { MarketCardSkeleton } from '@/components/MarketCardSkeleton';
 import { PageTransition } from '@/components/PageTransition';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { useStore } from '@/lib/store';
 import { ArrowRight, ChevronDown, Zap, TrendingUp } from 'lucide-react';
 import Link from 'next/link';
 import { cn } from '@/lib/utils';
 
 const Index = () => {
   const markets = useStore((state) => state.markets);
   const [statsVisible, setStatsVisible] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
 
   // Featured markets for bento layout
   const featuredMarkets = markets.slice(0, 5);
   
   // Trending markets (by volume)
   const trendingMarkets = [...markets].sort((a, b) => b.volume - a.volume).slice(0, 6);
 
   // Simulate loading
   useEffect(() => {
     const timer = setTimeout(() => setIsLoading(false), 800);
     return () => clearTimeout(timer);
   }, []);
 
   // Animate stats on scroll
   useEffect(() => {
     const observer = new IntersectionObserver(
       ([entry]) => {
         if (entry.isIntersecting) {
           setStatsVisible(true);
         }
       },
       { threshold: 0.1 }
     );
 
     const statsSection = document.getElementById('stats-section');
     if (statsSection) {
       observer.observe(statsSection);
     }
 
     return () => observer.disconnect();
   }, []);
 
   return (
     <div className="min-h-screen flex flex-col bg-background">
       <Header />
       
       <PageTransition>
         <main className="flex-1">
           {/* Hero Section */}
           <section className="relative overflow-hidden">
             {/* Animated Background */}
             <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
               <div className="blur-orb-success top-20 left-10 md:left-20 w-64 md:w-[500px] h-64 md:h-[500px]" />
               <div className="blur-orb-info bottom-20 right-10 md:right-20 w-64 md:w-[400px] h-64 md:h-[400px]" style={{ animationDelay: '2s' }} />
             </div>
             
             {/* Grid Pattern */}
             <div className="absolute inset-0 pattern-grid" />
             
             <div className="relative container mx-auto px-4 py-24 md:py-36 text-center">
               <Badge variant="default" className="mb-8">
                 <Zap className="h-4 w-4 text-success" />
                 <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                 Live prediction markets
               </Badge>
               
               <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold mb-8 tracking-tight">
                 Trade on Reality
               </h1>
               <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-light px-4">
                 Predict outcomes. Earn rewards. Shape truth.
               </p>
               
               <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 md:mb-20 px-4">
                 <Button size="lg" className="group h-14 px-10 text-base font-semibold w-full sm:w-auto" asChild>
                   <Link href="/markets">
                     Start Trading
                     <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                   </Link>
                 </Button>
                 <Button size="lg" variant="outline" className="h-14 px-10 text-base font-medium w-full sm:w-auto" asChild>
                   <Link href="/auth">Create Account</Link>
                 </Button>
               </div>
 
               <div className="flex justify-center">
                 <ChevronDown className="h-5 w-5 text-muted-foreground/50 animate-bounce" />
               </div>
             </div>
           </section>
 
           {/* Live Market Ticker */}
           <div className="border-y border-border/20 bg-muted/5 overflow-hidden">
             <div className="container mx-auto px-4 py-3 flex items-center gap-4">
               <div className="flex items-center gap-2 shrink-0">
                 <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                 <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Live</span>
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
                         {market.question.slice(0, 30)}...
                       </span>
                       <span className={cn(
                         "font-bold tabular-nums px-2 py-0.5 rounded-md text-xs",
                         market.yesPrice > 0.5 
                           ? "text-success bg-success/10" 
                           : "text-danger bg-danger/10"
                       )}>
                         {Math.round(market.yesPrice * 100)}%
                       </span>
                     </Link>
                   ))}
                 </div>
               </div>
             </div>
           </div>
 
           {/* Featured Markets */}
           <section className="py-16 md:py-24">
             <div className="container mx-auto px-4">
               <div className="flex items-end justify-between mb-10">
                 <div>
                   <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Featured Markets</h2>
                   <p className="text-muted-foreground">
                     The most popular predictions right now
                   </p>
                 </div>
                 <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                   <Link href="/markets">
                     View All
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </Link>
                 </Button>
               </div>
 
               {/* Bento Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                 {/* Large Featured Card */}
                 {isLoading ? (
                   <div className="lg:col-span-2 lg:row-span-2">
                     <MarketCardSkeleton featured />
                   </div>
                 ) : featuredMarkets[0] && (
                   <div className="lg:col-span-2 lg:row-span-2">
                     <MarketCard market={featuredMarkets[0]} featured />
                   </div>
                 )}
                 
                 {/* Side Cards */}
                 {isLoading ? (
                   Array.from({ length: 2 }).map((_, i) => (
                     <div key={i}>
                       <MarketCardSkeleton />
                     </div>
                   ))
                 ) : (
                   featuredMarkets.slice(1, 3).map((market) => (
                     <div key={market.id}>
                       <MarketCard market={market} />
                     </div>
                   ))
                 )}
               </div>
             </div>
           </section>
 
           {/* Trending Markets */}
           <section className="py-16 md:py-24 bg-muted/5">
             <div className="container mx-auto px-4">
               <div className="flex items-end justify-between mb-10">
                 <div>
                   <div className="flex items-center gap-2 mb-2">
                     <TrendingUp className="h-5 w-5 text-success" />
                     <span className="text-sm font-medium text-success uppercase tracking-wider">Trending</span>
                   </div>
                   <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Hot Markets</h2>
                 </div>
                 <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                   <Link href="/markets">
                     View All
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </Link>
                 </Button>
               </div>
 
               <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                 {isLoading ? (
                   Array.from({ length: 6 }).map((_, i) => (
                     <MarketCardSkeleton key={i} />
                   ))
                 ) : (
                   trendingMarkets.map((market, i) => (
                     <div 
                       key={market.id} 
                       className="stagger-in" 
                       style={{ animationDelay: `${i * 60}ms` }}
                     >
                       <MarketCard market={market} />
                     </div>
                   ))
                 )}
               </div>
             </div>
           </section>
 
           {/* Stats Section */}
           <section id="stats-section" className="py-16 md:py-24">
             <div className="container mx-auto px-4">
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                 {[
                   { value: '$2.4B', label: 'Total Volume' },
                   { value: '450K+', label: 'Active Traders' },
                   { value: '12K+', label: 'Markets Created' },
                 ].map((stat, i) => (
                   <div 
                     key={i} 
                     className="text-center p-8 rounded-2xl bg-muted/20 border border-border/20"
                   >
                     <div className={cn(
                       "text-4xl md:text-5xl font-bold tracking-tight mb-2 transition-all duration-1000",
                       statsVisible ? 'text-foreground' : 'text-muted-foreground'
                     )}>
                       {stat.value}
                     </div>
                     <div className="text-sm text-muted-foreground">{stat.label}</div>
                   </div>
                 ))}
               </div>
             </div>
           </section>
 
           {/* CTA Section */}
           <section className="py-16 md:py-24">
             <div className="container mx-auto px-4 text-center">
               <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                 Ready to start trading?
               </h2>
               <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                 Join thousands of traders predicting outcomes on real-world events.
               </p>
               <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <Button size="lg" asChild>
                   <Link href="/markets">
                     Explore Markets
                     <ArrowRight className="ml-2 h-4 w-4" />
                   </Link>
                 </Button>
                 <Button size="lg" variant="outline" asChild>
                   <Link href="/auth">Create Account</Link>
                 </Button>
               </div>
             </div>
           </section>
         </main>
       </PageTransition>
 
       <Footer />
     </div>
   );
 };
 
 export default Index;