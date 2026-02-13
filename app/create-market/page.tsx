'use client';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  CalendarIcon, 
  Plus, 
  Sparkles, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const categories = [
  { value: 'Politics', label: 'Politics', icon: '🏛️' },
  { value: 'Sports', label: 'Sports', icon: '⚽' },
  { value: 'Crypto', label: 'Crypto', icon: '₿' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'Science', label: 'Science', icon: '🔬' },
  { value: 'Technology', label: 'Technology', icon: '💻' },
];

export default function CreateMarket() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    question: '',
    category: '',
    description: '',
    resolutionCriteria: '',
    resolutionSource: '',
    initialLiquidity: '',
  });
  const [endDate, setEndDate] = useState<Date>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Market Submitted",
      description: "Your market has been submitted for review. You'll be notified once it's approved.",
    });
    
    setIsSubmitting(false);
    router.push('/markets');
  };

  const isFormValid = formData.question && formData.category && formData.description && 
                      formData.resolutionCriteria && endDate;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back Button */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Market</h1>
          </div>
          <p className="text-muted-foreground">
            Propose a new prediction market. All markets are reviewed before going live.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">Market Guidelines</p>
            <p className="text-muted-foreground">
              Markets must have a clear, verifiable outcome. Political, sports, crypto, and technology markets 
              typically perform best. Avoid vague or subjective questions.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Market Question</h2>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                placeholder="e.g., Will Bitcoin reach $100,000 by end of 2025?"
                value={formData.question}
                onChange={(e) => handleInputChange('question', e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                Start with "Will" for yes/no markets. Be specific about dates and outcomes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                  <SelectTrigger className="h-12 bg-background/50 border-border/50 focus:border-primary/50">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 w-full justify-start text-left font-normal bg-background/50 border-border/50 hover:border-primary/50",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6">
            <h2 className="font-semibold">Market Details</h2>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of what this market is about..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="min-h-[120px] bg-background/50 border-border/50 focus:border-primary/50 resize-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolutionCriteria">Resolution Criteria *</Label>
              <Textarea
                id="resolutionCriteria"
                placeholder="Describe exactly how this market will be resolved..."
                value={formData.resolutionCriteria}
                onChange={(e) => handleInputChange('resolutionCriteria', e.target.value)}
                className="min-h-[100px] bg-background/50 border-border/50 focus:border-primary/50 resize-none transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what conditions need to be met for YES or NO resolution.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolutionSource">Resolution Source</Label>
              <Input
                id="resolutionSource"
                placeholder="e.g., Official government data, CoinGecko, ESPN"
                value={formData.resolutionSource}
                onChange={(e) => handleInputChange('resolutionSource', e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Media & Liquidity */}
          <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-6">
            <h2 className="font-semibold">Media & Liquidity</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Cover Image</Label>
                <div 
                  className={cn(
                    "relative h-40 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden",
                    "flex items-center justify-center bg-background/50"
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload</p>
                      <p className="text-xs text-muted-foreground/60">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Initial Liquidity */}
              <div className="space-y-2">
                <Label htmlFor="initialLiquidity">Initial Liquidity (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="initialLiquidity"
                    type="number"
                    placeholder="0.00"
                    value={formData.initialLiquidity}
                    onChange={(e) => handleInputChange('initialLiquidity', e.target.value)}
                    className="h-12 pl-8 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Provide initial liquidity to bootstrap your market. Minimum $100 recommended.
                </p>

                {/* Liquidity Info Box */}
                <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">
                      Higher liquidity = tighter spreads & more trades
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Section */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">Ready to Submit?</h3>
                <p className="text-sm text-muted-foreground">
                  Your market will be reviewed by our moderation team within 24-48 hours. 
                  You'll receive a notification once it's approved and live.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button
                type="submit"
                variant="success"
                disabled={!isFormValid || isSubmitting}
                className="h-12 px-8 font-semibold shadow-lg hover:shadow-xl"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Submit Market
                  </span>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/markets')}
                className="h-12 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
