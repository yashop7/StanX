import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OrderBookProps {
  yesPrice: number;
  noPrice: number;
}

interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

// Generate mock order book data
const generateOrders = (basePrice: number, count: number, isAsk: boolean): OrderLevel[] => {
  const orders: OrderLevel[] = [];
  let cumulative = 0;
  
  for (let i = 0; i < count; i++) {
    const priceOffset = (i + 1) * (isAsk ? 0.01 : -0.01);
    const price = Math.max(0.01, Math.min(0.99, basePrice + priceOffset));
    const size = Math.floor(Math.random() * 5000) + 500;
    cumulative += size;
    
    orders.push({
      price: Math.round(price * 100) / 100,
      size,
      total: cumulative
    });
  }
  
  return isAsk ? orders : orders.reverse();
};

export const OrderBook = ({ yesPrice, noPrice }: OrderBookProps) => {
  const [asks, setAsks] = useState<OrderLevel[]>([]);
  const [bids, setBids] = useState<OrderLevel[]>([]);
  const [flashingRow, setFlashingRow] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const midPrice = (yesPrice + (1 - noPrice)) / 2;
  const spread = Math.abs(yesPrice - (1 - noPrice));
  const spreadPercent = (spread / midPrice * 100).toFixed(2);

  useEffect(() => {
    setAsks(generateOrders(yesPrice, 6, true));
    setBids(generateOrders(yesPrice, 6, false));
  }, [yesPrice]);

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      const isAsk = Math.random() > 0.5;
      const rowIndex = Math.floor(Math.random() * 6);
      const key = `${isAsk ? 'ask' : 'bid'}-${rowIndex}`;
      
      setFlashingRow(key);
      setTimeout(() => setFlashingRow(null), 150);

      if (isAsk) {
        setAsks(prev => {
          const newAsks = [...prev];
          if (newAsks[rowIndex]) {
            newAsks[rowIndex] = {
              ...newAsks[rowIndex],
              size: Math.max(100, newAsks[rowIndex].size + Math.floor(Math.random() * 500 - 250))
            };
          }
          return newAsks;
        });
      } else {
        setBids(prev => {
          const newBids = [...prev];
          if (newBids[rowIndex]) {
            newBids[rowIndex] = {
              ...newBids[rowIndex],
              size: Math.max(100, newBids[rowIndex].size + Math.floor(Math.random() * 500 - 250))
            };
          }
          return newBids;
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const maxTotal = Math.max(
    ...asks.map(a => a.total),
    ...bids.map(b => b.total)
  );

  const formatSize = (size: number) => {
    if (size >= 1000) return `${(size / 1000).toFixed(1)}K`;
    return size.toString();
  };

  return (
    <div className="rounded-2xl border border-border/30 dark:border-border/20 bg-card dark:bg-gradient-to-b dark:from-[hsl(240,6%,8%)] dark:to-[hsl(240,6%,5%)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30 dark:border-border/15">
        <h3 className="text-sm font-semibold text-foreground">Order Book</h3>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-3 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/20 dark:border-border/10 bg-muted/10 dark:bg-muted/5">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sellers) - Red */}
      <div className="relative">
        {asks.slice().reverse().map((ask, idx) => {
          const actualIdx = asks.length - 1 - idx;
          const depthPercent = (ask.total / maxTotal) * 100;
          const isFlashing = flashingRow === `ask-${actualIdx}`;
          const isHovered = hoveredRow === `ask-${idx}`;
          
          return (
            <div
              key={`ask-${idx}`}
              onMouseEnter={() => setHoveredRow(`ask-${idx}`)}
              onMouseLeave={() => setHoveredRow(null)}
              className={cn(
                "relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer",
                isHovered && "bg-red-500/5",
                isFlashing && "bg-red-500/15"
              )}
            >
              {/* Depth Bar - Very subtle */}
              <div 
                className="absolute right-0 top-0 bottom-0 bg-red-500/[0.06] transition-all duration-300"
                style={{ width: `${depthPercent}%` }}
              />
              
              <span className="relative z-10 font-mono text-red-400 font-medium">
                {(ask.price * 100).toFixed(1)}¢
              </span>
              <span className={cn(
                "relative z-10 text-right font-mono transition-colors",
                isHovered ? "text-foreground" : "text-muted-foreground"
              )}>
                {formatSize(ask.size)}
              </span>
              <span className="relative z-10 text-right font-mono text-muted-foreground/60">
                {formatSize(ask.total)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Price & Spread - Thin divider */}
      <div className="px-5 py-3 bg-muted/15 dark:bg-muted/5 border-y border-border/20 dark:border-border/10">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground font-mono">
              {(midPrice * 100).toFixed(2)}¢
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Mid</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Spread</span>
            <span className="text-xs font-mono font-medium text-foreground">{spreadPercent}%</span>
          </div>
        </div>
      </div>

      {/* Bids (Buyers) - Green */}
      <div className="relative">
        {bids.map((bid, idx) => {
          const depthPercent = (bid.total / maxTotal) * 100;
          const isFlashing = flashingRow === `bid-${idx}`;
          const isHovered = hoveredRow === `bid-${idx}`;
          
          return (
            <div
              key={`bid-${idx}`}
              onMouseEnter={() => setHoveredRow(`bid-${idx}`)}
              onMouseLeave={() => setHoveredRow(null)}
              className={cn(
                "relative grid grid-cols-3 px-5 py-2 text-xs transition-all duration-100 cursor-pointer",
                isHovered && "bg-emerald-500/5",
                isFlashing && "bg-emerald-500/15"
              )}
            >
              {/* Depth Bar - Very subtle */}
              <div 
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/[0.06] transition-all duration-300"
                style={{ width: `${depthPercent}%` }}
              />
              
              <span className="relative z-10 font-mono text-emerald-400 font-medium">
                {(bid.price * 100).toFixed(1)}¢
              </span>
              <span className={cn(
                "relative z-10 text-right font-mono transition-colors",
                isHovered ? "text-foreground" : "text-muted-foreground"
              )}>
                {formatSize(bid.size)}
              </span>
              <span className="relative z-10 text-right font-mono text-muted-foreground/60">
                {formatSize(bid.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};