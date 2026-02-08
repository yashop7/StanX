import { create } from 'zustand';

export interface Market {
  id: string;
  question: string;
  category: 'YouTube' | 'Streaming' | 'Movies' | 'Music' | 'Gaming' | 'TV Shows';
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: Date;
  participants: number;
  description: string;
  resolutionCriteria: string;
  priceHistory: { time: number; value: number }[];
  status: 'active' | 'resolved' | 'ending-soon';
  image: string;
  sourceUrl?: string;
  targetValue?: string;
}

export interface Order {
  id: string;
  marketId: string;
  userId: string;
  side: 'YES' | 'NO';
  type: 'limit' | 'market';
  price: number;  // 0-100 cents
  size: number;   // number of shares
  filled: number; // shares filled
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  createdAt: Date;
}

export interface Position {
  marketId: string;
  marketQuestion: string;
  type: 'YES' | 'NO';
  shares: number;
  entryPrice: number;
  currentPrice: number;
}

export interface UserAccount {
  id: string;
  walletAddress: string;
  freeBalance: number;   // Available to trade
  lockedBalance: number; // In open orders
  positions: Position[];
}

interface OrderBook {
  bids: Order[];  // Buy orders (sorted high to low)
  asks: Order[];  // Sell orders (sorted low to high)
}

interface StoreState {
  markets: Market[];
  positions: Position[];
  balance: number;
  lockedBalance: number;
  orders: Order[];
  orderBooks: Record<string, OrderBook>;
  
  // Market actions
  updateMarketPrice: (marketId: string, yesPrice: number) => void;
  
  // Order actions
  placeOrder: (order: Omit<Order, 'id' | 'createdAt' | 'filled' | 'status'>) => Order;
  cancelOrder: (orderId: string) => void;
  
  // Position actions
  addPosition: (position: Position) => void;
  
  // Balance actions
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
}

// Generate demo price history
const generatePriceHistory = (basePrice: number, points: number = 100) => {
  const history = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.5) * 0.05;
    price = Math.max(0.01, Math.min(0.99, price + change));
    history.push({
      time: now - (i * 3600000),
      value: price
    });
  }
  
  return history;
};

// Generate mock order book for a market
const generateOrderBook = (yesPrice: number): OrderBook => {
  const bids: Order[] = [];
  const asks: Order[] = [];
  const basePrice = Math.round(yesPrice * 100);
  
  // Generate 5 levels of bids (buy orders below current price)
  for (let i = 1; i <= 5; i++) {
    const price = Math.max(1, basePrice - i);
    bids.push({
      id: `bid-${i}`,
      marketId: '1',
      userId: 'maker-1',
      side: 'YES',
      type: 'limit',
      price,
      size: Math.floor(Math.random() * 500) + 100,
      filled: 0,
      status: 'open',
      createdAt: new Date()
    });
  }
  
  // Generate 5 levels of asks (sell orders above current price)
  for (let i = 1; i <= 5; i++) {
    const price = Math.min(99, basePrice + i);
    asks.push({
      id: `ask-${i}`,
      marketId: '1',
      userId: 'maker-2',
      side: 'YES',
      type: 'limit',
      price,
      size: Math.floor(Math.random() * 500) + 100,
      filled: 0,
      status: 'open',
      createdAt: new Date()
    });
  }
  
  return { bids, asks };
};

