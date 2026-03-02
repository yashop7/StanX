"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Menu, 
  User, 
  Wallet, 
  Settings, 
  LogOut,
  ChevronDown,
  BarChart3,
  History,
  Plus
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletButton } from '@/components/WalletButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { useWalletSession } from '@solana/react-hooks';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import { USDC_FAUCET_URL } from '@/lib/constants';
import { Droplets, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export const Header = () => {
  const wallet = useWalletSession();
  const { balance, loading } = useWalletBalance();
  const { usdcBalance, loading: usdcLoading } = useUsdcBalance();
  const { theme, setTheme } = useTheme();
  const isLoggedIn = !!wallet;

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full navbar-blur border-b border-border/40">
      <div className="max-w-[1400px] mx-auto">
        <nav>
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-lg group">
                <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <span className="tracking-tight">PredictX</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-1">
                <Link 
                  href="/markets" 
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted/50"
                >
                  Markets
                </Link>
                <Link 
                  href="/portfolio" 
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted/50"
                >
                  Portfolio
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <Link href="/create-market">
                    <Button size="sm" variant="outline" className="rounded-lg border border-success/30 bg-success/5 hover:bg-success/10 transition-colors text-success">
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">Create</span>
                    </Button>
                  </Link>

                  {balance !== null && (
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 surface-input rounded-lg">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums">
                        {loading ? "..." : `${balance.toFixed(4)} SOL`}
                      </span>
                    </div>
                  )}

                  {usdcBalance !== null && (
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 surface-input rounded-lg">
                      <img
                        src="/usdc.webp"
                        alt="USDC"
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {usdcLoading ? "..." : usdcBalance.toFixed(2)}
                      </span>
                      {usdcBalance === 0 && (
                        <button
                          onClick={() => window.open(USDC_FAUCET_URL, '_blank')}
                          title="Get free devnet USDC from Circle Faucet"
                          className="ml-0.5 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Droplets className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <WalletButton />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-muted/50">
                        <Avatar className="h-7 w-7 ring-2 ring-border/50">
                          <AvatarFallback className="text-xs bg-linear-to-br from-primary/20 to-primary/10">
                            {wallet ? shortenAddress(wallet.account.address).slice(0, 2).toUpperCase() : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 glass-card border-border/40">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">Wallet</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {wallet ? shortenAddress(wallet.account.address) : 'Not connected'}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem asChild>
                        <Link href="/portfolio" className="flex items-center cursor-pointer">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Portfolio
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/account" className="flex items-center cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          Account
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/create-market" className="flex items-center cursor-pointer">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Market
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <History className="mr-2 h-4 w-4" />
                        Trade History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="cursor-pointer justify-between">
                        <span className="flex items-center">
                          {theme === 'dark' ? (
                            <Sun className="mr-2 h-4 w-4" />
                          ) : (
                            <Moon className="mr-2 h-4 w-4" />
                          )}
                          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <WalletButton />
                </>
              )}
              
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 hover-scale">
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};
