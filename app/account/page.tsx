'use client';

import { Header } from '@/components/Header';
import { PageTransition } from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react';

export default function Account() {
  const balance = useStore((state) => state.balance);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <PageTransition>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Account</h1>
          <p className="text-muted-foreground">
            Manage your wallet and transactions
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Balance Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Wallet Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-4xl font-bold">${balance.toLocaleString()}</p>
                  </div>
                </div>
                <Badge variant="outline" className="mt-2">
                  Connected: Demo Wallet
                </Badge>
              </div>

              <Separator className="my-6" />

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-3">Deposit Funds</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="deposit-amount">Amount (USD)</Label>
                      <Input id="deposit-amount" type="number" placeholder="0.00" />
                    </div>
                    <Button className="w-full">
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Deposit
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Withdraw Funds</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="withdraw-amount">Amount (USD)</Label>
                      <Input id="withdraw-amount" type="number" placeholder="0.00" />
                    </div>
                    <Button variant="outline" className="w-full">
                      <ArrowUpFromLine className="mr-2 h-4 w-4" />
                      Withdraw
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Deposited</p>
                  <p className="text-2xl font-bold">$10,000</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Withdrawn</p>
                  <p className="text-2xl font-bold">$0</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">In Active Trades</p>
                  <p className="text-2xl font-bold">$2,550</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">Connect External Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your Phantom or Solflare wallet for blockchain-based trading
                  </p>
                  <Button variant="outline" className="w-full">
                    Connect Wallet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Transaction History */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge className={i % 3 === 0 ? 'bg-success' : i % 3 === 1 ? 'bg-warning' : 'bg-info'}>
                      {i % 3 === 0 ? 'DEPOSIT' : i % 3 === 1 ? 'TRADE' : 'WITHDRAW'}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">
                        {i % 3 === 0 ? 'Deposited funds' : i % 3 === 1 ? 'Bought shares' : 'Withdrew funds'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(Date.now() - i * 86400000).toLocaleDateString()} at{' '}
                        {new Date(Date.now() - i * 86400000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${i % 3 === 0 ? 'text-success' : i % 3 === 2 ? 'text-danger' : ''}`}>
                    {i % 3 === 0 ? '+' : i % 3 === 2 ? '-' : ''}${(Math.random() * 1000).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </main>
      </PageTransition>
    </div>
  );
}
