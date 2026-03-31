'use client';

/**
 * Create Market — 3-step pipeline:
 *   1. Upload image to Arweave via Irys  → imageUrl
 *   2. Upload metadata JSON to Arweave   → metadataUrl
 *   3. initializeMarket on-chain (wallet tx) with metadataUrl
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, CalendarIcon, Plus, Sparkles, Upload, AlertCircle,
  CheckCircle2, Loader2, ImageIcon, FileJson, Zap, ExternalLink, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWalletSession, useSendTransaction } from '@solana/react-hooks';
import { createWalletTransactionSigner } from '@solana/client';
import { address } from '@solana/kit';
import { USDC_MINT, SOLANA_NETWORK } from '@/lib/constants';
import { getInitializeMarketInstructionAsync } from '@/generated/instructions/initializeMarket';
import { fetchBackendMarkets } from '@/lib/api/backend';
import { uploadImageAction, uploadMetadataAction } from './actions';
import { buildMarketMetadata } from './metadata';

// ── Constants ────────────────────────────────────────────────────────────────

const categories = [
  { value: 'Politics', label: 'Politics', icon: '🏛️' },
  { value: 'Sports', label: 'Sports', icon: '⚽' },
  { value: 'Crypto', label: 'Crypto', icon: '₿' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'Science', label: 'Science', icon: '🔬' },
  { value: 'Technology', label: 'Technology', icon: '💻' },
];

const LIMITS = {
  question:           200,
  description:        500,
  resolutionCriteria: 500,
  resolutionSource:   200,
  imageMaxBytes:      10 * 1024 * 1024, // 10 MB
};

type Step = 'idle' | 'uploading-image' | 'uploading-metadata' | 'initializing-market' | 'done' | 'error';

interface Pipeline {
  step: Step;
  imageUrl: string | null;
  metadataUrl: string | null;
  marketId: number | null;
  txSignature: string | null;
  error: string | null;
}

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'uploading-image',     label: 'Upload Image to Arweave',    icon: <ImageIcon className="h-4 w-4" /> },
  { key: 'uploading-metadata',  label: 'Upload Metadata to Arweave', icon: <FileJson className="h-4 w-4" /> },
  { key: 'initializing-market', label: 'Initialize Market On-Chain',  icon: <Zap className="h-4 w-4" /> },
];

function stepIdx(step: Step) { return STEPS.findIndex((s) => s.key === step); }

// ── Component ────────────────────────────────────────────────────────────────

export default function CreateMarket() {
  const router = useRouter();
  const wallet = useWalletSession();
  const { send } = useSendTransaction();

  const [form, setFormState] = useState({
    question: '', category: '', description: '',
    resolutionCriteria: '', resolutionSource: '',
  });
  const [endDate, setEndDate] = useState<Date>();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pipe, setPipe] = useState<Pipeline>({
    step: 'idle', imageUrl: null, metadataUrl: null,
    marketId: null, txSignature: null, error: null,
  });

  const busy = pipe.step !== 'idle' && pipe.step !== 'done' && pipe.step !== 'error';
  const curIdx = stepIdx(pipe.step);

  // Enforce character limits on all text fields
  const set = (field: keyof typeof LIMITS, value: string) => {
    const limit = LIMITS[field as keyof typeof LIMITS];
    if (typeof limit === 'number' && field !== 'imageMaxBytes' && value.length > limit) return;
    setFormState((p) => ({ ...p, [field]: value }));
  };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > LIMITS.imageMaxBytes) {
      toast.error('Image too large', { description: `Max allowed size is 10 MB. Your file is ${(f.size / 1024 / 1024).toFixed(1)} MB.` });
      e.target.value = '';
      return;
    }
    setImageFile(f);
    const r = new FileReader();
    r.onloadend = () => setImagePreview(r.result as string);
    r.readAsDataURL(f);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  async function nextMarketId(): Promise<number> {
    try {
      const markets = await fetchBackendMarkets();
      if (markets.length === 0) return 1;
      return Math.max(...markets.map((m) => m.market_id)) + 1;
    } catch {
      const id = (Date.now() % 100_000) + 1;
      return id;
    }
  }

  // ── Submit handler — the 3-step pipeline ─────────────────────────────────

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    // ── Client-side validation ──────────────────────────────────────────────
    if (!wallet) {
      toast.error('Wallet not connected', { description: 'Connect your wallet before creating a market.' });
      return;
    }
    if (!form.question.trim()) {
      toast.error('Question required', { description: 'Please enter a market question.' });
      return;
    }
    if (!form.category) {
      toast.error('Category required', { description: 'Please select a category.' });
      return;
    }
    if (!form.description.trim()) {
      toast.error('Description required', { description: 'Please describe what this market is about.' });
      return;
    }
    if (!form.resolutionCriteria.trim()) {
      toast.error('Resolution criteria required', { description: 'Explain how this market will be resolved.' });
      return;
    }
    if (!endDate) {
      toast.error('Settlement date required', { description: 'Pick a date when this market will settle.' });
      return;
    }
    if (endDate <= new Date()) {
      toast.error('Invalid date', { description: 'Settlement deadline must be in the future.' });
      return;
    }

    setPipe({ step: 'uploading-image', imageUrl: null, metadataUrl: null, marketId: null, txSignature: null, error: null });

    try {
      // ── Step 1: Upload image ─────────────────────────────────────────────
      let imageUrl = '';
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        imageUrl = await uploadImageAction(fd);
      }
      setPipe((p) => ({ ...p, step: 'uploading-metadata', imageUrl }));

      // ── Step 2: Upload metadata JSON ─────────────────────────────────────
      const deadline = Math.floor(endDate.getTime() / 1000);
      const metadata = buildMarketMetadata({
        name: form.question,
        description: form.description,
        imageUrl,
        category: form.category,
        resolutionCriteria: form.resolutionCriteria,
        resolutionSource: form.resolutionSource,
        settlementDeadline: deadline,
      });
      const metadataUrl = await uploadMetadataAction(metadata);

      // ── Step 3: Initialize market on-chain ───────────────────────────────
      const marketId = await nextMarketId();
      setPipe((p) => ({ ...p, step: 'initializing-market', metadataUrl, marketId }));

      const collateralMint = address(
        USDC_MINT[SOLANA_NETWORK as keyof typeof USDC_MINT] ?? USDC_MINT.devnet,
      );
      const { signer: authority } = createWalletTransactionSigner(wallet);

      const ix = await getInitializeMarketInstructionAsync({
        authority,
        collateralMint,
        marketId,
        settlementDeadline: BigInt(deadline),
        metaDataUrl: metadataUrl,
      });

      const signature = await send({ instructions: [ix], authority });

      setPipe((p) => ({ ...p, step: 'done', txSignature: signature }));
      toast.success('Market created!', { description: `Market #${marketId} is now live on-chain.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipe((p) => ({ ...p, step: 'error', error: msg }));
      toast.error('Failed to create market', { description: msg });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20"><Plus className="h-5 w-5 text-primary" /></div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Market</h1>
          </div>
          <p className="text-muted-foreground">Upload image & metadata to Arweave, then initialize the market on-chain.</p>
        </div>

        {/* ── Pipeline progress ──────────────────────────────────────────── */}
        {pipe.step !== 'idle' && (
          <div className="mb-8 p-5 rounded-2xl bg-card border border-border/50 space-y-4">
            <p className="text-sm font-semibold">Progress</p>
            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const done = pipe.step === 'done' || curIdx > i;
                const active = s.key === pipe.step;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                      done && 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                      active && 'bg-primary/20 border-primary text-primary animate-pulse',
                      !done && !active && 'bg-muted/30 border-border/40 text-muted-foreground',
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : s.icon}
                    </div>
                    <span className={cn('text-sm', done && 'text-emerald-400', active && 'text-foreground font-medium', !done && !active && 'text-muted-foreground')}>
                      {s.label}
                    </span>
                    {done && i === 0 && pipe.imageUrl && (
                      <a href={pipe.imageUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-400 font-mono truncate max-w-[200px]">
                        {pipe.imageUrl.split('/').pop()} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    {done && i === 1 && pipe.metadataUrl && (
                      <a href={pipe.metadataUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-400 font-mono truncate max-w-[200px]">
                        {pipe.metadataUrl.split('/').pop()} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Success */}
            {pipe.step === 'done' && (
              <div className="pt-2 space-y-3">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <p className="text-sm font-semibold text-emerald-400">Market #{pipe.marketId} Created!</p>
                  {pipe.txSignature && (
                    <p className="text-xs text-muted-foreground font-mono break-all">Tx: {pipe.txSignature}</p>
                  )}
                  {pipe.imageUrl && (
                    <p className="text-xs text-muted-foreground">
                      Image: <a href={pipe.imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{pipe.imageUrl}</a>
                    </p>
                  )}
                  {pipe.metadataUrl && (
                    <p className="text-xs text-muted-foreground">
                      Metadata: <a href={pipe.metadataUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{pipe.metadataUrl}</a>
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={() => router.push('/markets')} className="w-full">View Markets</Button>
              </div>
            )}

            {/* Error */}
            {pipe.step === 'error' && pipe.error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Error</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{pipe.error}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3" onClick={() =>
                  setPipe({ step: 'idle', imageUrl: null, metadataUrl: null, marketId: null, txSignature: null, error: null })
                }>Try Again</Button>
              </div>
            )}
          </div>
        )}

        {/* ── Wallet gate — full block when not connected ─────────────── */}
        {!wallet ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-muted/20 border border-border/30 text-center space-y-4">
            <div className="p-4 rounded-full bg-muted/40 border border-border/40">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Wallet not connected</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                You need to connect your Solana wallet to create a prediction market.
              </p>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Market Question</h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="question">Question *</Label>
                <span className={cn('text-xs', form.question.length >= LIMITS.question ? 'text-red-400' : 'text-muted-foreground')}>
                  {form.question.length}/{LIMITS.question}
                </span>
              </div>
              <Input
                id="question"
                placeholder="e.g., Will Bitcoin reach $100,000 by end of 2025?"
                value={form.question}
                onChange={(e) => set('question', e.target.value)}
                className="h-12 bg-background/50"
                disabled={busy || pipe.step === 'done'}
                maxLength={LIMITS.question}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setFormState((p) => ({ ...p, category: v }))} disabled={busy || pipe.step === 'done'}>
                  <SelectTrigger className="h-12 bg-background/50"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2"><span>{c.icon}</span><span>{c.label}</span></span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Settlement Deadline *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" disabled={busy || pipe.step === 'done'}
                      className={cn('h-12 w-full justify-start text-left font-normal bg-background/50', !endDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'Select end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(d) => d <= new Date()} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6">
            <h2 className="font-semibold">Market Details</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description *</Label>
                <span className={cn('text-xs', form.description.length >= LIMITS.description ? 'text-red-400' : 'text-muted-foreground')}>
                  {form.description.length}/{LIMITS.description}
                </span>
              </div>
              <Textarea
                id="description"
                placeholder="What is this market about?"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="min-h-[100px] bg-background/50 resize-none"
                disabled={busy || pipe.step === 'done'}
                maxLength={LIMITS.description}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="resolutionCriteria">Resolution Criteria *</Label>
                <span className={cn('text-xs', form.resolutionCriteria.length >= LIMITS.resolutionCriteria ? 'text-red-400' : 'text-muted-foreground')}>
                  {form.resolutionCriteria.length}/{LIMITS.resolutionCriteria}
                </span>
              </div>
              <Textarea
                id="resolutionCriteria"
                placeholder="How will this market be resolved?"
                value={form.resolutionCriteria}
                onChange={(e) => set('resolutionCriteria', e.target.value)}
                className="min-h-[80px] bg-background/50 resize-none"
                disabled={busy || pipe.step === 'done'}
                maxLength={LIMITS.resolutionCriteria}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="resolutionSource">Resolution Source</Label>
                <span className={cn('text-xs', form.resolutionSource.length >= LIMITS.resolutionSource ? 'text-red-400' : 'text-muted-foreground')}>
                  {form.resolutionSource.length}/{LIMITS.resolutionSource}
                </span>
              </div>
              <Input
                id="resolutionSource"
                placeholder="e.g., CoinGecko, ESPN, official data"
                value={form.resolutionSource}
                onChange={(e) => set('resolutionSource', e.target.value)}
                className="h-12 bg-background/50"
                disabled={busy || pipe.step === 'done'}
                maxLength={LIMITS.resolutionSource}
              />
            </div>
          </div>

          {/* Image */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
            <h2 className="font-semibold">Cover Image <span className="text-muted-foreground font-normal text-sm">(optional)</span></h2>
            <div className={cn(
              'relative h-44 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors overflow-hidden flex items-center justify-center bg-background/50',
              !imagePreview && 'cursor-pointer',
              (busy || pipe.step === 'done') && 'pointer-events-none opacity-60',
            )}>
              {!imagePreview && (
                <input type="file" accept="image/*" onChange={onImage} className="absolute inset-0 opacity-0 cursor-pointer" disabled={busy || pipe.step === 'done'} />
              )}
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  {/* Remove button */}
                  {!busy && pipe.step !== 'done' && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/60 hover:bg-red-500/80 flex items-center justify-center transition-colors"
                      title="Remove image"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center pointer-events-none">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground/60">PNG, JPG, GIF — max 10 MB</p>
                </div>
              )}
            </div>
            {imageFile && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="text-foreground">{imageFile.name}</span>{' '}
                <span className={imageFile.size > 5 * 1024 * 1024 ? 'text-amber-400' : ''}>
                  ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                {imageFile.size > 5 * 1024 * 1024 && (
                  <span className="text-amber-400 ml-1">— large file, upload may be slow</span>
                )}
              </p>
            )}
          </div>

          {/* Submit */}
          {pipe.step !== 'done' && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">Ready to Create?</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload image → upload metadata JSON → initialize market on-chain (1 wallet approval).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Button type="submit" variant="success" disabled={busy} className="h-12 px-8 font-semibold shadow-lg">
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {pipe.step === 'uploading-image' ? 'Uploading image…' : pipe.step === 'uploading-metadata' ? 'Uploading metadata…' : 'Waiting for wallet…'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Create Market</span>
                  )}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => router.push('/markets')} className="h-12 text-muted-foreground">Cancel</Button>
              </div>
            </div>
          )}
        </form>
        )}
      </main>
    </div>
  );
}
