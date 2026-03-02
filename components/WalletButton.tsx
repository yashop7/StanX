"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, Copy, ExternalLink, LogOut, Check, Download } from "lucide-react";
import { useWalletConnection } from "@solana/react-hooks";
import { useState } from "react";
import { toast } from "sonner";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

const DEFAULT_WALLETS = [
  {
    id: 'phantom',
    name: 'Phantom',
    icon: 'https://phantom.app/favicon.ico',
    installUrl: 'https://phantom.app/download'
  },
  {
    id: 'solflare',
    name: 'Solflare',
    icon: 'https://solflare.com/favicon.ico',
    installUrl: 'https://solflare.com/download'
  },
  {
    id: 'backpack',
    name: 'Backpack',
    icon: 'https://www.backpack.app/favicon.ico',
    installUrl: 'https://www.backpack.app/downloads'
  }
];

export const WalletButton = () => {
  const { connectors, connect, disconnect, wallet, connecting, isReady } = useWalletConnection();
  const { balance, loading } = useWalletBalance();
  const [copied, setCopied] = useState(false);

  const handleConnect = async (connectorId: string) => {
    try {
      await connect(connectorId);
      toast.success("Wallet connected successfully!");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error("Failed to connect wallet");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success("Wallet disconnected");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  const copyAddress = () => {
    if (wallet?.account.address) {
      navigator.clipboard.writeText(wallet.account.address);
      setCopied(true);
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const openExplorer = () => {
    if (wallet?.account.address) {
      window.open(`https://explorer.solana.com/address/${wallet.account.address}?cluster=devnet`, '_blank');
    }
  };

  // waiting for client side hydration to complete before rendering anything
  if (!isReady) {
    return (
      <Button size="sm" disabled className="gap-2">
        <Wallet className="h-4 w-4" />
        Loading...
      </Button>
    );
  }

  // rendering the connected wallet UI when a wallet session is active
  if (wallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 rounded-lg border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            <span className="font-mono text-sm">{shortenAddress(wallet.account.address)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 glass-card border-border/40">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-xs text-muted-foreground">Wallet Address</p>
              <p className="text-sm font-mono">{shortenAddress(wallet.account.address)}</p>
            </div>
          </DropdownMenuLabel>
          {balance !== null && (
            <DropdownMenuLabel className="font-normal pt-0">
              <div className="flex flex-col space-y-1">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-sm font-semibold tabular-nums">
                  {loading ? "..." : `${balance.toFixed(4)} SOL`}
                </p>
              </div>
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-success" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy Address"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openExplorer} className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem 
            onClick={handleDisconnect} 
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // rendering the wallet selection dropdown when no wallet is connected
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          size="sm" 
          className="gap-2 hover-scale"
          disabled={connecting}
        >
          <Wallet className="h-4 w-4" />
          {connecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 glass-card border-border/40">
        <DropdownMenuLabel>Select Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        {DEFAULT_WALLETS.map((defaultWallet) => {
          const installedConnector = connectors.find(c => 
            c.id.toLowerCase().includes(defaultWallet.id) || 
            c.name.toLowerCase().includes(defaultWallet.id)
          );
          
          if (installedConnector) {
            return (
              <DropdownMenuItem
                key={defaultWallet.id}
                onClick={() => handleConnect(installedConnector.id)}
                className="cursor-pointer flex items-center gap-2"
                disabled={connecting}
              >
                <img 
                  src={installedConnector.icon || defaultWallet.icon} 
                  alt={installedConnector.name} 
                  className="h-5 w-5 rounded"
                />
                <span className="flex-1">{installedConnector.name}</span>
              </DropdownMenuItem>
            );
          }
          
          return (
            <DropdownMenuItem
              key={defaultWallet.id}
              onClick={() => window.open(defaultWallet.installUrl, '_blank')}
              className="cursor-pointer flex items-center gap-2 opacity-60"
            >
              <img 
                src={defaultWallet.icon} 
                alt={defaultWallet.name} 
                className="h-5 w-5 rounded grayscale"
              />
              <span className="flex-1">{defaultWallet.name}</span>
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuItem>
          );
        })}
        
        {connectors.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Other Wallets
            </DropdownMenuLabel>
            {connectors
              .filter(c => !DEFAULT_WALLETS.some(dw => 
                c.id.toLowerCase().includes(dw.id) || 
                c.name.toLowerCase().includes(dw.id)
              ))
              .map((connector) => (
                <DropdownMenuItem
                  key={connector.id}
                  onClick={() => handleConnect(connector.id)}
                  className="cursor-pointer flex items-center gap-2"
                  disabled={connecting}
                >
                  {connector.icon && (
                    <img 
                      src={connector.icon} 
                      alt={connector.name} 
                      className="h-5 w-5 rounded"
                    />
                  )}
                  <span>{connector.name}</span>
                </DropdownMenuItem>
              ))
            }
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
