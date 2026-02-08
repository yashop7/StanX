'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/PageTransition';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  StatsCardSkeleton, 
  ChartSkeleton, 
  AllocationSkeleton, 
  PositionSkeleton 
} from '@/components/PortfolioCardSkeleton';
import { 
  TrendingUp, 
  Wallet,
  Target,
  Activity,
  ArrowUpRight,
  ChevronRight,
  X,
  Clock,
  ArrowDownUp,
  History,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { useStore } from '@/lib/store';

const performanceData = [
  { date: 'Jan', pnl: 1200 },
  { date: 'Feb', pnl: 1900 },
  { date: 'Mar', pnl: 2300 },
  { date: 'Apr', pnl: 2100 },
  { date: 'May', pnl: 2800 },
  { date: 'Jun', pnl: 3400 },
];

const allocationData = [
  { name: 'YouTube', value: 35, color: 'hsl(0, 72%, 51%)' },
  { name: 'Streaming', value: 25, color: 'hsl(280, 87%, 65%)' },
  { name: 'Gaming', value: 20, color: 'hsl(142, 76%, 46%)' },
  { name: 'Movies', value: 12, color: 'hsl(38, 92%, 50%)' },
  { name: 'Music', value: 8, color: 'hsl(330, 81%, 60%)' },
];

const positions = [
  {
    id: '1',
    market: 'Will MrBeast hit 400M subscribers before 2026?',
    side: 'YES',
    shares: 250,
    entryPrice: 0.65,
    currentPrice: 0.72,
    pnl: 175.00,
    pnlPercent: 10.8,
    image: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100&h=100&fit=crop'
  },
  {
    id: '3',
    market: 'Will GTA 6 win Game of the Year 2025?',
    side: 'YES',
    shares: 180,
    entryPrice: 0.52,
    currentPrice: 0.58,
    pnl: 108.00,
    pnlPercent: 11.5,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCcRhliiRTLN3l-E4-xjOhVZmuhdie7sZB1A&s'
  },
  {
    id: '4',
    market: 'Will Taylor Swift announce a new album in 2025?',
    side: 'NO',
    shares: 120,
    entryPrice: 0.22,
    currentPrice: 0.19,
    pnl: 36.00,
    pnlPercent: 13.6,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop'
  },
];

const openOrders = [
  {
    id: 'order-1',
    marketId: '1',
    market: 'Will MrBeast hit 400M subscribers before 2026?',
    side: 'YES',
    type: 'limit',
    price: 68,
    size: 100,
    filled: 0,
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'order-2',
    marketId: '2',
    market: 'Will Squid Game Season 3 release in 2025?',
    side: 'NO',
    type: 'limit',
    price: 38,
    size: 75,
    filled: 25,
    createdAt: new Date(Date.now() - 7200000),
  },
];

const tradeHistory = [
  {
    id: 'trade-1',
    market: 'Will PewDiePie return to regular uploads?',
    side: 'NO',
    action: 'BUY',
    price: 77,
    shares: 150,
    total: 115.50,
    time: new Date(Date.now() - 86400000),
    status: 'filled',
  },
  {
    id: 'trade-2',
    market: 'Will Avatar 3 gross over $2B worldwide?',
    side: 'YES',
    action: 'SELL',
    price: 69,
    shares: 80,
    total: 55.20,
    time: new Date(Date.now() - 172800000),
    status: 'filled',
  },
  {
    id: 'trade-3',
    market: 'Will Kai Cenat break his streaming record?',
    side: 'YES',
    action: 'BUY',
    price: 58,
    shares: 200,
    total: 116.00,
    time: new Date(Date.now() - 259200000),
    status: 'filled',
  },
];

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg px-3 py-2 bg-card border border-border/50 shadow-xl">
        <div className="text-xs text-muted-foreground">{payload[0].payload.date}</div>
        <div className="font-semibold text-success">${payload[0].value?.toLocaleString()}</div>
      </div>
    );
  }
  return null;
};

