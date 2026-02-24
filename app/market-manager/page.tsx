"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { initializeMarketAction, fetchAllMarketsAction, type MarketWithAddress } from "../admin/actions";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, RefreshCw } from "lucide-react";

export default function MarketManagerPage() {
  const [marketId, setMarketId] = useState("");
  const [settlementDeadline, setSettlementDeadline] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    signature?: string;
    error?: string;
  } | null>(null);

  const [markets, setMarkets] = useState<MarketWithAddress[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);

  // Load markets on mount
  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setIsLoadingMarkets(true);
    const response = await fetchAllMarketsAction();
    if (response.success && response.markets) {
      setMarkets(response.markets);
    }
    setIsLoadingMarkets(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);

    const response = await initializeMarketAction({
      marketId: parseInt(marketId),
      settlementDeadline,
      metadataUrl,
    });

    setResult(response);
    setIsLoading(false);

    // Reload markets if successful
    if (response.success) {
      await loadMarkets();
      // Clear form
      setMarketId("");
      setSettlementDeadline("");
      setMetadataUrl("");
    }
  };

  // Set default date to 7 days from now
  useEffect(() => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    setSettlementDeadline(sevenDaysFromNow.toISOString().slice(0, 16));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight mb-3">
            Market Manager
          </h1>
          <p className="text-muted-foreground text-lg">
            Create new prediction markets and view all existing markets on-chain
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Create Market Section */}
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader className="bg-muted/30">
                <CardTitle className="text-2xl">Create New Market</CardTitle>
                <CardDescription className="text-base">
                  Initialize a new prediction market on Solana Devnet
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="marketId" className="text-base font-semibold">
                      Market ID
                    </Label>
                    <Input
                      id="marketId"
                      type="number"
                      placeholder="Enter unique market ID (e.g., 1)"
                      value={marketId}
                      onChange={(e) => setMarketId(e.target.value)}
                      required
                      min="0"
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Unique u32 identifier — must never be reused
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline" className="text-base font-semibold">
                      Settlement Deadline
                    </Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={settlementDeadline}
                      onChange={(e) => setSettlementDeadline(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Unix timestamp when the market can be settled
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metadata" className="text-base font-semibold">
                      Metadata URL
                    </Label>
                    <Input
                      id="metadata"
                      type="url"
                      placeholder="https://example.com/metadata.json"
                      value={metadataUrl}
                      onChange={(e) => setMetadataUrl(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Off-chain JSON with market title, description, image, etc.
                    </p>
                  </div>

                  <Separator />

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Configuration</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <span className="font-semibold">Collateral:</span> USDC Devnet
                      </p>
                      <p className="font-mono text-xs">
                        4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
                      </p>
                      <p className="mt-2">
                        <span className="font-semibold">Authority:</span> KEYPAIR from .env
                      </p>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold" 
                    disabled={isLoading}
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Initializing Market...
                      </>
                    ) : (
                      "Initialize Market"
                    )}
                  </Button>
                </form>

                {result && (
                  <Alert
                    className="mt-6"
                    variant={result.success ? "default" : "destructive"}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                    <AlertTitle className="text-base font-semibold">
                      {result.success ? "Market Created!" : "Error"}
                    </AlertTitle>
                    <AlertDescription>
                      {result.success ? (
                        <div className="space-y-3 mt-2">
                          <p>Market initialized successfully on Solana Devnet</p>
                          <a
                            href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium underline hover:no-underline"
                          >
                            View Transaction on Solana Explorer
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      ) : (
                        <p className="mt-1">{result.error}</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Markets List Section */}
          <div className="space-y-6">
            <Card className="border-2">
              <CardHeader className="bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">All Markets</CardTitle>
                    <CardDescription className="text-base">
                      {markets.length} market{markets.length !== 1 ? "s" : ""} on-chain
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMarkets}
                    disabled={isLoadingMarkets}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingMarkets ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingMarkets ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading markets...</p>
                  </div>
                ) : markets.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-base">
                      No markets found on-chain
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Create your first market using the form
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-125 overflow-y-auto pr-2">
                    {markets.map((market) => (
                      <Card 
                        key={market.address} 
                        className="p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-lg">
                                Market #{market.data.marketId}
                              </h4>
                              <a
                                href={`https://explorer.solana.com/address/${market.address}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1 mt-1"
                              >
                                {market.address.slice(0, 12)}...{market.address.slice(-12)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                market.data.isSettled
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}
                            >
                              {market.data.isSettled ? "Settled" : "Active"}
                            </span>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground font-medium">Deadline</p>
                              <p className="font-mono text-xs mt-1">
                                {new Date(
                                  Number(market.data.settlementDeadline) * 1000
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground font-medium">Locked</p>
                              <p className="font-semibold mt-1">
                                {(Number(market.data.totalCollateralLocked) / 1e6).toFixed(2)} USDC
                              </p>
                            </div>
                          </div>

                          {market.data.metaDataUrl && (
                            <div className="pt-2">
                              <a
                                href={market.data.metaDataUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                View Metadata
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