// Entertainment-focused demo markets
const demoMarkets: Market[] = [
  {
    id: '1',
    question: 'Will MrBeast hit 400M subscribers before 2026?',
    category: 'YouTube',
    yesPrice: 0.72,
    noPrice: 0.28,
    volume: 2850000,
    liquidity: 780000,
    endDate: new Date('2025-12-31'),
    participants: 8432,
    status: 'active',
    description: 'Market resolves YES if MrBeast\'s main YouTube channel reaches 400 million subscribers before January 1, 2026.',
    resolutionCriteria: 'Based on official YouTube subscriber count displayed on MrBeast\'s main channel.',
    priceHistory: generatePriceHistory(0.72),
    image: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&h=600&fit=crop',
    sourceUrl: 'https://youtube.com/@MrBeast',
    targetValue: '400000000'
  },
  {
    id: '2',
    question: 'Will Squid Game Season 3 release in 2025?',
    category: 'Streaming',
    yesPrice: 0.65,
    noPrice: 0.35,
    volume: 1920000,
    liquidity: 520000,
    endDate: new Date('2025-12-31'),
    participants: 5621,
    status: 'active',
    description: 'Resolves YES if Netflix releases Squid Game Season 3 globally before December 31, 2025.',
    resolutionCriteria: 'Must be officially released on Netflix platform worldwide.',
    priceHistory: generatePriceHistory(0.65),
    image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&h=600&fit=crop'
  },
  {
    id: '3',
    question: 'Will GTA 6 win Game of the Year 2025?',
    category: 'Gaming',
    yesPrice: 0.58,
    noPrice: 0.42,
    volume: 3200000,
    liquidity: 890000,
    endDate: new Date('2025-12-15'),
    participants: 12847,
    status: 'active',
    description: 'Market resolves YES if Grand Theft Auto 6 wins Game of the Year at The Game Awards 2025.',
    resolutionCriteria: 'Based on official The Game Awards ceremony results.',
    priceHistory: generatePriceHistory(0.58),
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCcRhliiRTLN3l-E4-xjOhVZmuhdie7sZB1A&s'
  },
  {
    id: '4',
    question: 'Will Taylor Swift announce a new album in 2025?',
    category: 'Music',
    yesPrice: 0.81,
    noPrice: 0.19,
    volume: 1680000,
    liquidity: 450000,
    endDate: new Date('2025-12-31'),
    participants: 7234,
    status: 'active',
    description: 'Resolves YES if Taylor Swift officially announces a new studio album (not re-recording) in 2025.',
    resolutionCriteria: 'Must be official announcement from Taylor Swift or her label.',
    priceHistory: generatePriceHistory(0.81),
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'
  },
  {
    id: '5',
    question: 'Will PewDiePie return to regular uploads in 2025?',
    category: 'YouTube',
    yesPrice: 0.23,
    noPrice: 0.77,
    volume: 890000,
    liquidity: 280000,
    endDate: new Date('2025-12-31'),
    participants: 4521,
    status: 'active',
    description: 'Market resolves YES if PewDiePie uploads at least 10 videos per month for 3 consecutive months in 2025.',
    resolutionCriteria: 'Based on videos published on PewDiePie\'s main YouTube channel.',
    priceHistory: generatePriceHistory(0.23),
    image: 'https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=800&h=600&fit=crop',
    sourceUrl: 'https://youtube.com/@PewDiePie'
  },
  {
    id: '6',
    question: 'Will Avatar 3 gross over $2B worldwide?',
    category: 'Movies',
    yesPrice: 0.67,
    noPrice: 0.33,
    volume: 2100000,
    liquidity: 620000,
    endDate: new Date('2026-06-30'),
    participants: 6892,
    status: 'active',
    description: 'Resolves YES if Avatar: Fire and Ash grosses over $2 billion at the worldwide box office.',
    resolutionCriteria: 'Based on Box Office Mojo or official Disney/20th Century reports.',
    priceHistory: generatePriceHistory(0.67),
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=600&fit=crop'
  },
  {
    id: '7',
    question: 'Will IShowSpeed hit 50M YouTube subs by June 2025?',
    category: 'YouTube',
    yesPrice: 0.54,
    noPrice: 0.46,
    volume: 1340000,
    liquidity: 380000,
    endDate: new Date('2025-06-30'),
    participants: 5123,
    status: 'active',
    description: 'Market resolves YES if IShowSpeed\'s main YouTube channel reaches 50 million subscribers before July 1, 2025.',
    resolutionCriteria: 'Based on official YouTube subscriber count.',
    priceHistory: generatePriceHistory(0.54),
    image: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&h=600&fit=crop',
    sourceUrl: 'https://youtube.com/@IShowSpeed',
    targetValue: '50000000'
  },
  {
    id: '8',
    question: 'Will Stranger Things finale break Netflix viewing records?',
    category: 'TV Shows',
    yesPrice: 0.78,
    noPrice: 0.22,
    volume: 1560000,
    liquidity: 420000,
    endDate: new Date('2025-12-31'),
    participants: 4892,
    status: 'ending-soon',
    description: 'Resolves YES if Stranger Things Season 5 premiere becomes the most-watched Netflix premiere in first 7 days.',
    resolutionCriteria: 'Based on official Netflix viewership data releases.',
    priceHistory: generatePriceHistory(0.78),
    image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&h=600&fit=crop'
  },
  {
    id: '9',
    question: 'Will Drake release Certified Lover Boy 2 in 2025?',
    category: 'Music',
    yesPrice: 0.41,
    noPrice: 0.59,
    volume: 920000,
    liquidity: 290000,
    endDate: new Date('2025-12-31'),
    participants: 3456,
    status: 'active',
    description: 'Market resolves YES if Drake releases a sequel album titled "Certified Lover Boy 2" or similar in 2025.',
    resolutionCriteria: 'Must be officially released on streaming platforms.',
    priceHistory: generatePriceHistory(0.41),
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop'
  },
  {
    id: '10',
    question: 'Will Kai Cenat break his own streaming record in 2025?',
    category: 'Streaming',
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 1180000,
    liquidity: 340000,
    endDate: new Date('2025-12-31'),
    participants: 6234,
    status: 'active',
    description: 'Resolves YES if Kai Cenat breaks his own peak concurrent viewer record on Twitch during 2025.',
    resolutionCriteria: 'Based on Twitch Tracker or official Twitch statistics.',
    priceHistory: generatePriceHistory(0.62),
    image: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=800&h=600&fit=crop'
  }
];