export default function Portfolio() {
  const [isLoading, setIsLoading] = useState(true);
  const balance = useStore((state) => state.balance);
  const lockedBalance = useStore((state) => state.lockedBalance);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      toast.success('Portfolio loaded successfully', {
        description: 'Your positions are up to date'
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleCancelOrder = (orderId: string) => {
    toast.success('Order cancelled', {
      description: 'Your order has been removed from the book'
    });
  };

  const handleSell = (marketName: string) => {
    toast.success('Order placed', {
      description: `Sell order for ${marketName} submitted`
    });
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <div className="h-8 w-32 rounded skeleton-shimmer mb-2" />
            <div className="h-4 w-64 rounded skeleton-shimmer" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <ChartSkeleton />
            </div>
            <AllocationSkeleton />
          </div>

          <div className="panel-card p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <PositionSkeleton key={i} />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <PageTransition>
        <main className="flex-1 container mx-auto px-4 py-8 pt-12 max-w-7xl">
          {/* Page Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Portfolio</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Track performance and manage your positions
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { 
                label: 'Available Balance', 
                value: `$${balance.toLocaleString()}`, 
                change: `$${lockedBalance.toLocaleString()} locked`, 
                positive: true,
                icon: Wallet,
              },
              { 
                label: 'Total P&L', 
                value: '+$2,847', 
                change: '+28.4% all time', 
                positive: true,
                icon: TrendingUp,
                valueClass: 'text-success',
              },
              { 
                label: 'Win Rate', 
                value: '67.3%', 
                change: '42/62 trades', 
                positive: true,
                icon: Target,
              },
              { 
                label: 'Open Orders', 
                value: openOrders.length.toString(), 
                change: `${positions.length} positions`, 
                positive: true,
                icon: Activity,
              },
            ].map((stat, i) => (
              <div 
                key={i} 
                className="panel-card p-5 stagger-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className={cn("text-2xl md:text-3xl font-bold tracking-tight", stat.valueClass)}>
                  {stat.value}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {stat.positive && stat.label === 'Available Balance' && (
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    stat.label === 'Total P&L' ? "text-success" : "text-muted-foreground"
                  )}>
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Performance Chart */}
            <div className="lg:col-span-2 panel-card stagger-in" style={{ animationDelay: '320ms' }}>
              <div className="panel-header flex items-center justify-between">
                <h3 className="text-base font-semibold">Performance</h3>
                <Tabs defaultValue="30d">
                  <TabsList className="h-8 p-1 bg-muted/30 border border-border/30">
                    <TabsTrigger value="7d" className="text-xs px-3 h-6">7D</TabsTrigger>
                    <TabsTrigger value="30d" className="text-xs px-3 h-6">30D</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="p-5">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                        width={50}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="pnl" 
                        stroke="hsl(142, 76%, 46%)" 
                        fillOpacity={1} 
                        fill="url(#colorPnL)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Allocation */}
            <div className="panel-card stagger-in" style={{ animationDelay: '400ms' }}>
              <div className="panel-header">
                <h3 className="text-base font-semibold">Allocation</h3>
              </div>
              <div className="p-5">
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                  {allocationData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      <span className="text-xs font-semibold ml-auto tabular-nums">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Open Orders */}
          <div className="panel-card mb-6 stagger-in" style={{ animationDelay: '480ms' }}>
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4 text-purple-400" />
                <h3 className="text-base font-semibold">Open Orders</h3>
                <span className="text-xs text-muted-foreground">({openOrders.length})</span>
              </div>
            </div>
            <div className="p-5">
              {openOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No open orders</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Place limit orders to see them here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {openOrders.map((order, i) => (
                    <div 
                      key={order.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/10 hover:border-border/30 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm line-clamp-1">{order.market}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            order.side === 'YES' 
                              ? 'bg-success/10 text-success' 
                              : 'bg-danger/10 text-danger'
                          )}>
                            {order.side}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Limit @ {order.price}¢
                          </span>
                          <span className="text-xs text-muted-foreground/50">•</span>
                          <span className="text-xs text-muted-foreground">
                            {order.filled}/{order.size} filled
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold tabular-nums">
                          ${((order.size * order.price) / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeAgo(order.createdAt)}
                        </div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleCancelOrder(order.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Positions */}
          <div className="panel-card mb-6 stagger-in" style={{ animationDelay: '560ms' }}>
            <div className="panel-header flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Active Positions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{positions.length} open trades</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                View All
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            <div className="p-5 space-y-2">
              {positions.map((position, i) => (
                <Link 
                  key={position.id}
                  href={`/market/${position.id}`}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/30 transition-all duration-200"
                >
                  {/* Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img 
                      src={position.image} 
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Market Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-1 group-hover:text-foreground/80 transition-colors">
                      {position.market}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        position.side === 'YES' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-danger/10 text-danger'
                      )}>
                        {position.shares} {position.side}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @ {(position.entryPrice * 100).toFixed(0)}¢
                      </span>
                      <span className="text-xs text-muted-foreground/50">→</span>
                      <span className="text-xs font-semibold">
                        {(position.currentPrice * 100).toFixed(0)}¢
                      </span>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="text-right shrink-0">
                    <div className={cn(
                      "text-sm font-bold tabular-nums",
                      position.pnl > 0 ? "text-success" : "text-danger"
                    )}>
                      {position.pnl > 0 ? '+' : ''}${Math.abs(position.pnl).toFixed(0)}
                    </div>
                    <div className={cn(
                      "text-xs font-medium tabular-nums",
                      position.pnlPercent > 0 ? "text-success/70" : "text-danger/70"
                    )}>
                      {position.pnlPercent > 0 ? '+' : ''}{position.pnlPercent}%
                    </div>
                  </div>

                  {/* Actions */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      handleSell(position.market);
                    }}
                    className={cn(
                      "h-8 px-4 opacity-0 group-hover:opacity-100 transition-all hidden sm:flex",
                      "border-danger/30 text-danger hover:bg-danger/10 hover:border-danger/50"
                    )}
                  >
                    Sell
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          {/* Trade History */}
          <div className="panel-card stagger-in" style={{ animationDelay: '640ms' }}>
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-purple-400" />
                <h3 className="text-base font-semibold">Trade History</h3>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                Export
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {tradeHistory.map((trade) => (
                  <div 
                    key={trade.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/10 border border-border/10"
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      trade.action === 'BUY' ? 'bg-success/10' : 'bg-danger/10'
                    )}>
                      {trade.status === 'filled' ? (
                        <CheckCircle2 className={cn(
                          "h-4 w-4",
                          trade.action === 'BUY' ? 'text-success' : 'text-danger'
                        )} />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm line-clamp-1">{trade.market}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "text-xs font-semibold",
                          trade.action === 'BUY' ? 'text-success' : 'text-danger'
                        )}>
                          {trade.action}
                        </span>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          trade.side === 'YES' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-danger/10 text-danger'
                        )}>
                          {trade.side}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {trade.shares} @ {trade.price}¢
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums">${trade.total.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeAgo(trade.time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}
