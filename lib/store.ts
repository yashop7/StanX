import { create } from 'zustand';

export interface Market {
  id: string;
  question: string;
  category: 'Politics' | 'Sports' | 'Crypto' | 'Entertainment' | 'Science' | 'Technology';
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
}

export interface Position {
  marketId: string;
  marketQuestion: string;
  type: 'YES' | 'NO';
  shares: number;
  entryPrice: number;
  currentPrice: number;
}

interface StoreState {
  markets: Market[];
  positions: Position[];
  balance: number;
  addPosition: (position: Position) => void;
  updateMarketPrice: (marketId: string, yesPrice: number) => void;
}

// Generate demo price history
const generatePriceHistory = (basePrice: number, points: number = 100) => {
  const history = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = points; i >= 0; i--) {
    const change = (Math.random() - 0.5) * 0.05; // ±5% volatility
    price = Math.max(0.01, Math.min(0.99, price + change));
    history.push({
      time: now - (i * 3600000), // 1 hour intervals
      value: price
    });
  }
  
  return history;
};

// Demo markets data
const demoMarkets: Market[] = [
  {
    id: '1',
    question: 'Will Bitcoin reach $100,000 by end of 2025?',
    category: 'Crypto',
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 1250000,
    liquidity: 450000,
    endDate: new Date('2025-12-31'),
    participants: 2847,
    status: 'active',
    description: 'Market resolves YES if Bitcoin (BTC) trades at or above $100,000 on any major exchange before December 31, 2025, 11:59 PM UTC.',
    resolutionCriteria: 'Will use CoinGecko and Coinbase as primary sources. Must reach $100,000 on at least one major exchange.',
    priceHistory: generatePriceHistory(0.62),
    image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop'
  },
  {
    id: '2',
    question: 'Will Democrats win the 2024 Presidential Election?',
    category: 'Politics',
    yesPrice: 0.48,
    noPrice: 0.52,
    volume: 3400000,
    liquidity: 890000,
    endDate: new Date('2024-11-05'),
    participants: 12453,
    status: 'active',
    description: 'Market resolves YES if the Democratic Party candidate wins the 2024 U.S. Presidential Election.',
    resolutionCriteria: 'Resolves based on official Electoral College results. Will resolve once winner is certified.',
    priceHistory: generatePriceHistory(0.48),
    image: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&h=600&fit=crop'
  },
  {
    id: '3',
    question: 'Will AI surpass human performance in coding by 2026?',
    category: 'Technology',
    yesPrice: 0.35,
    noPrice: 0.65,
    volume: 680000,
    liquidity: 230000,
    endDate: new Date('2026-12-31'),
    participants: 1523,
    status: 'active',
    description: 'Resolves YES if any AI system can beat the median human software engineer on standardized coding tests.',
    resolutionCriteria: 'Will use benchmarks from HumanEval, LeetCode, and industry standard assessments.',
    priceHistory: generatePriceHistory(0.35),
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop'
  },
  {
    id: '4',
    question: 'Will SpaceX successfully land humans on Mars before 2030?',
    category: 'Science',
    yesPrice: 0.23,
    noPrice: 0.77,
    volume: 920000,
    liquidity: 310000,
    endDate: new Date('2030-12-31'),
    participants: 3421,
    status: 'active',
    description: 'Market resolves YES if SpaceX successfully lands a crewed mission on Mars surface before January 1, 2030.',
    resolutionCriteria: 'Requires official confirmation from SpaceX and NASA. Crew must survive landing.',
    priceHistory: generatePriceHistory(0.23),
    image: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800&h=600&fit=crop'
  },
  {
    id: '5',
    question: 'Will the Lakers win the 2025 NBA Championship?',
    category: 'Sports',
    yesPrice: 0.18,
    noPrice: 0.82,
    volume: 1100000,
    liquidity: 380000,
    endDate: new Date('2025-06-30'),
    participants: 4892,
    status: 'active',
    description: 'Resolves YES if Los Angeles Lakers win the 2024-2025 NBA Championship.',
    resolutionCriteria: 'Based on official NBA Finals results. Must win the championship series.',
    priceHistory: generatePriceHistory(0.18),
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop'
  },
  {
    id: '6',
    question: 'Will Ethereum switch to a new consensus mechanism in 2025?',
    category: 'Crypto',
    yesPrice: 0.12,
    noPrice: 0.88,
    volume: 540000,
    liquidity: 180000,
    endDate: new Date('2025-12-31'),
    participants: 892,
    status: 'active',
    description: 'Market resolves YES if Ethereum mainnet implements a consensus mechanism change beyond current PoS.',
    resolutionCriteria: 'Must be official Ethereum Foundation announcement and deployment to mainnet.',
    priceHistory: generatePriceHistory(0.12),
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=600&fit=crop'
  },
  {
    id: '7',
    question: 'Will global average temperature increase by 1.5°C above pre-industrial levels?',
    category: 'Science',
    yesPrice: 0.71,
    noPrice: 0.29,
    volume: 780000,
    liquidity: 260000,
    endDate: new Date('2025-12-31'),
    participants: 2134,
    status: 'active',
    description: 'Resolves YES if IPCC or NOAA confirms 1.5°C warming threshold has been crossed.',
    resolutionCriteria: 'Based on official IPCC annual reports and NOAA climate data.',
    priceHistory: generatePriceHistory(0.71),
    image: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&h=600&fit=crop'
  },
  {
    id: '8',
    question: 'Will Apple release an AI-powered Mac by end of 2024?',
    category: 'Technology',
    yesPrice: 0.89,
    noPrice: 0.11,
    volume: 1680000,
    liquidity: 520000,
    endDate: new Date('2024-12-31'),
    participants: 6234,
    status: 'ending-soon',
    description: 'Market resolves YES if Apple announces and releases a Mac with dedicated AI processing chip.',
    resolutionCriteria: 'Must be officially released and available for purchase. AI features must be prominently marketed.',
    priceHistory: generatePriceHistory(0.89),
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop'
  }
];

export const useStore = create<StoreState>((set) => ({
  markets: demoMarkets,
  positions: [],
  balance: 10000,
  
  addPosition: (position) => set((state) => ({
    positions: [...state.positions, position],
    balance: state.balance - (position.shares * position.entryPrice)
  })),
  
  updateMarketPrice: (marketId, yesPrice) => set((state) => ({
    markets: state.markets.map(m => 
      m.id === marketId 
        ? { ...m, yesPrice, noPrice: 1 - yesPrice }
        : m
    )
  }))
}));
