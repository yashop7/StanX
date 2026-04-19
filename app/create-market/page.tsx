'use client';

/**
 * Create Market — YouTube Video Prediction Flow
 *
 * Step 1: Paste YouTube URL → fetch video preview
 * Step 2: Pick metric (views/likes/comments), set target, pick deadline
 * Step 3: Review auto-generated market → submit on-chain
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft, ArrowRight, CalendarIcon, Plus, Loader2,
  AlertCircle, CheckCircle2, Zap, ExternalLink, X,
  Eye, ThumbsUp, MessageCircle, Play, Link2, Youtube,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { address } from '@solana/kit';
import { USDC_MINT, SOLANA_NETWORK } from '@/lib/constants';
import { getInitializeMarketInstructionAsync } from '@/generated/instructions/initializeMarket';
import { fetchIndexerHealth } from '@/lib/api/backend';
import { getAllMarkets } from '@/lib/blockchain/market';
import type { VideoPreview } from '@/lib/api/backend';
import { uploadMetadataAction, previewVideoAction } from './actions';
import { buildVideoMarketMetadata, formatNumber, METRIC_LABELS, type VideoMetric } from './metadata';

// ── YouTube URL detection────────

const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
];

function extractVideoId(url: string): string | null {
  for (const re of YT_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ── Metric config ─────

const METRICS: { key: VideoMetric; icon: typeof Eye; color: string }[] = [
  { key: 'views',    icon: Eye,            color: 'blue' },
  { key: 'likes',    icon: ThumbsUp,       color: 'emerald' },
  { key: 'comments', icon: MessageCircle,  color: 'amber' },
];

function getCurrentValue(video: VideoPreview, metric: VideoMetric): number {
  switch (metric) {
    case 'views':    return video.current_views;
    case 'likes':    return video.current_likes;
    case 'comments': return video.current_comments;
  }
}

// ── Pipeline types ────

type PipeStep = 'idle' | 'checking-indexer' | 'uploading-metadata' | 'initializing-market' | 'done' | 'error';

interface Pipeline {
  step: PipeStep;
  metadataUrl: string | null;
  marketId: number | null;
  txSignature: string | null;
  error: string | null;
}

function progressPct(step: PipeStep): number {
  switch (step) {
    case 'checking-indexer':    return 8;
    case 'uploading-metadata':  return 40;
    case 'initializing-market': return 75;
    case 'done':                return 100;
    default:                    return 0;
  }
}

function stepLabel(step: PipeStep, marketId: number | null): string {
  switch (step) {
    case 'checking-indexer':    return 'Verifying indexer is online...';
    case 'uploading-metadata':  return 'Uploading metadata to Arweave...';
    case 'initializing-market': return 'Waiting for wallet approval...';
    case 'done':                return `Market #${marketId} is live on-chain`;
    default:                    return '';
  }
}


export default function CreateMarket() {
  const router = useRouter();
  const wallet = useWalletSession();
  const { send } = useSendTransaction();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Step 1: URL input
  const [urlInput, setUrlInput] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [video, setVideo] = useState<VideoPreview | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Step 2: Market configuration
  const [metric, setMetric] = useState<VideoMetric>('views');
  const [targetInput, setTargetInput] = useState('');
  const [endDate, setEndDate] = useState<Date>();

  // Pipeline state
  const [pipe, setPipe] = useState<Pipeline>({
    step: 'idle', metadataUrl: null, marketId: null, txSignature: null, error: null,
  });

  const busy = pipe.step !== 'idle' && pipe.step !== 'done' && pipe.step !== 'error';
  const inFlight = pipe.step !== 'idle';
  const isDone = pipe.step === 'done';
  const isError = pipe.step === 'error';

  // ── Fetch video preview──────

  const handleFetchPreview = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) { setUrlError('Paste a YouTube URL to get started'); return; }

    const videoId = extractVideoId(url);
    if (!videoId) { setUrlError('Not a valid YouTube URL. Try youtube.com/watch?v=... or youtu.be/...'); return; }

    setUrlError(null);
    setFetchingPreview(true);
    try {
      const data = await previewVideoAction(url);
      setVideo(data);
      // Auto-set a suggested target (2x current views, rounded up)
      const current = data.current_views;
      const suggested = roundUpNice(current * 2);
      setTargetInput(String(suggested));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUrlError(msg);
    } finally {
      setFetchingPreview(false);
    }
  }, [urlInput]);

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleFetchPreview(); }
  };

  const handleReset = () => {
    setVideo(null);
    setUrlInput('');
    setUrlError(null);
    setTargetInput('');
    setEndDate(undefined);
    setMetric('views');
    setPipe({ step: 'idle', metadataUrl: null, marketId: null, txSignature: null, error: null });
  };

  // ── Target parsing 

  const parsedTarget = parseTarget(targetInput);
  const currentValue = video ? getCurrentValue(video, metric) : 0;
  const targetValid = parsedTarget !== null && parsedTarget > currentValue;

  // ── Submit handler 

  const handleSubmit = async () => {
    if (!wallet) { toast.error('Connect your wallet first'); return; }
    if (!video) { toast.error('Fetch a video first'); return; }
    if (!targetValid) { toast.error('Set a target higher than the current count'); return; }
    if (!endDate) { toast.error('Pick a settlement deadline'); return; }
    if (endDate <= new Date()) { toast.error('Deadline must be in the future'); return; }

    // Check indexer
    setPipe({ step: 'checking-indexer', metadataUrl: null, marketId: null, txSignature: null, error: null });
    try {
      const health = await fetchIndexerHealth();
      if (!health.indexer_ok) {
        setPipe(p => ({ ...p, step: 'error', error: 'Indexer is offline. Try again in a few minutes.' }));
        return;
      }
    } catch {
      setPipe(p => ({ ...p, step: 'error', error: 'Could not reach backend. Check your connection.' }));
      return;
    }

    try {
      // Build metadata
      setPipe(p => ({ ...p, step: 'uploading-metadata' }));
      const deadline = Math.floor(endDate.getTime() / 1000);
      const metadata = buildVideoMarketMetadata({
        videoId: video.video_id,
        videoTitle: video.title,
        channelName: video.channel_name,
        thumbnailUrl: video.thumbnail,
        metric,
        target: parsedTarget!,
        currentValue,
        settlementDeadline: deadline,
      });
      const metadataUrl = await uploadMetadataAction(metadata);

      // Get next market ID from chain (not indexer, which may lag)
      const onChainMarkets = await getAllMarkets();
      const marketId = onChainMarkets.length === 0 ? 1 : Math.max(...onChainMarkets.map(m => m.data.marketId)) + 1;
      setPipe(p => ({ ...p, step: 'initializing-market', metadataUrl, marketId }));

      // Initialize on-chain
      const collateralMint = address(
        USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] ?? USDC_MINT.devnet,
      );
      const { signer: authority } = createWalletTransactionSigner(wallet);
      const ix = await getInitializeMarketInstructionAsync({
        authority, collateralMint, marketId,
        settlementDeadline: BigInt(deadline),
        metaDataUrl: metadataUrl,
      });
      const signature = await send({ instructions: [ix], authority });

      setPipe(p => ({ ...p, step: 'done', txSignature: signature }));
      toast.success(`Market #${marketId} is live!`);
    } catch (err: unknown) {
      // Log transactionPlanResult for on-chain error details
      if (err && typeof err === 'object' && 'transactionPlanResult' in err) {
        console.error('[create-market] transactionPlanResult:', (err as any).transactionPlanResult);
        const results: any[] = (err as any).transactionPlanResult ?? [];
        const failed = results.find((r: any) => r?.error);
        if (failed?.error) {
          const logs: string[] = failed.error?.context?.logs ?? [];
          console.error('[create-market] on-chain logs:', logs);
          const programError = logs.findLast((l: string) => l.includes('Error') || l.includes('failed'));
          if (programError) {
            const msg = `On-chain error: ${programError}`;
            setPipe(p => ({ ...p, step: 'error', error: msg }));
            toast.error('Transaction failed', { description: programError });
            return;
          }
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[create-market] error:', err);
      setPipe(p => ({ ...p, step: 'error', error: msg }));
      toast.error('Failed to create market', { description: msg });
    }
  };

  const pct = progressPct(pipe.step);

  // ── Generated market question preview 

  const generatedQuestion = video && parsedTarget
    ? `Will "${video.title}" reach ${formatNumber(parsedTarget)} ${METRIC_LABELS[metric].toLowerCase()}?`
    : null;

  // ── Render 

  return (
    <div className={cn('min-h-screen bg-background', inFlight && 'pb-20')}>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Create Video Market</h1>
          </div>
          <p className="text-muted-foreground">
            Paste a YouTube video link, set your prediction target, and launch a market.
          </p>
        </div>

        {/* Wallet gate */}
        {!mounted || !wallet ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-muted/20 border border-border/30 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted/40 border border-border/40">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Wallet not connected</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Connect your Solana wallet to create a prediction market.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ════════════════════════════════════════════════════════════
                STEP 1 — YouTube URL Input
               ════════════════════════════════════════════════════════════ */}
            <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                <h2 className="font-semibold">YouTube Video</h2>
                {video && (
                  <button
                    onClick={handleReset}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <X className="h-3 w-3" /> Change video
                  </button>
                )}
              </div>

              {!video ? (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        ref={urlInputRef}
                        placeholder="Paste YouTube video URL..."
                        value={urlInput}
                        onChange={e => { setUrlInput(e.target.value); setUrlError(null); }}
                        onKeyDown={handleUrlKeyDown}
                        className="h-12 pl-10 bg-background/50 font-mono text-sm"
                        disabled={fetchingPreview}
                      />
                    </div>
                    <Button
                      onClick={handleFetchPreview}
                      disabled={fetchingPreview || !urlInput.trim()}
                      className="h-12 px-6"
                    >
                      {fetchingPreview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <Play className="h-4 w-4" /> Fetch
                        </span>
                      )}
                    </Button>
                  </div>
                  {urlError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-400">{urlError}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60">
                    Supports youtube.com/watch?v=, youtu.be/, and youtube.com/shorts/ links
                  </p>
                </>
              ) : (
                /* ── Video Preview Card ───── */
                <div className="rounded-xl overflow-hidden border border-border/30">
                  {/* Thumbnail hero */}
                  <div className="relative aspect-video bg-muted/20">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2">
                        {video.title}
                      </h3>
                      <p className="text-white/70 text-sm mt-1">{video.channel_name}</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 divide-x divide-border/30 bg-muted/10">
                    {METRICS.map(({ key, icon: Icon }) => {
                      const value = getCurrentValue(video, key);
                      const isSelected = metric === key;
                      return (
                        <div
                          key={key}
                          className={cn(
                            'py-3 px-4 text-center transition-colors',
                            isSelected && 'bg-primary/5',
                          )}
                        >
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {METRIC_LABELS[key]}
                            </span>
                          </div>
                          <p className={cn(
                            'text-lg font-bold tabular-nums',
                            isSelected ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {formatNumber(value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════
                STEP 2 — Market Configuration (only after video loaded)
               ════════════════════════════════════════════════════════════ */}
            {video && (
              <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Set Your Prediction</h2>
                </div>

                {/* Metric selector */}
                <div className="space-y-2">
                  <Label className="text-sm">What are you predicting?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {METRICS.map(({ key, icon: Icon }) => {
                      const isSelected = metric === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setMetric(key);
                            const current = getCurrentValue(video, key);
                            setTargetInput(String(roundUpNice(current * 2)));
                          }}
                          disabled={busy || isDone}
                          className={cn(
                            'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                            isSelected
                              ? 'border-primary/60 bg-primary/5 shadow-sm'
                              : 'border-border/30 bg-background/50 hover:border-border/60 hover:bg-muted/20',
                            (busy || isDone) && 'opacity-60 pointer-events-none',
                          )}
                        >
                          <Icon className={cn(
                            'h-5 w-5',
                            isSelected ? 'text-primary' : 'text-muted-foreground',
                          )} />
                          <span className={cn(
                            'text-sm font-semibold',
                            isSelected ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {METRIC_LABELS[key]}
                          </span>
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="target" className="text-sm">
                      Target {METRIC_LABELS[metric]}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Currently: <span className="font-semibold text-foreground tabular-nums">{formatNumber(currentValue)}</span>
                    </span>
                  </div>
                  <Input
                    id="target"
                    placeholder={`e.g. ${formatNumber(roundUpNice(currentValue * 2))}`}
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    className={cn(
                      'h-12 bg-background/50 text-lg font-semibold tabular-nums',
                      targetInput && !targetValid && 'border-red-500/50 focus-visible:ring-red-500/30',
                    )}
                    disabled={busy || isDone}
                  />
                  {targetInput && !targetValid && parsedTarget !== null && (
                    <p className="text-xs text-red-400">
                      Target must be higher than current {METRIC_LABELS[metric].toLowerCase()} ({formatNumber(currentValue)})
                    </p>
                  )}
                  {targetInput && parsedTarget === null && (
                    <p className="text-xs text-red-400">
                      Enter a valid number (e.g. 1000000 or 1M)
                    </p>
                  )}

                  {/* Quick target suggestions */}
                  <div className="flex flex-wrap gap-2">
                    {getTargetSuggestions(currentValue).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTargetInput(String(val))}
                        disabled={busy || isDone}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums border transition-all',
                          parsedTarget === val
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border/30 bg-muted/10 text-muted-foreground hover:border-border/60 hover:bg-muted/20',
                          (busy || isDone) && 'opacity-60 pointer-events-none',
                        )}
                      >
                        {formatNumber(val)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Settlement deadline */}
                <div className="space-y-2">
                  <Label className="text-sm">Settlement Deadline</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={busy || isDone}
                        className={cn(
                          'h-12 w-full justify-start text-left font-normal bg-background/50',
                          !endDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Select deadline'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={d => d <= new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  {/* Quick deadline suggestions */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '7 days', days: 7 },
                      { label: '14 days', days: 14 },
                      { label: '30 days', days: 30 },
                      { label: '90 days', days: 90 },
                    ].map(opt => {
                      const d = new Date();
                      d.setDate(d.getDate() + opt.days);
                      d.setHours(23, 59, 59, 0);
                      const isSelected = endDate && format(endDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                      return (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setEndDate(d)}
                          disabled={busy || isDone}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            isSelected
                              ? 'border-primary/50 bg-primary/10 text-foreground'
                              : 'border-border/30 bg-muted/10 text-muted-foreground hover:border-border/60 hover:bg-muted/20',
                            (busy || isDone) && 'opacity-60 pointer-events-none',
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 3 — Review & Submit
               ════════════════════════════════════════════════════════════ */}
            {video && targetValid && endDate && !isDone && (
              <div className="p-6 rounded-2xl bg-linear-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Review Your Market</h2>
                </div>

                {/* Auto-generated question preview */}
                <div className="p-4 rounded-xl bg-background/60 border border-border/30 space-y-3">
                  <p className="text-sm font-semibold text-foreground leading-relaxed">
                    {generatedQuestion}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Current: {formatNumber(currentValue)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Target: {formatNumber(parsedTarget!)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      Deadline: {format(endDate, 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/20">
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      Resolves YES if the video&apos;s {METRIC_LABELS[metric].toLowerCase()} reach or exceed{' '}
                      <span className="font-semibold text-muted-foreground">{formatNumber(parsedTarget!)}</span> by{' '}
                      {format(endDate, 'PPP')}. Resolution source: YouTube Data API.
                    </p>
                  </div>
                </div>

                {/* Thumbnail preview */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/20">
                  <img
                    src={video.thumbnail}
                    alt="Thumbnail"
                    className="w-20 h-12 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground">{video.channel_name}</p>
                  </div>
                  <a
                    href={`https://youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    onClick={handleSubmit}
                    variant="success"
                    disabled={busy}
                    className="h-12 px-8 font-semibold shadow-lg"
                  >
                    {busy ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {pipe.step === 'checking-indexer'    ? 'Checking...'       :
                         pipe.step === 'uploading-metadata'  ? 'Uploading...'      :
                                                               'Waiting for wallet...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create Market
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => router.push('/markets')}
                    className="h-12 text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground/50">
                  You will be the market authority. After the deadline passes, you can settle the market from its detail page.
                </p>
              </div>
            )}

            {/* ── Success card */}
            {isDone && (
              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-400">Market #{pipe.marketId} is Live!</h3>
                    <p className="text-sm text-muted-foreground">Your prediction market is on-chain and ready for trading.</p>
                  </div>
                </div>
                {pipe.txSignature && (
                  <p className="text-xs font-mono text-muted-foreground/50 break-all">
                    tx: {pipe.txSignature}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => router.push(`/market/${pipe.marketId}`)}
                    className="gap-2"
                  >
                    View Market <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Create Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom progress bar */}
      {inFlight && (
        <div className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-background/95 backdrop-blur-md border-t',
          isDone  ? 'border-emerald-500/30' :
          isError ? 'border-red-500/30'     :
                    'border-border/25',
        )}>
          <div className="h-0.5 w-full bg-muted/20 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-700 ease-out',
                isDone  ? 'bg-emerald-500' :
                isError ? 'bg-red-500'     :
                          'bg-primary',
              )}
              style={{
                width: `${pct}%`,
                ...(busy ? {
                  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'progress-shimmer 1.6s ease-in-out infinite',
                } : {}),
              }}
            />
          </div>

          <div className="container mx-auto px-4 max-w-3xl">
            <div className="flex items-center gap-3 py-3">
              <div className="shrink-0">
                {busy    && <Loader2      className="h-4 w-4 animate-spin text-primary" />}
                {isDone  && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {isError && <AlertCircle  className="h-4 w-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                {isError ? (
                  <p className="text-sm font-medium text-red-400 truncate">{pipe.error}</p>
                ) : (
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isDone ? 'text-emerald-400' : 'text-foreground/80',
                  )}>
                    {stepLabel(pipe.step, pipe.marketId)}
                  </p>
                )}
              </div>
              {isDone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => router.push(`/market/${pipe.marketId}`)}
                >
                  View Market #{pipe.marketId}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {isError && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => setPipe({
                    step: 'idle', metadataUrl: null,
                    marketId: null, txSignature: null, error: null,
                  })}
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─

/** Round a number up to a "nice" value for target suggestions. */
function roundUpNice(n: number): number {
  if (n <= 0) return 1000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const normalized = n / magnitude;
  const niceSteps = [1, 1.5, 2, 2.5, 3, 5, 7.5, 10];
  for (const step of niceSteps) {
    if (step >= normalized) return Math.round(step * magnitude);
  }
  return Math.round(10 * magnitude);
}

/** Generate target suggestions based on current value. */
function getTargetSuggestions(current: number): number[] {
  if (current <= 0) return [1000, 10_000, 100_000, 1_000_000];
  return [
    roundUpNice(current * 1.5),
    roundUpNice(current * 2),
    roundUpNice(current * 5),
    roundUpNice(current * 10),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
}

/** Parse a target string — supports plain numbers and K/M/B suffixes. */
function parseTarget(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!s) return null;

  const suffixMatch = s.match(/^(\d+(?:\.\d+)?)\s*([kKmMbB])$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
    return Math.round(num * multipliers[suffix]);
  }

  const num = parseInt(s, 10);
  return isNaN(num) || num <= 0 ? null : num;
}
