// Shared TypeScript types and interfaces

export interface Market {
  id: string;
  question: string;
  totalVolume: number;
  endTime: Date;
}

export interface User {
  publicKey: string;
  balance: number;
}
