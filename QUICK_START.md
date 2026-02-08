# Quick Start Guide - Design System

## 🚀 Start Using the Design System Right Now

### 1. Import What You Need

```tsx
import { designSystem, iconSizes, spacing } from '@/lib/design-system';
import { cn } from '@/lib/utils';
```

---

## 📋 Common Tasks

### Creating a Form

```tsx
import { designSystem } from '@/lib/design-system';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';

export function MyForm() {
  return (
    <form className="space-y-4">
      {/* Text Field */}
      <div className={designSystem.formField.wrapper}>
        <Label className={designSystem.formField.label}>
          Email
        </Label>
        <Input 
          type="email"
          className={designSystem.input.base}
        />
        <p className={designSystem.formField.description}>
          We'll never share your email
        </p>
      </div>

      {/* Field with Icon */}
      <div className={designSystem.formField.wrapper}>
        <Label className={designSystem.formField.label}>
          Search
        </Label>
        <div className="relative">
          <Mail className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground", iconSizes.md)} />
          <Input className={designSystem.input.withIcon} />
        </div>
      </div>
    </form>
  );
}
```

---

### Creating a Card

```tsx
import { designSystem } from '@/lib/design-system';

// Simple card
<div className={designSystem.card.base}>
  <h3>Card Title</h3>
  <p>Card content</p>
</div>

// Interactive card (with hover effects)
<div className={designSystem.card.interactive}>
  <h3>Clickable Card</h3>
  <p>Hover me!</p>
</div>

// Featured card (highlighted)
<div className={designSystem.card.featured}>
  <h3>Special Card</h3>
  <p>I stand out!</p>
</div>

// Glass card
<div className={designSystem.card.glass}>
  <h3>Glass Morphism</h3>
  <p>Frosted glass effect</p>
</div>
```

---

### Adding Badges

```tsx
import { designSystem } from '@/lib/design-system';

// Default badge
<span className={designSystem.badge.default}>
  Draft
</span>

// Primary badge
<span className={designSystem.badge.primary}>
  New
</span>

// Success badge
<span className={designSystem.badge.success}>
  Active
</span>

// Category badge
<span className={designSystem.badge.category}>
  Politics
</span>
```

---

### Page Layout

```tsx
import { designSystem } from '@/lib/design-system';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function MyPage() {
  return (
    <div className={designSystem.layout.page}>
      <Header />
      
      <main className={cn(designSystem.layout.pageContent, "section-container py-8")}>
        <h1 className={designSystem.text.h1}>Page Title</h1>
        <p className={designSystem.text.small}>Page description</p>
        
        {/* Your content */}
      </main>
      
      <Footer />
    </div>
  );
}
```

---

### Typography

```tsx
import { designSystem } from '@/lib/design-system';

<h1 className={designSystem.text.h1}>Main Heading</h1>
<h2 className={designSystem.text.h2}>Section Heading</h2>
<h3 className={designSystem.text.h3}>Subsection</h3>
<p className={designSystem.text.body}>Body text</p>
<p className={designSystem.text.small}>Small text or caption</p>
<p className={designSystem.text.muted}>Muted text</p>
```

---

### Buttons

```tsx
import { designSystem } from '@/lib/design-system';
import { Button } from '@/components/ui/button';

// Using design system classes
<Button className={designSystem.button.primary}>
  Primary Action
</Button>

<Button className={designSystem.button.success}>
  Create New
</Button>

// Combine with hover effects
<Button className={cn(designSystem.button.primary, designSystem.hover.scale)}>
  Clickable
</Button>
```

---

### Icons (Consistent Sizing)

```tsx
import { iconSizes } from '@/lib/design-system';
import { Search, User, Settings } from 'lucide-react';

// Instead of hardcoding h-4 w-4 everywhere
<Search className={iconSizes.xs} />   {/* 12px */}
<User className={iconSizes.sm} />     {/* 14px */}
<Settings className={iconSizes.md} /> {/* 16px - most common */}
<Icon className={iconSizes.lg} />     {/* 20px */}
<Icon className={iconSizes.xl} />     {/* 24px */}
```

---

### Background Decorations

