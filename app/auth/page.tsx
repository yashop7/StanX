'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ArrowRight, Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: false,
    acceptTerms: false,
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: mode === 'login' ? "Welcome back!" : "Account created!",
      description: mode === 'login' 
        ? "You've successfully logged in." 
        : "Welcome to PredictX. Start trading now!",
    });
    
    setIsLoading(false);
    router.push('/markets');
  };

  const isFormValid = mode === 'login' 
    ? formData.email && formData.password
    : formData.name && formData.email && formData.password && 
      formData.password === formData.confirmPassword && formData.acceptTerms;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex"
    >
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Animated Orbs */}
        <div className="absolute inset-0">
          <div className="blur-orb-primary top-1/4 left-1/4 w-96 h-96" style={{ animationDuration: '8s' }} />
          <div className="blur-orb-success bottom-1/4 right-1/4 w-80 h-80" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          <div className="blur-orb-primary top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 pattern-grid" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <span>PredictX</span>
          </Link>

          {/* Hero Content */}
          <div className="max-w-md">
            <Badge variant="default" className="mb-6">
              <Sparkles className="h-4 w-4" />
              Trade on Reality
            </Badge>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
              Predict the future.
              <br />
              <span className="text-muted-foreground">Earn rewards.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Join thousands of traders making predictions on world events. 
              From politics to sports, put your knowledge to work.
            </p>

            {/* Stats */}
            <div className="flex gap-8 mt-8 pt-8 border-t border-border/30 dark:border-border/15">
              <div>
                <div className="text-2xl font-bold">$2.4B</div>
                <div className="text-sm text-muted-foreground">Total Volume</div>
              </div>
              <div>
                <div className="text-2xl font-bold">450K+</div>
                <div className="text-sm text-muted-foreground">Traders</div>
              </div>
              <div>
                <div className="text-2xl font-bold">12K+</div>
                <div className="text-sm text-muted-foreground">Markets</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-muted-foreground">
            © 2024 PredictX. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-border/30 dark:border-border/15">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="h-5 w-5" />
            <span>PredictX</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">
            {/* Form Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-muted-foreground">
                {mode === 'login' 
                  ? 'Enter your credentials to access your account' 
                  : 'Start trading predictions in minutes'}
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex p-1 mb-8 surface-input rounded-xl">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  mode === 'login' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  mode === 'signup' 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign up
              </button>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button 
                variant="outline" 
                className="h-11 bg-background/50 dark:bg-muted/10 border-border/30 dark:border-border/20 hover:bg-muted/30 dark:hover:bg-muted/15 hover:border-border/50"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button 
                variant="outline" 
                className="h-11 bg-background/50 dark:bg-muted/10 border-border/30 dark:border-border/20 hover:bg-muted/30 dark:hover:bg-muted/15 hover:border-border/50"
              >
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </Button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30 dark:border-border/15" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-background text-muted-foreground">or continue with email</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  {mode === 'login' && (
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords don't match</p>
                  )}
                </div>
              )}

              {mode === 'login' ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={formData.rememberMe}
                    onCheckedChange={(checked) => handleInputChange('rememberMe', checked as boolean)}
                  />
                  <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
                    Remember me for 30 days
                  </Label>
                </div>
              ) : (
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="acceptTerms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => handleInputChange('acceptTerms', checked as boolean)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="acceptTerms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
              )}

              <Button
                type="submit"
                disabled={!isFormValid || isLoading}
                className={cn(
                  "w-full h-11 font-semibold group transition-all duration-300",
                  "bg-primary hover:bg-primary/90",
                  "shadow-[0_0_20px_rgba(0,0,0,0.1)] hover:shadow-[0_0_30px_rgba(0,0,0,0.15)]"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            {/* Bottom Link */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button 
                    type="button"
                    onClick={() => setMode('signup')} 
                    className="text-primary font-medium hover:underline"
                  >
                    Sign up for free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button 
                    type="button"
                    onClick={() => setMode('login')} 
                    className="text-primary font-medium hover:underline"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
