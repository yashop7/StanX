'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
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
  CheckCircle2,
  Info,
  Youtube,
  Tv,
  Film,
  Music,
  Gamepad2,
  Play,
  Link as LinkIcon,
  Target,
  Users,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const categories = [
  { value: 'YouTube', label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  { value: 'Streaming', label: 'Streaming', icon: Tv, color: 'text-purple-500' },
  { value: 'Movies', label: 'Movies', icon: Film, color: 'text-amber-500' },
  { value: 'Music', label: 'Music', icon: Music, color: 'text-pink-500' },
  { value: 'Gaming', label: 'Gaming', icon: Gamepad2, color: 'text-green-500' },
  { value: 'TV Shows', label: 'TV Shows', icon: Play, color: 'text-blue-500' },
];

const marketTypes = [
  { value: 'milestone', label: 'Milestone', description: 'Will X reach Y by date?' },
  { value: 'comparison', label: 'Comparison', description: 'Will X beat Y?' },
  { value: 'event', label: 'Event Outcome', description: 'Will X win/release/happen?' },
];

interface FormErrors {
  question?: string;
  category?: string;
  endDate?: string;
  description?: string;
  resolutionCriteria?: string;
}

export default function CreateMarket() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    question: '',
    category: '',
    marketType: '',
    description: '',
    resolutionCriteria: '',
    sourceUrl: '',
    targetValue: '',
    initialPrice: '50',
    initialLiquidity: '',
  });
  const [endDate, setEndDate] = useState<Date>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    } else if (formData.question.length < 10) {
      newErrors.question = 'Question must be at least 10 characters';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    if (!endDate) {
      newErrors.endDate = 'Resolution date is required';
    } else if (endDate <= new Date()) {
      newErrors.endDate = 'Resolution date must be in the future';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }
    
    if (!formData.resolutionCriteria.trim()) {
      newErrors.resolutionCriteria = 'Resolution criteria is required';
    } else if (formData.resolutionCriteria.length < 20) {
      newErrors.resolutionCriteria = 'Resolution criteria must be at least 20 characters';
    }
    
    setErrors(newErrors);
    // Mark all fields as touched when validating
    setTouched({
      question: true,
      category: true,
      endDate: true,
      description: true,
      resolutionCriteria: true,
    });
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors', {
        description: 'Some required fields are missing or invalid'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Market Created!', {
      description: 'Your market is now live on the order book.'
    });
    
    setIsSubmitting(false);
    router.push('/markets');
  };

  const selectedCategory = categories.find(c => c.value === formData.category);

  // Helper component for error message
  const FieldError = ({ error }: { error?: string }) => {
    if (!error) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-danger">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{error}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 pt-12 max-w-3xl">
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
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Plus className="h-5 w-5 text-purple-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Create Market</h1>
          </div>
          <p className="text-muted-foreground">
            Launch a new entertainment prediction market on the order book.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-8 p-4 rounded-2xl bg-muted/20 border border-border/30 flex items-start gap-3">
          <Info className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">How Markets Work</p>
            <p className="text-muted-foreground">
              Markets use a Central Limit Order Book (CLOB). Traders post limit orders that sit on the book 
              until matched. Winners receive $1 per share when the market resolves.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Market Question */}
          <div className="panel-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold">Market Question</h2>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                placeholder="e.g., Will MrBeast hit 400M subscribers before 2026?"
                value={formData.question}
                onChange={(e) => handleInputChange('question', e.target.value)}
                onBlur={() => handleBlur('question')}
                className={cn(
                  "h-12 bg-muted/20 border-border/30 focus:border-purple-500/50",
                  touched.question && errors.question && "border-danger/50 focus:border-danger"
                )}
              />
              {touched.question && <FieldError error={errors.question} />}
              {!errors.question && (
                <p className="text-xs text-muted-foreground">
                  Start with "Will" for yes/no markets. Be specific about dates and outcomes.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => {
                    handleInputChange('category', v);
                    setTouched(prev => ({ ...prev, category: true }));
                  }}
                >
                  <SelectTrigger className={cn(
                    "h-12 bg-muted/20 border-border/30 focus:border-purple-500/50",
                    touched.category && errors.category && "border-danger/50 focus:border-danger"
                  )}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <cat.icon className={cn("h-4 w-4", cat.color)} />
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.category && <FieldError error={errors.category} />}
              </div>

              <div className="space-y-2">
                <Label>Market Type</Label>
                <Select value={formData.marketType} onValueChange={(v) => handleInputChange('marketType', v)}>
                  <SelectTrigger className="h-12 bg-muted/20 border-border/30 focus:border-purple-500/50">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex flex-col">
                          <span>{type.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resolution Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => setTouched(prev => ({ ...prev, endDate: true }))}
                    className={cn(
                      "h-12 w-full justify-start text-left font-normal bg-muted/20 border-border/30 hover:border-purple-500/50",
                      !endDate && "text-muted-foreground",
                      touched.endDate && errors.endDate && "border-danger/50 hover:border-danger"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select resolution date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      if (errors.endDate) {
                        setErrors(prev => ({ ...prev, endDate: undefined }));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {touched.endDate && <FieldError error={errors.endDate} />}
            </div>
          </div>

          {/* Source & Target */}
          {selectedCategory && (
            <div className="panel-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-purple-400" />
                <h2 className="font-semibold">Tracking Source</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceUrl">
                  {formData.category === 'YouTube' ? 'YouTube Channel/Video URL' : 'Source URL'}
                </Label>
                <Input
                  id="sourceUrl"
                  placeholder={
                    formData.category === 'YouTube' 
                      ? "https://youtube.com/@MrBeast" 
                      : "https://example.com/source"
                  }
                  value={formData.sourceUrl}
                  onChange={(e) => handleInputChange('sourceUrl', e.target.value)}
                  className="h-12 bg-muted/20 border-border/30 focus:border-purple-500/50"
                />
              </div>

              {formData.marketType === 'milestone' && (
                <div className="space-y-2">
                  <Label htmlFor="targetValue">
                    <span className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5" />
                      Target Value
                    </span>
                  </Label>
                  <Input
                    id="targetValue"
                    placeholder="e.g., 400000000 (subscribers)"
                    value={formData.targetValue}
                    onChange={(e) => handleInputChange('targetValue', e.target.value)}
                    className="h-12 bg-muted/20 border-border/30 focus:border-purple-500/50"
                  />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="panel-card p-6 space-y-5">
            <h2 className="font-semibold">Market Details</h2>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of what this market is about..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                onBlur={() => handleBlur('description')}
                className={cn(
                  "min-h-[100px] bg-muted/20 border-border/30 focus:border-purple-500/50 resize-none",
                  touched.description && errors.description && "border-danger/50 focus:border-danger"
                )}
              />
              {touched.description && <FieldError error={errors.description} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolutionCriteria">Resolution Criteria *</Label>
              <Textarea
                id="resolutionCriteria"
                placeholder="Describe exactly how this market will be resolved. What source will be used?"
                value={formData.resolutionCriteria}
                onChange={(e) => handleInputChange('resolutionCriteria', e.target.value)}
                onBlur={() => handleBlur('resolutionCriteria')}
                className={cn(
                  "min-h-[80px] bg-muted/20 border-border/30 focus:border-purple-500/50 resize-none",
                  touched.resolutionCriteria && errors.resolutionCriteria && "border-danger/50 focus:border-danger"
                )}
              />
              {touched.resolutionCriteria && <FieldError error={errors.resolutionCriteria} />}
              {!errors.resolutionCriteria && (
                <p className="text-xs text-muted-foreground">
                  Be specific about what conditions trigger YES or NO resolution.
                </p>
              )}
            </div>
          </div>

          {/* Initial Order Book Settings */}
          <div className="panel-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-400" />
              <h2 className="font-semibold">Initial Order Book</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Starting Price */}
              <div className="space-y-2">
                <Label htmlFor="initialPrice">Starting Price (¢)</Label>
                <div className="relative">
                  <Input
                    id="initialPrice"
                    type="number"
                    min="1"
                    max="99"
                    placeholder="50"
                    value={formData.initialPrice}
                    onChange={(e) => handleInputChange('initialPrice', e.target.value)}
                    className="h-12 bg-muted/20 border-border/30 focus:border-purple-500/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Initial YES price (1-99¢). NO = 100 - YES.
                </p>
              </div>

              {/* Initial Liquidity */}
              <div className="space-y-2">
                <Label htmlFor="initialLiquidity">Initial Liquidity</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="initialLiquidity"
                    type="number"
                    placeholder="100"
                    value={formData.initialLiquidity}
                    onChange={(e) => handleInputChange('initialLiquidity', e.target.value)}
                    className="h-12 pl-7 bg-muted/20 border-border/30 focus:border-purple-500/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  USDC to seed the order book. Min $100 recommended.
                </p>
              </div>
            </div>

            {/* Price Preview */}
            {formData.initialPrice && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/20">
                <p className="text-xs text-muted-foreground mb-3">Initial Order Book Preview</p>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <span className="text-success font-bold text-lg">{formData.initialPrice}¢</span>
                    <p className="text-xs text-muted-foreground">YES</p>
                  </div>
                  <div className="h-px flex-1 mx-4 bg-border/50" />
                  <div className="text-center">
                    <span className="text-danger font-bold text-lg">{100 - parseInt(formData.initialPrice || '50')}¢</span>
                    <p className="text-xs text-muted-foreground">NO</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cover Image */}
          <div className="panel-card p-6 space-y-5">
            <h2 className="font-semibold">Cover Image</h2>
            
            <div 
              className={cn(
                "relative h-40 rounded-xl border-2 border-dashed border-border/30 hover:border-purple-500/50 transition-colors cursor-pointer overflow-hidden",
                "flex items-center justify-center bg-muted/20"
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

          {/* Submit Section */}
          <div className="panel-card p-6 space-y-4 bg-gradient-to-br from-purple-500/5 to-transparent">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-purple-400 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">Ready to Launch?</h3>
                <p className="text-sm text-muted-foreground">
                  Your market will go live immediately. Initial liquidity will be locked in the order book.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-8 font-semibold bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Market
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
      
      <Footer />
    </div>
  );
}