```tsx
import { designSystem } from '@/lib/design-system';
import { cn } from '@/lib/utils';

// Hero section with blur orbs
<section className="relative overflow-hidden">
  <div className="absolute inset-0">
    <div className="blur-orb-primary top-20 left-20 w-96 h-96" />
    <div className="blur-orb-success bottom-20 right-20 w-80 h-80" />
  </div>
  
  {/* Grid pattern overlay */}
  <div className={cn("absolute inset-0", designSystem.decorative.grid)} />
  
  {/* Content */}
  <div className="relative z-10">
    <h1>Your Content Here</h1>
  </div>
</section>
```

---

### Hover Effects

```tsx
import { designSystem } from '@/lib/design-system';
import { cn } from '@/lib/utils';

// Lift on hover
<div className={cn(designSystem.card.base, designSystem.hover.lift)}>
  Lifts up
</div>

// Scale on hover
<button className={designSystem.hover.scale}>
  Scales smoothly
</button>

// Glow on hover
<div className={cn(designSystem.card.base, designSystem.hover.glow)}>
  Glowing effect
</div>
```

---

### Transitions

```tsx
import { designSystem } from '@/lib/design-system';

// Standard transition (200ms)
<div className={designSystem.transition.default}>

// Fast transition (150ms)
<div className={designSystem.transition.fast}>

// Slow transition (300ms)
<div className={designSystem.transition.slow}>

// Color transitions only
<div className={designSystem.transition.colors}>
```

---

### Loading States

```tsx
import { designSystem } from '@/lib/design-system';

// Skeleton loader
<div className={cn(designSystem.loading.skeleton, "h-20 w-full")} />

// Spinner
<div className={designSystem.loading.spinner} />
```

---

## 🎨 Surface Levels (Z-axis)

Use these for consistent layering:

```tsx
// Page background
<div className="surface-base">

// Elevated content (cards, panels)
<div className="surface-raised">

// Overlays (modals, dropdowns)
<div className="surface-overlay">

// Form inputs (consistent everywhere)
<input className="surface-input" />

// Glass effects
<div className="glass-card">
<div className="glass-subtle">

// Navigation
<nav className="navbar-blur">
```

---

## ✅ Remember

### DO ✅
```tsx
// Use design system constants
<Input className={designSystem.input.base} />
<Icon className={iconSizes.md} />
<div className={designSystem.card.interactive} />
```

### DON'T ❌
```tsx
// Don't hardcode repeated patterns
<Input className="h-11 px-3.5 bg-muted/30 border border-border/30" />
<Icon className="h-4 w-4" />
<div className="bg-card border border-border/50 rounded-xl hover:shadow-md" />
```

---

## 🔍 Finding Patterns

**Need to style something?**

1. Check if a pattern exists in `lib/design-system.ts`
2. Look for similar examples in refactored components:
   - `app/auth/page.tsx` - Forms
   - `components/Header.tsx` - Navigation
   - `components/MarketCard.tsx` - Cards
   - `app/Index.tsx` - Decorations

3. Check `DESIGN_SYSTEM.md` for full documentation

**Can't find a pattern?**
- Use standard Tailwind classes
- If you repeat it 3+ times, add it to `design-system.ts`!

---

## 📚 Full Documentation

- **`DESIGN_SYSTEM.md`** - Complete reference guide
- **`REFACTORING_SUMMARY.md`** - What was changed and why
- **`lib/design-system.ts`** - All available patterns
- **`app/globals.css`** - CSS utility classes

---

## 🎯 Most Common Patterns

```tsx
import { designSystem, iconSizes } from '@/lib/design-system';
import { cn } from '@/lib/utils';

// 1. Form field
<div className={designSystem.formField.wrapper}>
  <Label className={designSystem.formField.label}>Label</Label>
  <Input className={designSystem.input.base} />
</div>

// 2. Card
<div className={designSystem.card.interactive}>...</div>

// 3. Badge
<span className={designSystem.badge.primary}>Badge</span>

// 4. Icon
<Icon className={iconSizes.md} />

// 5. Page layout
<div className={designSystem.layout.page}>
  <main className={designSystem.layout.pageContent}>
    <h1 className={designSystem.text.h1}>Title</h1>
  </main>
</div>
```

---

**That's it!** Start using these patterns in your new components for perfect consistency. 🎉
