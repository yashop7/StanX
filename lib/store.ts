import { create } from 'zustand';

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
  freeBalance: number;
  lockedBalance: number;
  positions: Position[];
}

interface StoreState {
  positions: Position[];
  balance: number;
  lockedBalance: number;
  orders: Order[];

  // Order actions
  placeOrder: (order: Omit<Order, 'id' | 'createdAt' | 'filled' | 'status'>) => Order;
  cancelOrder: (orderId: string) => void;

  // Position actions
  addPosition: (position: Position) => void;

  // Balance actions
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
}

export const useStore = create<StoreState>((set, get) => ({
  positions: [],
  balance: 10000,
  lockedBalance: 0,
  orders: [],

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
      if (state.balance < orderCost) return state;
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

