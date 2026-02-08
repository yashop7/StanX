# Design System Documentation

## Overview

This project uses a standardized design system to ensure consistency across all components and pages. All design tokens, utilities, and patterns are centralized for easy maintenance and scalability.

## Core Files

### 1. `app/globals.css`
Contains all custom CSS utility classes organized in layers:
- **Components Layer**: Reusable component patterns (surfaces, cards, badges, etc.)
- **Utilities Layer**: Helper classes (scrollbar, animations, etc.)

### 2. `lib/design-system.ts`
Centralized JavaScript constants for common class combinations. Import and use these instead of writing className strings directly in components.

### 3. `lib/utils.ts`
Helper functions including `cn()` for merging Tailwind classes and utility functions for formatting.

---

## Design Tokens

### Surface Backgrounds (Layering)
Use these classes for consistent z-axis elevation:

```tsx
.surface-base         // Base page background
.surface-raised       // Cards and elevated content
.surface-overlay      // Modals and popovers
.surface-input        // Form inputs (consistent across all inputs)
```

**Example:**
```tsx
// ❌ DON'T - Inconsistent backgrounds
<div className="bg-muted/30 border border-border/30">
<div className="bg-background/50 dark:bg-muted/10 border-border/20">

// ✅ DO - Use standardized surfaces
<div className="surface-input">
<div className="surface-raised">
```

### Glass Morphism
```tsx
.glass-card          // Strong glass effect with backdrop blur
.glass-subtle        // Subtle glass effect
.navbar-blur         // Specialized for navigation bars
```

### Interactive States
```tsx
.hover-lift          // Lift effect with shadow on hover
.hover-scale         // Scale up/down on hover/active
.hover-glow          // Glow shadow effect
.interactive-card    // Complete hover state for cards
```

---

## Component Patterns

### Using Design System Constants

Instead of writing className strings directly, import and use the design system:

```tsx
import { designSystem, iconSizes } from '@/lib/design-system';

// ❌ DON'T - Inline strings everywhere
<input className="h-11 px-3.5 bg-muted/30 border border-border/30 rounded-lg" />
<Search className="h-4 w-4 text-muted-foreground" />

// ✅ DO - Use design system constants
<input className={designSystem.input.base} />
<Search className={cn("text-muted-foreground", iconSizes.md)} />
```

### Available Design System Patterns

#### Inputs
```tsx
designSystem.input.base        // Standard input
designSystem.input.withIcon    // Input with left icon (pl-10)
designSystem.input.search      // Search-specific styling
```

#### Buttons
```tsx
designSystem.button.sm         // Small button
designSystem.button.md         // Medium button (default)
designSystem.button.lg         // Large button
designSystem.button.primary    // Primary action button
designSystem.button.success    // Success/create button
```

#### Cards
```tsx
designSystem.card.base         // Basic card
designSystem.card.interactive  // Card with hover states
designSystem.card.featured     // Featured/highlighted card
designSystem.card.glass        // Glass morphism card
```

#### Badges
```tsx
designSystem.badge.default     // Default badge
designSystem.badge.primary     // Primary colored badge
designSystem.badge.success     // Success colored badge
designSystem.badge.category    // Category pill style
```

#### Typography
```tsx
designSystem.text.h1           // Heading 1 (responsive)
designSystem.text.h2           // Heading 2 (responsive)
designSystem.text.body         // Body text
designSystem.text.small        // Small text / captions
designSystem.text.muted        // Muted color text
```

#### Layout
```tsx
designSystem.layout.page           // Full page container
designSystem.layout.pageContent    // Main content area
designSystem.layout.centered       // Centered flex container
```

#### Navigation
```tsx
designSystem.nav.header       // Header container
designSystem.nav.bar          // Nav bar with blur
designSystem.nav.link         // Nav link styling
designSystem.nav.linkActive   // Active nav link
```

---

## Form Fields

For consistent form styling, use the formField pattern:

```tsx
import { designSystem } from '@/lib/design-system';

<div className={designSystem.formField.wrapper}>
  <Label htmlFor="email" className={designSystem.formField.label}>
    Email
  </Label>
  <Input
    id="email"
    type="email"
    className={designSystem.input.base}
  />
  <p className={designSystem.formField.description}>
    We'll never share your email
  </p>
  {error && (
    <p className={designSystem.formField.error}>
      {error}
    </p>
  )}
</div>
```

---

## Decorative Elements

### Blur Orbs
Use for background decoration:

```tsx
// ❌ DON'T - Manual blur orbs
<div className="absolute top-20 left-20 w-64 h-64 bg-primary/10 rounded-full blur-[100px] animate-pulse" />

// ✅ DO - Use utility classes
<div className="blur-orb-primary top-20 left-20 w-64 h-64" />
<div className="blur-orb-success bottom-20 right-20 w-80 h-80" />
<div className="blur-orb-info top-1/2 left-1/2 w-96 h-96" />
```

