"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Menu,
  User,
  Wallet,
  Settings,
  ChevronDown,
  History,
  Plus,
} from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import { WalletButton } from '@/components/WalletButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWalletSession } from '@solana/react-hooks';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { useUsdcBalance } from '@/hooks/use-usdc-balance';
import { USDC_FAUCET_URL } from '@/lib/constants';
import { Droplets } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIndexerHealth } from '@/hooks/use-indexer-health';

export const Header = () => {
  const wallet = useWalletSession();
  const { balance, loading } = useWalletBalance();
  const { usdcBalance, loading: usdcLoading } = useUsdcBalance();
  const isLoggedIn = !!wallet;
  const pathname = usePathname();
  const { health, indexerOk } = useIndexerHealth();

  const shortenAddress = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  const navLinks: { href: string; label: string }[] = [];

  return (
    <header className="sticky top-0 z-50 w-full navbar-blur border-b border-border">
      <div className="max-w-350 mx-auto flex h-[52px] items-center justify-between px-4 lg:px-6">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center">
            <LogoMark className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Stanx</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Indexer health dot — only shown once we have a response */}
          {health !== null && (
            <div
              title={
                indexerOk
                  ? `Indexer live · ${health.seconds_since_heartbeat}s ago`
                  : 'Indexer offline — trading paused'
              }
              className={cn(
                'hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border',
                indexerOk
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  indexerOk ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                )}
              />
              {indexerOk ? 'Live' : 'Syncing'}
            </div>
          )}

          {isLoggedIn ? (
            <>
              {/* USDC balance chip */}
              {usdcBalance !== null && (
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border text-xs font-medium tabular-nums text-muted-foreground">
                  <img src="/usdc.webp" alt="USDC" className="h-3.5 w-3.5" />
                  <span>{usdcLoading ? '…' : `$${usdcBalance.toFixed(2)}`}</span>
                  {usdcBalance === 0 && (
                    <button
                      onClick={() => window.open(USDC_FAUCET_URL, '_blank')}
                      title="Get free devnet USDC"
                      className="text-info hover:text-info/80 transition-colors"
                    >
                      <Droplets className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {/* SOL balance chip */}
              {balance !== null && (
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border text-xs font-medium tabular-nums text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{loading ? '…' : `${balance.toFixed(3)} SOL`}</span>
                </div>
              )}

              <Link href="/create-market" className="hidden sm:block">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs font-medium border-border bg-transparent hover:bg-muted/60 text-foreground gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </Button>
              </Link>

              <WalletButton />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden sm:flex h-7 px-1.5 hover:bg-muted/60 gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] font-semibold bg-muted border border-border">
                        {wallet ? wallet.account.address.slice(0, 2).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-border bg-card">
                  <DropdownMenuLabel className="font-normal py-2">
                    <p className="text-xs font-medium text-foreground">Wallet</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {wallet ? shortenAddress(wallet.account.address) : 'Not connected'}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/create-market" className="flex items-center gap-2 text-sm">
                      <Plus className="h-3.5 w-3.5" />
                      Create Market
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2 text-sm">
                    <History className="h-3.5 w-3.5" />
                    Trade History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex items-center gap-2 text-sm">
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <WalletButton />
            </>
          )}

          <Button variant="ghost" size="icon" className="md:hidden h-7 w-7 hover:bg-muted/60">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