// Generate order books for each market
const initialOrderBooks: Record<string, OrderBook> = {};
demoMarkets.forEach(market => {
  initialOrderBooks[market.id] = generateOrderBook(market.yesPrice);
});

export const useStore = create<StoreState>((set, get) => ({
  markets: demoMarkets,
  positions: [],
  balance: 10000,
  lockedBalance: 0,
  orders: [],
  orderBooks: initialOrderBooks,
  
  updateMarketPrice: (marketId, yesPrice) => set((state) => ({
    markets: state.markets.map(m => 
      m.id === marketId 
        ? { ...m, yesPrice, noPrice: 1 - yesPrice }
        : m
    )
  })),
  
  placeOrder: (orderData) => {
    const order: Order = {
      ...orderData,
      id: `order-${Date.now()}`,
      filled: 0,
      status: 'open',
      createdAt: new Date()
    };
    
    set((state) => {
      const orderCost = order.price * order.size / 100;
      
      if (state.balance < orderCost) {
        return state;
      }
      
      return {
        orders: [...state.orders, order],
        balance: state.balance - orderCost,
        lockedBalance: state.lockedBalance + orderCost
      };
    });
    
    return order;
  },
  
  cancelOrder: (orderId) => set((state) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'open') return state;
    
    const refund = (order.size - order.filled) * order.price / 100;
    
    return {
      orders: state.orders.map(o => 
        o.id === orderId ? { ...o, status: 'cancelled' as const } : o
      ),
      balance: state.balance + refund,
      lockedBalance: state.lockedBalance - refund
    };
  }),
  
  addPosition: (position) => set((state) => ({
    positions: [...state.positions, position],
    balance: state.balance - (position.shares * position.entryPrice)
  })),
  
  deposit: (amount) => set((state) => ({
    balance: state.balance + amount
  })),
  
  withdraw: (amount) => {
    const state = get();
    if (state.balance < amount) return false;
    
    set({ balance: state.balance - amount });
    return true;
  }
}));
