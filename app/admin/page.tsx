"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { initializeMarketAction, fetchAllMarketsAction, type MarketWithAddress } from "./actions";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

export default function AdminPage() {
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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Market Admin</h1>
        <p className="text-muted-foreground mt-2">
          Initialize new prediction markets and view existing ones
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Initialize Market Form */}
        <Card>
          <CardHeader>
            <CardTitle>Initialize New Market</CardTitle>
            <CardDescription>
              Create a new prediction market on-chain (Devnet USDC)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="marketId">Market ID</Label>
                <Input
                  id="marketId"
                  type="number"
                  placeholder="1"
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  required
                  min="0"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (must never be reused)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Settlement Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={settlementDeadline}
                  onChange={(e) => setSettlementDeadline(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  When the market can be settled
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata URL</Label>
                <Input
                  id="metadata"
                  type="url"
                  placeholder="https://example.com/market-metadata.json"
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  JSON metadata with title, description, etc.
                </p>
              </div>

              <div className="pt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Collateral:</strong> USDC Devnet (4zMMC9...ncDU)
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Authority:</strong> From KEYPAIR env variable
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  "Initialize Market"
                )}
              </Button>
            </form>

            {result && (
              <Alert
                className="mt-4"
                variant={result.success ? "default" : "destructive"}
              >
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.success ? "Success!" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-2">
                      <p>Market initialized successfully!</p>
                      <a
                        href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm underline hover:no-underline"
                      >
                        View on Explorer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    result.error
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Existing Markets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Existing Markets</CardTitle>
              <CardDescription>All markets on-chain</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMarkets}
              disabled={isLoadingMarkets}
            >
              {isLoadingMarkets ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingMarkets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : markets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No markets found
              </p>
            ) : (
              <div className="space-y-3 max-h-125 overflow-y-auto">
                {markets.map((market) => (
                  <Card key={market.address} className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">
                          Market ID: {market.data.marketId}
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            market.data.isSettled
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {market.data.isSettled ? "Settled" : "Active"}
                        </span>
                      </div>
                      <Separator />
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>
                          <strong>Address:</strong>{" "}
                          <a
                            href={`https://explorer.solana.com/address/${market.address}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:no-underline font-mono"
                          >
                            {market.address.slice(0, 8)}...
                            {market.address.slice(-8)}
                          </a>
                        </p>
                        <p>
                          <strong>Deadline:</strong>{" "}
                          {new Date(
                            Number(market.data.settlementDeadline) * 1000
                          ).toLocaleString()}
                        </p>
                        <p>
                          <strong>Collateral Locked:</strong>{" "}
                          {(Number(market.data.totalCollateralLocked) / 1e6).toFixed(2)} USDC
                        </p>
                        {market.data.metaDataUrl && (
                          <p>
                            <strong>Metadata:</strong>{" "}
                            <a
                              href={market.data.metaDataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline"
                            >
                              View
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