### Grid Pattern
```tsx
// ❌ DON'T
<div className="bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),...]" />

// ✅ DO
<div className={designSystem.decorative.grid} />
```

---

## Icon Sizes

Use standardized icon sizes for consistency:

```tsx
import { iconSizes } from '@/lib/design-system';

// ❌ DON'T
<Search className="h-4 w-4" />
<User className="h-3.5 w-3.5" />

// ✅ DO
<Search className={iconSizes.md} />
<User className={iconSizes.sm} />
```

Available sizes:
- `iconSizes.xs` - 3×3 (12px)
- `iconSizes.sm` - 3.5×3.5 (14px)
- `iconSizes.md` - 4×4 (16px)
- `iconSizes.lg` - 5×5 (20px)
- `iconSizes.xl` - 6×6 (24px)

---

## Best Practices

### 1. **Use Semantic Class Names**
Prefer design system constants over inline Tailwind strings when the pattern is repeated.

### 2. **Combine with cn() Helper**
Always use the `cn()` helper when combining classes:

```tsx
import { cn } from '@/lib/utils';
import { designSystem } from '@/lib/design-system';

<div className={cn(
  designSystem.card.base,
  "additional-class",
  isActive && "active-class"
)} />
```

### 3. **Consistent Spacing**
Use the spacing constants for sections:

```tsx
import { spacing } from '@/lib/design-system';

<section className={spacing.section.py}>
  <div className={spacing.card.p}>
    ...
  </div>
</section>
```

### 4. **Transitions**
Use standardized transition durations:

```tsx
designSystem.transition.default  // 200ms - default for most interactions
designSystem.transition.fast     // 150ms - for quick feedback
designSystem.transition.slow     // 300ms - for complex animations
designSystem.transition.colors   // Color-only transitions
```

### 5. **Form Consistency**
Always use `surface-input` for all form elements:

```tsx
// Input fields
<Input className={designSystem.input.base} />

// Select dropdowns
<Select>
  <SelectTrigger className="surface-input h-11" />
  ...
</Select>

// Textareas
<Textarea className="surface-input resize-none" />
```

---

## Migration Guide

### Updating Existing Components

1. **Import design system:**
```tsx
import { designSystem, iconSizes } from '@/lib/design-system';
import { cn } from '@/lib/utils';
```

2. **Replace repeated patterns:**
```tsx
// Before
<div className="bg-card border border-border/50 rounded-xl p-4">

// After
<div className={designSystem.card.base}>
```

3. **Standardize inputs:**
```tsx
// Before
<Input className="h-11 bg-muted/30 border-border/30 focus:border-border/60" />

// After
<Input className={designSystem.input.base} />
```

4. **Use icon sizes:**
```tsx
// Before
<Icon className="h-4 w-4" />

// After
<Icon className={iconSizes.md} />
```

---

## Adding New Patterns

When you find yourself repeating a className combination 3+ times:

1. Add it to `lib/design-system.ts`:
```tsx
export const designSystem = {
  // ... existing patterns
  myNewPattern: {
    variant1: "className string here",
    variant2: "another className string",
  },
} as const;
```

2. Or add a utility class to `app/globals.css`:
```css
@layer components {
  .my-new-utility {
    @apply bg-card border border-border/40 rounded-lg p-4;
  }
}
```

3. Document it in this file!

---

## Common Mistakes to Avoid

### ❌ DON'T
```tsx
// Inconsistent background opacities
<div className="bg-muted/30" />
<div className="bg-muted/50" />
<div className="bg-background/60" />

// Hardcoded sizes everywhere
<Icon className="h-4 w-4" />
<Icon className="h-3.5 w-3.5" />

// Repeated form styling
<input className="h-11 px-3 bg-background/50 dark:bg-muted/10 border-border/30" />
```

### ✅ DO
```tsx
// Use standardized surfaces
<div className="surface-input" />
<div className="surface-raised" />
<div className="surface-overlay" />

// Use icon size constants
<Icon className={iconSizes.md} />
<Icon className={iconSizes.sm} />

// Use design system constants
<input className={designSystem.input.base} />
```

---

## Performance Considerations

- The design system adds minimal runtime overhead (just class string concatenation)
- All utilities are tree-shakeable
- Tailwind's JIT compiler only includes classes actually used
- Using constants improves bundle size by deduplicating repeated strings

---

## Questions?

If you're unsure which pattern to use:
1. Check if it exists in `lib/design-system.ts`
2. Look for similar examples in `app/globals.css`
3. Check this documentation
4. When in doubt, use semantic, reusable patterns over one-off inline styles

---

**Last Updated:** Created as part of design system standardization
**Maintained By:** Development Team
